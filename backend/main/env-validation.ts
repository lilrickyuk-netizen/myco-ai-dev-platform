import { secret } from "encore.dev/config";

// Required environment variables
const requiredSecrets = {
  ClerkSecretKey: secret("ClerkSecretKey"),
};

// Optional but recommended environment variables
const optionalEnvVars = [
  "DATABASE_URL",
  "REDIS_URL", 
  "MONGODB_URL",
  "AI_ENGINE_URL",
  "EXECUTION_ENGINE_URL",
  "CORS_ORIGINS",
] as const;

// Critical environment variables that should be set
const criticalEnvVars = [
  "NODE_ENV",
  "LOG_LEVEL",
] as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingOptional: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingOptional: string[] = [];

  // Validate required secrets
  try {
    const clerkKey = requiredSecrets.ClerkSecretKey();
    if (!clerkKey || clerkKey.trim() === "") {
      errors.push("ClerkSecretKey is required but not set or empty");
    }
  } catch (err) {
    errors.push("ClerkSecretKey is required but not configured in Encore secrets");
  }

  // Validate critical environment variables
  for (const envVar of criticalEnvVars) {
    const value = process.env[envVar];
    if (!value || value.trim() === "") {
      errors.push(`${envVar} is required but not set`);
    }
  }

  // Check NODE_ENV is valid
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !["development", "production", "test"].includes(nodeEnv)) {
    warnings.push(`NODE_ENV="${nodeEnv}" is not a standard value (development, production, test)`);
  }

  // Check optional but recommended environment variables
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    if (!value || value.trim() === "") {
      missingOptional.push(envVar);
    }
  }

  // Validate DATABASE_URL format if present
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.startsWith("postgres://")) {
    warnings.push("DATABASE_URL should start with 'postgres://' for PostgreSQL");
  }

  // Validate REDIS_URL format if present
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && !redisUrl.startsWith("redis://")) {
    warnings.push("REDIS_URL should start with 'redis://'");
  }

  // Validate MONGODB_URL format if present
  const mongoUrl = process.env.MONGODB_URL;
  if (mongoUrl && !mongoUrl.startsWith("mongodb://")) {
    warnings.push("MONGODB_URL should start with 'mongodb://'");
  }

  // Check for development vs production settings
  if (nodeEnv === "production") {
    // Production-specific validations
    if (!process.env.SENTRY_DSN) {
      warnings.push("SENTRY_DSN should be set in production for error tracking");
    }
    
    if (process.env.JWT_SECRET === "your-super-secret-jwt-key-change-in-production") {
      errors.push("JWT_SECRET must be changed from default value in production");
    }

    if (process.env.LOG_LEVEL === "debug") {
      warnings.push("LOG_LEVEL=debug should not be used in production");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingOptional,
  };
}

export function logValidationResults(result: ValidationResult): void {
  if (!result.valid) {
    console.error("❌ Environment validation failed:");
    result.errors.forEach(error => console.error(`  • ${error}`));
    console.error("\nApplication cannot start with these errors. Please fix them and restart.");
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️  Environment validation warnings:");
    result.warnings.forEach(warning => console.warn(`  • ${warning}`));
  }

  if (result.missingOptional.length > 0) {
    console.info("ℹ️  Optional environment variables not set:");
    result.missingOptional.forEach(missing => console.info(`  • ${missing}`));
    console.info("These are optional but may be needed for full functionality.");
  }

  if (result.valid && result.warnings.length === 0 && result.missingOptional.length === 0) {
    console.log("✅ Environment validation passed - all required variables are set");
  }
}

// Validate environment on module load
const validationResult = validateEnvironment();
logValidationResults(validationResult);