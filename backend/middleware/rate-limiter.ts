import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { logger } from "./logging";

// Create a separate database for rate limiting (could also use main DB)
const rateLimitDB = new SQLDatabase("ratelimit", {
  migrations: "./migrations",
});

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (context: RateLimitContext) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export interface RateLimitContext {
  userId?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitInfo {
  key: string;
  windowStart: Date;
  windowEnd: Date;
  requestCount: number;
  limit: number;
}

class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('Rate limiter cleanup failed', error);
      });
    }, 5 * 60 * 1000);
  }

  public configure(name: string, config: RateLimitConfig): void {
    this.configs.set(name, config);
  }

  public async checkLimit(
    configName: string, 
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const config = this.configs.get(configName);
    if (!config) {
      throw new Error(`Rate limit configuration '${configName}' not found`);
    }

    const key = config.keyGenerator ? config.keyGenerator(context) : this.generateKey(context);
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    try {
      // Get current request count in the window
      const current = await rateLimitDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM rate_limit_entries
        WHERE key = ${key}
        AND timestamp > ${windowStart}
      `;

      const currentCount = current?.count || 0;
      const remaining = Math.max(0, config.maxRequests - currentCount - 1);
      const resetTime = new Date(now.getTime() + config.windowMs);

      if (currentCount >= config.maxRequests) {
        // Rate limit exceeded
        const oldestEntry = await rateLimitDB.queryRow<{ timestamp: Date }>`
          SELECT timestamp
          FROM rate_limit_entries
          WHERE key = ${key}
          AND timestamp > ${windowStart}
          ORDER BY timestamp ASC
          LIMIT 1
        `;

        const retryAfter = oldestEntry 
          ? Math.ceil((oldestEntry.timestamp.getTime() + config.windowMs - now.getTime()) / 1000)
          : Math.ceil(config.windowMs / 1000);

        return {
          allowed: false,
          limit: config.maxRequests,
          current: currentCount,
          remaining: 0,
          resetTime,
          retryAfter
        };
      }

      // Record this request
      await rateLimitDB.exec`
        INSERT INTO rate_limit_entries (key, timestamp, metadata)
        VALUES (${key}, ${now}, ${JSON.stringify(context)})
      `;

      return {
        allowed: true,
        limit: config.maxRequests,
        current: currentCount + 1,
        remaining,
        resetTime
      };

    } catch (error) {
      logger.error('Rate limit check failed', error as Error, { 
        key, 
        configName, 
        context 
      });
      
      // Fail open - allow request if rate limiting is broken
      return {
        allowed: true,
        limit: config.maxRequests,
        current: 0,
        remaining: config.maxRequests,
        resetTime: new Date(now.getTime() + config.windowMs)
      };
    }
  }

  public async getRateLimitInfo(configName: string, context: RateLimitContext): Promise<RateLimitInfo> {
    const config = this.configs.get(configName);
    if (!config) {
      throw new Error(`Rate limit configuration '${configName}' not found`);
    }

    const key = config.keyGenerator ? config.keyGenerator(context) : this.generateKey(context);
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);
    const windowEnd = new Date(now.getTime() + config.windowMs);

    const result = await rateLimitDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM rate_limit_entries
      WHERE key = ${key}
      AND timestamp > ${windowStart}
    `;

    return {
      key,
      windowStart,
      windowEnd,
      requestCount: result?.count || 0,
      limit: config.maxRequests
    };
  }

  private generateKey(context: RateLimitContext): string {
    // Default key generation strategy
    if (context.userId) {
      return `user:${context.userId}`;
    }
    if (context.ip) {
      return `ip:${context.ip}`;
    }
    return 'anonymous';
  }

  private async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    try {
      await rateLimitDB.exec`
        DELETE FROM rate_limit_entries
        WHERE timestamp < ${cutoff}
      `;
      
      logger.debug('Rate limiter cleanup completed', { cutoff });
    } catch (error) {
      logger.error('Rate limiter cleanup failed', error as Error);
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export function setupDefaultRateLimits(): void {
  // API endpoints - per user
  rateLimiter.configure('api:user', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (context) => `api:user:${context.userId || context.ip}`,
    message: 'Too many API requests'
  });

  // Authentication endpoints - per IP
  rateLimiter.configure('auth:ip', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (context) => `auth:ip:${context.ip}`,
    message: 'Too many authentication attempts'
  });

  // File upload - per user
  rateLimiter.configure('upload:user', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (context) => `upload:user:${context.userId || context.ip}`,
    message: 'Too many file uploads'
  });

  // Project creation - per user
  rateLimiter.configure('project:create:user', {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (context) => `project:create:user:${context.userId || context.ip}`,
    message: 'Too many projects created'
  });

  // Agent orchestration - per user
  rateLimiter.configure('orchestration:user', {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 3,
    keyGenerator: (context) => `orchestration:user:${context.userId || context.ip}`,
    message: 'Too many orchestration requests'
  });

  // Global rate limit - per IP
  rateLimiter.configure('global:ip', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    keyGenerator: (context) => `global:ip:${context.ip}`,
    message: 'Too many requests from this IP'
  });
}

// Middleware function to check rate limits
export async function checkRateLimit(
  configName: string,
  context?: Partial<RateLimitContext>
): Promise<RateLimitResult> {
  const rateLimitContext: RateLimitContext = {
    ...context
  };

  // Try to get user ID from auth context if not provided
  if (!rateLimitContext.userId) {
    try {
      const auth = getAuthData();
      if (auth) {
        rateLimitContext.userId = auth.userID;
      }
    } catch {
      // Auth not available
    }
  }

  return await rateLimiter.checkLimit(configName, rateLimitContext);
}

// API endpoint to check rate limit status
export const getRateLimitStatus = api<{
  configName?: string;
}, {
  limits: Array<{
    name: string;
    info: RateLimitInfo;
  }>;
}>(
  { auth: true, expose: true, method: "GET", path: "/rate-limit/status" },
  async (req) => {
    const auth = getAuthData()!;
    const context: RateLimitContext = {
      userId: auth.userID
    };

    const configNames = req.configName 
      ? [req.configName]
      : ['api:user', 'upload:user', 'project:create:user', 'orchestration:user'];

    const limits = await Promise.all(
      configNames.map(async (name) => ({
        name,
        info: await rateLimiter.getRateLimitInfo(name, context)
      }))
    );

    return { limits };
  }
);

// Utility function for applying rate limits to API endpoints
export function withRateLimit<T extends any[], R>(
  configName: string,
  fn: (...args: T) => R | Promise<R>,
  context?: Partial<RateLimitContext>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await checkRateLimit(configName, context);
    
    if (!result.allowed) {
      const config = rateLimiter.configs.get(configName);
      const message = config?.message || 'Rate limit exceeded';
      
      logger.warn('Rate limit exceeded', undefined, {
        configName,
        limit: result.limit,
        current: result.current,
        retryAfter: result.retryAfter
      });

      throw APIError.resourceExhausted(message, {
        limit: result.limit,
        current: result.current,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      });
    }

    logger.debug('Rate limit check passed', undefined, {
      configName,
      current: result.current,
      remaining: result.remaining
    });

    const fnResult = fn(...args);
    return fnResult instanceof Promise ? await fnResult : fnResult;
  };
}

// Rate limit headers helper
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000).toString(),
    ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {})
  };
}

// Initialize rate limits on startup
setupDefaultRateLimits();

// Graceful shutdown
process.on('SIGTERM', () => {
  rateLimiter.destroy();
});

process.on('SIGINT', () => {
  rateLimiter.destroy();
});