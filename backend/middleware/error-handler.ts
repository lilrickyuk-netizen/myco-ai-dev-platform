import { APIError } from "encore.dev/api";
import log from "encore.dev/log";

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
  userId?: string;
}

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;
  public isOperational: boolean;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationAppError extends AppError {
  public validationErrors: ValidationError[];

  constructor(message: string, validationErrors: ValidationError[]) {
    super(message, 'VALIDATION_ERROR', 400, { validationErrors });
    this.name = 'ValidationAppError';
    this.validationErrors = validationErrors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    const defaultMessage = `${service} service is currently unavailable`;
    super(message || defaultMessage, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}

export function handleError(error: any): never {
  // Log the error
  log.error('Application error occurred', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    details: error.details,
  });

  // Convert to appropriate APIError
  if (error instanceof ValidationAppError) {
    throw APIError.invalidArgument(error.message).withDetails(error.details);
  }

  if (error instanceof NotFoundError) {
    throw APIError.notFound(error.message);
  }

  if (error instanceof UnauthorizedError) {
    throw APIError.unauthenticated(error.message);
  }

  if (error instanceof ForbiddenError) {
    throw APIError.permissionDenied(error.message);
  }

  if (error instanceof ConflictError) {
    throw APIError.alreadyExists(error.message);
  }

  if (error instanceof RateLimitError) {
    throw APIError.resourceExhausted(error.message);
  }

  if (error instanceof ServiceUnavailableError) {
    throw APIError.unavailable(error.message);
  }

  if (error instanceof AppError) {
    // Generic app error
    throw APIError.internal(error.message).withDetails(error.details);
  }

  // Unknown error
  throw APIError.internal('An unexpected error occurred');
}

export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} is required` }
    ]);
  }
}

export function validateString(value: any, fieldName: string, options: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
} = {}): void {
  if (typeof value !== 'string') {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be a string` }
    ]);
  }

  if (options.minLength && value.length < options.minLength) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be at least ${options.minLength} characters long` }
    ]);
  }

  if (options.maxLength && value.length > options.maxLength) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be no more than ${options.maxLength} characters long` }
    ]);
  }

  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} format is invalid` }
    ]);
  }
}

export function validateNumber(value: any, fieldName: string, options: {
  min?: number;
  max?: number;
  integer?: boolean;
} = {}): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be a number` }
    ]);
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be an integer` }
    ]);
  }

  if (options.min !== undefined && value < options.min) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be at least ${options.min}` }
    ]);
  }

  if (options.max !== undefined && value > options.max) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be no more than ${options.max}` }
    ]);
  }
}

export function validateEmail(value: any, fieldName: string): void {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  validateString(value, fieldName, { pattern: emailPattern });
}

export function validateUrl(value: any, fieldName: string): void {
  try {
    new URL(value);
  } catch {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be a valid URL` }
    ]);
  }
}

export function validateArray(value: any, fieldName: string, options: {
  minLength?: number;
  maxLength?: number;
  itemValidator?: (item: any, index: number) => void;
} = {}): void {
  if (!Array.isArray(value)) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be an array` }
    ]);
  }

  if (options.minLength && value.length < options.minLength) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must have at least ${options.minLength} items` }
    ]);
  }

  if (options.maxLength && value.length > options.maxLength) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must have no more than ${options.maxLength} items` }
    ]);
  }

  if (options.itemValidator) {
    value.forEach((item, index) => {
      try {
        options.itemValidator!(item, index);
      } catch (error) {
        if (error instanceof ValidationAppError) {
          // Re-throw with updated field names
          const updatedErrors = error.validationErrors.map(err => ({
            ...err,
            field: `${fieldName}[${index}].${err.field}`
          }));
          throw new ValidationAppError(error.message, updatedErrors);
        }
        throw error;
      }
    });
  }
}

export function validateEnum<T>(value: any, fieldName: string, allowedValues: T[]): void {
  if (!allowedValues.includes(value)) {
    throw new ValidationAppError(`Validation failed`, [
      { 
        field: fieldName, 
        message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        value 
      }
    ]);
  }
}

export function validateObject(value: any, fieldName: string, schema: Record<string, (val: any) => void>): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationAppError(`Validation failed`, [
      { field: fieldName, message: `${fieldName} must be an object` }
    ]);
  }

  const errors: ValidationError[] = [];

  for (const [key, validator] of Object.entries(schema)) {
    try {
      validator(value[key]);
    } catch (error) {
      if (error instanceof ValidationAppError) {
        const updatedErrors = error.validationErrors.map(err => ({
          ...err,
          field: `${fieldName}.${err.field}`
        }));
        errors.push(...updatedErrors);
      } else {
        errors.push({
          field: `${fieldName}.${key}`,
          message: error.message || 'Validation failed'
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationAppError('Validation failed', errors);
  }
}

export function wrapAsyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      handleError(error);
    }
  };
}

export function createValidator<T>(schema: Record<keyof T, (value: any) => void>) {
  return (data: any): T => {
    if (typeof data !== 'object' || data === null) {
      throw new ValidationAppError('Validation failed', [
        { field: 'root', message: 'Data must be an object' }
      ]);
    }

    const errors: ValidationError[] = [];

    for (const [field, validator] of Object.entries(schema)) {
      try {
        validator(data[field]);
      } catch (error) {
        if (error instanceof ValidationAppError) {
          errors.push(...error.validationErrors);
        } else {
          errors.push({
            field: field,
            message: error.message || 'Validation failed'
          });
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationAppError('Validation failed', errors);
    }

    return data as T;
  };
}