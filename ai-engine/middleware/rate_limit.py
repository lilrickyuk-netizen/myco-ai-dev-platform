"""
Rate limiting middleware for the AI Engine
"""

import time
import logging
from typing import Dict, Optional
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio
from collections import defaultdict, deque

from ..core.config import settings

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using sliding window algorithm"""
    
    def __init__(self, app, requests_per_window: int = None, window_seconds: int = None):
        super().__init__(app)
        self.requests_per_window = requests_per_window or settings.RATE_LIMIT_REQUESTS
        self.window_seconds = window_seconds or settings.RATE_LIMIT_WINDOW
        self.user_requests: Dict[str, deque] = defaultdict(deque)
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        self.last_cleanup = time.time()
        
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health endpoints
        if request.url.path.startswith("/health"):
            return await call_next(request)
        
        # Get user identifier
        user_id = await self._get_user_identifier(request)
        
        # Check rate limit
        if await self._is_rate_limited(user_id):
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {self.requests_per_window} requests per {self.window_seconds} seconds",
                headers={"Retry-After": str(self.window_seconds)}
            )
        
        # Record the request
        await self._record_request(user_id)
        
        # Cleanup old entries periodically
        await self._periodic_cleanup()
        
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = await self._get_remaining_requests(user_id)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_window)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(self.window_seconds)
        
        return response
    
    async def _get_user_identifier(self, request: Request) -> str:
        """Get user identifier for rate limiting"""
        
        # Try to get user from request state (set by auth middleware)
        if hasattr(request.state, "user") and request.state.user:
            return request.state.user.get("user_id", "anonymous")
        
        # Try to get from authorization header
        auth_header = request.headers.get("authorization")
        if auth_header:
            return f"auth_{hash(auth_header) % 1000000}"
        
        # Try to get from API key
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"api_{api_key[:8]}"
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        forwarded_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        return forwarded_ip or client_ip
    
    async def _is_rate_limited(self, user_id: str) -> bool:
        """Check if user has exceeded rate limit"""
        
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        # Get user's request queue
        user_queue = self.user_requests[user_id]
        
        # Remove requests outside the current window
        while user_queue and user_queue[0] < window_start:
            user_queue.popleft()
        
        # Check if user has exceeded the limit
        return len(user_queue) >= self.requests_per_window
    
    async def _record_request(self, user_id: str) -> None:
        """Record a request for the user"""
        
        current_time = time.time()
        self.user_requests[user_id].append(current_time)
    
    async def _get_remaining_requests(self, user_id: str) -> int:
        """Get remaining requests for the user"""
        
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        # Get user's request queue
        user_queue = self.user_requests[user_id]
        
        # Remove requests outside the current window
        while user_queue and user_queue[0] < window_start:
            user_queue.popleft()
        
        return max(0, self.requests_per_window - len(user_queue))
    
    async def _periodic_cleanup(self) -> None:
        """Clean up old entries to prevent memory leaks"""
        
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        self.last_cleanup = current_time
        window_start = current_time - self.window_seconds
        
        # Clean up users with no recent requests
        users_to_remove = []
        for user_id, user_queue in self.user_requests.items():
            # Remove old requests
            while user_queue and user_queue[0] < window_start:
                user_queue.popleft()
            
            # If no requests in the current window, mark for removal
            if not user_queue:
                users_to_remove.append(user_id)
        
        # Remove users with no recent activity
        for user_id in users_to_remove:
            del self.user_requests[user_id]
        
        if users_to_remove:
            logger.info(f"Cleaned up {len(users_to_remove)} inactive users from rate limiter")

class TokenBucketRateLimiter:
    """Token bucket rate limiter for specific endpoints"""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.buckets: Dict[str, Dict] = {}
        
    async def is_allowed(self, user_id: str) -> bool:
        """Check if request is allowed under token bucket algorithm"""
        
        current_time = time.time()
        
        if user_id not in self.buckets:
            self.buckets[user_id] = {
                "tokens": self.capacity,
                "last_refill": current_time
            }
        
        bucket = self.buckets[user_id]
        
        # Calculate tokens to add based on time elapsed
        time_elapsed = current_time - bucket["last_refill"]
        tokens_to_add = time_elapsed * self.refill_rate
        
        # Update bucket
        bucket["tokens"] = min(self.capacity, bucket["tokens"] + tokens_to_add)
        bucket["last_refill"] = current_time
        
        # Check if we can consume a token
        if bucket["tokens"] >= 1:
            bucket["tokens"] -= 1
            return True
        
        return False

# Global rate limiters for specific operations
llm_generation_limiter = TokenBucketRateLimiter(capacity=10, refill_rate=0.1)  # 1 token per 10 seconds
agent_session_limiter = TokenBucketRateLimiter(capacity=5, refill_rate=0.02)   # 1 token per 50 seconds

async def check_llm_generation_rate_limit(user_id: str) -> bool:
    """Check rate limit for LLM generation requests"""
    return await llm_generation_limiter.is_allowed(user_id)

async def check_agent_session_rate_limit(user_id: str) -> bool:
    """Check rate limit for agent session creation"""
    return await agent_session_limiter.is_allowed(user_id)