import { APIError } from "encore.dev/api";

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  timestamp: Date;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  context?: ErrorContext;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly context?: ErrorContext;

  constructor(
    code: string, 
    message: string, 
    statusCode: number = 500, 
    details?: any,
    context?: ErrorContext
  ) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.context = context;
  }
}

export class ValidationErrorCollection extends ApplicationError {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[], context?: ErrorContext) {
    const message = `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
    super('VALIDATION_ERROR', message, 400, { validationErrors: errors }, context);
    this.errors = errors;
  }
}

export class BusinessLogicError extends ApplicationError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super('BUSINESS_LOGIC_ERROR', message, 422, details, context);
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string, context?: ErrorContext) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super('RESOURCE_NOT_FOUND', message, 404, { resource, identifier }, context);
  }
}

export class PermissionDeniedError extends ApplicationError {
  constructor(message: string = 'Permission denied', details?: any, context?: ErrorContext) {
    super('PERMISSION_DENIED', message, 403, details, context);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(limit: number, windowMs: number, context?: ErrorContext) {
    const message = `Rate limit exceeded: ${limit} requests per ${windowMs}ms`;
    super('RATE_LIMIT_EXCEEDED', message, 429, { limit, windowMs }, context);
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(service: string, originalError: Error, context?: ErrorContext) {
    super(
      'EXTERNAL_SERVICE_ERROR', 
      `External service '${service}' error: ${originalError.message}`,
      502,
      { service, originalError: originalError.message },
      context
    );
  }
}

export function handleError(error: Error, context?: ErrorContext): ErrorDetails {
  const timestamp = new Date();
  const errorContext = { ...context, timestamp };

  // Handle Encore APIErrors
  if (error instanceof APIError) {
    return {
      code: error.code.toString(),
      message: error.message,
      details: error.details,
      context: errorContext
    };
  }

  // Handle custom application errors
  if (error instanceof ApplicationError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      context: { ...errorContext, ...error.context },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  // Handle validation errors specifically
  if (error instanceof ValidationErrorCollection) {
    return {
      code: error.code,
      message: error.message,
      details: {
        validationErrors: error.errors,
        ...error.details
      },
      context: { ...errorContext, ...error.context }
    };
  }

  // Handle database errors
  if (error.message.includes('duplicate key value violates unique constraint')) {
    return {
      code: 'DUPLICATE_RESOURCE',
      message: 'Resource already exists',
      details: { originalError: error.message },
      context: errorContext
    };
  }

  if (error.message.includes('foreign key constraint')) {
    return {
      code: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist',
      details: { originalError: error.message },
      context: errorContext
    };
  }

  // Handle network/timeout errors
  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    return {
      code: 'TIMEOUT_ERROR',
      message: 'Operation timed out',
      details: { originalError: error.message },
      context: errorContext
    };
  }

  // Handle unknown errors
  console.error('Unhandled error:', error);
  
  return {
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'An internal server error occurred',
    details: process.env.NODE_ENV === 'development' 
      ? { originalError: error.message } 
      : undefined,
    context: errorContext,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
}

export function throwAPIError(error: Error, context?: ErrorContext): never {
  const errorDetails = handleError(error, context);

  // Map our error codes to Encore APIError codes
  switch (errorDetails.code) {
    case 'VALIDATION_ERROR':
      throw APIError.invalidArgument(errorDetails.message, errorDetails);
    
    case 'RESOURCE_NOT_FOUND':
      throw APIError.notFound(errorDetails.message, errorDetails);
    
    case 'PERMISSION_DENIED':
      throw APIError.permissionDenied(errorDetails.message, errorDetails);
    
    case 'RATE_LIMIT_EXCEEDED':
      throw APIError.resourceExhausted(errorDetails.message, errorDetails);
    
    case 'BUSINESS_LOGIC_ERROR':
      throw APIError.failedPrecondition(errorDetails.message, errorDetails);
    
    case 'DUPLICATE_RESOURCE':
      throw APIError.alreadyExists(errorDetails.message, errorDetails);
    
    case 'INVALID_REFERENCE':
      throw APIError.invalidArgument(errorDetails.message, errorDetails);
    
    case 'TIMEOUT_ERROR':
      throw APIError.deadlineExceeded(errorDetails.message, errorDetails);
    
    case 'EXTERNAL_SERVICE_ERROR':
      throw APIError.unavailable(errorDetails.message, errorDetails);
    
    default:
      throw APIError.internal(errorDetails.message, errorDetails);
  }
}

export function createValidationError(field: string, message: string, value?: any): ValidationError {
  return { field, message, value };
}

export function validateRequired(value: any, fieldName: string): ValidationError | null {
  if (value === undefined || value === null || value === '') {
    return createValidationError(fieldName, 'Field is required');
  }
  return null;
}

export function validateEmail(email: string, fieldName: string = 'email'): ValidationError | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return createValidationError(fieldName, 'Must be a valid email address', email);
  }
  return null;
}

export function validateLength(
  value: string, 
  minLength: number, 
  maxLength: number, 
  fieldName: string
): ValidationError | null {
  if (value.length < minLength) {
    return createValidationError(
      fieldName, 
      `Must be at least ${minLength} characters long`, 
      value
    );
  }
  if (value.length > maxLength) {
    return createValidationError(
      fieldName, 
      `Must be no more than ${maxLength} characters long`, 
      value
    );
  }
  return null;
}

export function validateEnum(
  value: string, 
  allowedValues: string[], 
  fieldName: string
): ValidationError | null {
  if (!allowedValues.includes(value)) {
    return createValidationError(
      fieldName, 
      `Must be one of: ${allowedValues.join(', ')}`, 
      value
    );
  }
  return null;
}

export function validateUUID(value: string, fieldName: string): ValidationError | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return createValidationError(fieldName, 'Must be a valid UUID', value);
  }
  return null;
}

export function collectValidationErrors(errors: (ValidationError | null)[]): ValidationError[] {
  return errors.filter((error): error is ValidationError => error !== null);
}

export function validateAndThrow(errors: ValidationError[], context?: ErrorContext): void {
  if (errors.length > 0) {
    throw new ValidationErrorCollection(errors, context);
  }
}

// Error recovery utilities
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation or permission errors
      if (error instanceof ValidationErrorCollection || 
          error instanceof PermissionDeniedError ||
          (error instanceof APIError && 
           (error.code === 'invalid_argument' || error.code === 'permission_denied'))) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  
  throw new ApplicationError(
    'MAX_RETRIES_EXCEEDED',
    `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
    500,
    { maxRetries, lastError: lastError.message },
    context
  );
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  context?: ErrorContext
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new ApplicationError(
        'OPERATION_TIMEOUT',
        `Operation timed out after ${timeoutMs}ms`,
        408,
        { timeoutMs },
        context
      ));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}