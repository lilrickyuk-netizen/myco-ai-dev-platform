import { APIError } from "encore.dev/api";
import log from "encore.dev/log";

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Maximum requests per window
  message?: string;  // Custom error message
  keyGenerator?: (userId: string, endpoint: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
  delete(key: string): Promise<void>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }
    
    return entry.count;
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    this.store.set(key, {
      count: value,
      resetTime: Date.now() + ttl
    });
  }

  async increment(key: string, ttl: number): Promise<number> {
    const existing = await this.get(key);
    const newCount = (existing || 0) + 1;
    await this.set(key, newCount, ttl);
    return newCount;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

export class RateLimiter {
  private store: RateLimitStore;
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig, store?: RateLimitStore) {
    this.config = {
      windowMs: config.windowMs,
      max: config.max,
      message: config.message || 'Too many requests',
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
    };

    this.store = store || new MemoryRateLimitStore();

    // Start cleanup for memory store
    if (this.store instanceof MemoryRateLimitStore) {
      setInterval(() => {
        (this.store as MemoryRateLimitStore).cleanup();
      }, 60000); // Cleanup every minute
    }
  }

  private defaultKeyGenerator(userId: string, endpoint: string): string {
    return `rate_limit:${userId}:${endpoint}`;
  }

  async checkLimit(userId: string, endpoint: string): Promise<void> {
    const key = this.config.keyGenerator(userId, endpoint);
    
    try {
      const current = await this.store.increment(key, this.config.windowMs);
      
      if (current > this.config.max) {
        const resetTime = new Date(Date.now() + this.config.windowMs);
        
        log.warn('Rate limit exceeded', {
          userId,
          endpoint,
          current,
          max: this.config.max,
          resetTime: resetTime.toISOString(),
        });

        throw APIError.resourceExhausted(this.config.message).withDetails({
          limit: this.config.max,
          current,
          resetTime,
          retryAfter: Math.ceil(this.config.windowMs / 1000),
        });
      }

      log.debug('Rate limit check passed', {
        userId,
        endpoint,
        current,
        max: this.config.max,
      });

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      log.error('Rate limiter error', {
        userId,
        endpoint,
        error: error.message,
      });

      // Allow request if rate limiter fails
      return;
    }
  }

  async reset(userId: string, endpoint: string): Promise<void> {
    const key = this.config.keyGenerator(userId, endpoint);
    await this.store.delete(key);
  }

  async getRemainingRequests(userId: string, endpoint: string): Promise<number> {
    const key = this.config.keyGenerator(userId, endpoint);
    const current = await this.store.get(key);
    return Math.max(0, this.config.max - (current || 0));
  }
}

// Predefined rate limiters for different use cases
export const rateLimiters = {
  // General API usage - 1000 requests per hour
  api: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000,
    message: 'Too many API requests'
  }),

  // AI generation - 100 requests per hour (more expensive)
  aiGeneration: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: 'Too many AI generation requests'
  }),

  // Code execution - 200 requests per hour
  codeExecution: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200,
    message: 'Too many code execution requests'
  }),

  // Project creation - 10 projects per day
  projectCreation: new RateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 10,
    message: 'Too many projects created today'
  }),

  // File operations - 1000 operations per hour
  fileOperations: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000,
    message: 'Too many file operations'
  }),

  // Deployment - 20 deployments per day
  deployment: new RateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 20,
    message: 'Too many deployments today'
  }),

  // Authentication - 10 login attempts per 15 minutes
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many login attempts'
  }),

  // Collaboration messages - 500 messages per hour
  collaboration: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500,
    message: 'Too many collaboration messages'
  }),
};

// Middleware helper for API endpoints
export function withRateLimit(limiter: RateLimiter, endpoint: string) {
  return async (userId: string) => {
    await limiter.checkLimit(userId, endpoint);
  };
}

// Rate limiting decorator for API endpoints
export function rateLimit(limiterName: keyof typeof rateLimiters, endpoint?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const endpointName = endpoint || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function(...args: any[]) {
      // Extract user ID from context (this would be provided by auth middleware)
      const userId = getUserIdFromContext();
      
      if (userId) {
        await rateLimiters[limiterName].checkLimit(userId, endpointName);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Helper to extract user ID from execution context
function getUserIdFromContext(): string | null {
  // This would be implemented based on your auth system
  // For Encore.ts, you'd use getAuthData()
  try {
    const { getAuthData } = require("~encore/auth");
    const auth = getAuthData();
    return auth?.userID || null;
  } catch {
    return null;
  }
}

export default RateLimiter;