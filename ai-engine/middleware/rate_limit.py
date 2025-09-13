"""
Rate limiting middleware for AI Engine
"""

import time
import asyncio
from collections import defaultdict, deque
from typing import Dict, Tuple, Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from ..core.config import settings

class TokenBucket:
    """Token bucket algorithm for rate limiting"""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.time()
    
    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens from bucket"""
        now = time.time()
        
        # Refill tokens based on time passed
        time_passed = now - self.last_refill
        self.tokens = min(
            self.capacity,
            self.tokens + time_passed * self.refill_rate
        )
        self.last_refill = now
        
        # Check if we have enough tokens
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        
        return False

class SlidingWindowRateLimit:
    """Sliding window rate limiter"""
    
    def __init__(self, max_requests: int, window_size: int):
        self.max_requests = max_requests
        self.window_size = window_size
        self.requests: Dict[str, deque] = defaultdict(deque)
    
    def is_allowed(self, identifier: str) -> Tuple[bool, Optional[float]]:
        """Check if request is allowed"""
        now = time.time()
        window_start = now - self.window_size
        
        # Clean old requests
        user_requests = self.requests[identifier]
        while user_requests and user_requests[0] <= window_start:
            user_requests.popleft()
        
        # Check if under limit
        if len(user_requests) < self.max_requests:
            user_requests.append(now)
            return True, None
        
        # Calculate retry after
        oldest_request = user_requests[0]
        retry_after = oldest_request + self.window_size - now
        
        return False, max(0, retry_after)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware"""
    
    def __init__(self, app):
        super().__init__(app)
        self.rate_limiters = {
            # General API rate limiting
            "general": SlidingWindowRateLimit(
                max_requests=settings.RATE_LIMIT_REQUESTS,
                window_size=settings.RATE_LIMIT_WINDOW
            ),
            # Specific endpoints with different limits
            "generation": SlidingWindowRateLimit(
                max_requests=20,  # Lower limit for expensive operations
                window_size=60
            ),
            "models": SlidingWindowRateLimit(
                max_requests=100,
                window_size=60
            ),
            "health": SlidingWindowRateLimit(
                max_requests=60,  # Higher limit for health checks
                window_size=60
            )
        }
        
        # Token buckets for burst handling
        self.token_buckets: Dict[str, TokenBucket] = {}
    
    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiting"""
        
        # Skip rate limiting for health checks in development
        if settings.DEBUG and request.url.path in ["/health", "/ping"]:
            return await call_next(request)
        
        # Get client identifier
        client_id = self._get_client_identifier(request)
        
        # Determine rate limit category
        category = self._get_rate_limit_category(request)
        
        # Check rate limit
        rate_limiter = self.rate_limiters.get(category, self.rate_limiters["general"])
        allowed, retry_after = rate_limiter.is_allowed(client_id)
        
        if not allowed:
            # Return rate limit exceeded error
            headers = {
                "X-RateLimit-Limit": str(rate_limiter.max_requests),
                "X-RateLimit-Window": str(rate_limiter.window_size),
                "X-RateLimit-Remaining": "0"
            }
            
            if retry_after:
                headers["Retry-After"] = str(int(retry_after))
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers=headers
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        
        # Calculate remaining requests
        user_requests = rate_limiter.requests[client_id]
        remaining = max(0, rate_limiter.max_requests - len(user_requests))
        
        response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(rate_limiter.window_size)
        
        return response
    
    def _get_client_identifier(self, request: Request) -> str:
        """Get unique identifier for client"""
        
        # Try to get user ID from authentication
        auth_header = request.headers.get("Authorization")
        if auth_header:
            # In production, you'd decode the JWT to get user ID
            # For now, use the token as identifier
            return f"user:{hash(auth_header) % 100000}"
        
        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"
    
    def _get_rate_limit_category(self, request: Request) -> str:
        """Determine rate limit category based on request path"""
        
        path = request.url.path
        
        if path.startswith("/generation"):
            return "generation"
        elif path.startswith("/models"):
            return "models"
        elif path.startswith("/health") or path.startswith("/ping"):
            return "health"
        else:
            return "general"

class AdaptiveRateLimit:
    """Adaptive rate limiter that adjusts based on system load"""
    
    def __init__(self):
        self.base_limit = settings.RATE_LIMIT_REQUESTS
        self.current_limit = self.base_limit
        self.load_history = deque(maxlen=100)
        self.last_adjustment = time.time()
    
    def update_system_load(self, cpu_usage: float, memory_usage: float):
        """Update system load metrics"""
        
        # Calculate composite load score
        load_score = (cpu_usage * 0.6) + (memory_usage * 0.4)
        self.load_history.append(load_score)
        
        # Adjust rate limit if needed
        now = time.time()
        if now - self.last_adjustment > 60:  # Adjust every minute
            self._adjust_rate_limit()
            self.last_adjustment = now
    
    def _adjust_rate_limit(self):
        """Adjust rate limit based on system load"""
        
        if not self.load_history:
            return
        
        avg_load = sum(self.load_history) / len(self.load_history)
        
        if avg_load > 0.8:  # High load
            # Reduce rate limit by 20%
            self.current_limit = max(
                int(self.base_limit * 0.5),
                int(self.current_limit * 0.8)
            )
        elif avg_load < 0.4:  # Low load
            # Increase rate limit by 10%
            self.current_limit = min(
                int(self.base_limit * 1.5),
                int(self.current_limit * 1.1)
            )
    
    def get_current_limit(self) -> int:
        """Get current rate limit"""
        return self.current_limit

# Global adaptive rate limiter
adaptive_rate_limit = AdaptiveRateLimit()

class DifferentiatedRateLimit:
    """Different rate limits for different user tiers"""
    
    def __init__(self):
        self.tier_limits = {
            "free": {"requests": 100, "window": 3600},      # 100/hour
            "basic": {"requests": 500, "window": 3600},     # 500/hour
            "premium": {"requests": 2000, "window": 3600},  # 2000/hour
            "enterprise": {"requests": 10000, "window": 3600}, # 10k/hour
            "admin": {"requests": 50000, "window": 3600}    # 50k/hour
        }
        self.user_limiters: Dict[str, SlidingWindowRateLimit] = {}
    
    def get_user_tier(self, user_id: str) -> str:
        """Get user tier (would come from database)"""
        # Mock implementation
        if user_id.startswith("admin"):
            return "admin"
        elif user_id.startswith("enterprise"):
            return "enterprise"
        elif user_id.startswith("premium"):
            return "premium"
        elif user_id.startswith("basic"):
            return "basic"
        else:
            return "free"
    
    def check_rate_limit(self, user_id: str) -> Tuple[bool, Optional[float]]:
        """Check rate limit for user"""
        
        tier = self.get_user_tier(user_id)
        tier_config = self.tier_limits[tier]
        
        # Get or create rate limiter for user
        if user_id not in self.user_limiters:
            self.user_limiters[user_id] = SlidingWindowRateLimit(
                max_requests=tier_config["requests"],
                window_size=tier_config["window"]
            )
        
        return self.user_limiters[user_id].is_allowed(user_id)

# Global differentiated rate limiter
differentiated_rate_limit = DifferentiatedRateLimit()

async def cleanup_rate_limiters():
    """Cleanup old rate limiter data"""
    
    while True:
        try:
            # Clean up old entries every 5 minutes
            await asyncio.sleep(300)
            
            now = time.time()
            
            # Clean up sliding window rate limiters
            for rate_limiter in [
                *list(RateLimitMiddleware(None).rate_limiters.values()),
                *list(differentiated_rate_limit.user_limiters.values())
            ]:
                for identifier in list(rate_limiter.requests.keys()):
                    user_requests = rate_limiter.requests[identifier]
                    window_start = now - rate_limiter.window_size
                    
                    # Remove old requests
                    while user_requests and user_requests[0] <= window_start:
                        user_requests.popleft()
                    
                    # Remove empty deques
                    if not user_requests:
                        del rate_limiter.requests[identifier]
        
        except Exception as e:
            print(f"Error cleaning up rate limiters: {e}")

# Start cleanup task
asyncio.create_task(cleanup_rate_limiters())