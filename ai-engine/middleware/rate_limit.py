"""
Rate limiting middleware
"""

from fastapi import Request, HTTPException
from typing import Dict, Any
import time
import asyncio
from collections import defaultdict, deque

from ..core.config import settings

class RateLimitMiddleware:
    """Rate limiting middleware using sliding window algorithm"""
    
    def __init__(self):
        self.requests: Dict[str, deque] = defaultdict(lambda: deque())
        self.window_size = settings.RATE_LIMIT_WINDOW
        self.max_requests = settings.RATE_LIMIT_REQUESTS
        self.cleanup_interval = 300  # 5 minutes
        self.last_cleanup = time.time()
    
    async def __call__(self, request: Request, call_next):
        """Process rate limiting for requests"""
        
        # Skip rate limiting for health checks
        if request.url.path.startswith("/health"):
            response = await call_next(request)
            return response
        
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Check rate limit
        if not self._is_allowed(client_id):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(self.window_size)}
            )
        
        # Record request
        self._record_request(client_id)
        
        # Cleanup old entries periodically
        await self._periodic_cleanup()
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = self._get_remaining_requests(client_id)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(self.window_size)
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier"""
        
        # Try to get user ID from token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                # This is a simplified approach - in production you'd decode the JWT
                token = auth_header.replace("Bearer ", "")
                return f"user:{hash(token) % 10000}"
            except:
                pass
        
        # Try API key
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"api:{hash(api_key) % 10000}"
        
        # Fall back to IP address
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = getattr(request.client, "host", "unknown")
        
        return f"ip:{ip}"
    
    def _is_allowed(self, client_id: str) -> bool:
        """Check if client is allowed to make request"""
        
        current_time = time.time()
        requests = self.requests[client_id]
        
        # Remove old requests outside the window
        while requests and current_time - requests[0] > self.window_size:
            requests.popleft()
        
        # Check if under limit
        return len(requests) < self.max_requests
    
    def _record_request(self, client_id: str):
        """Record a new request"""
        self.requests[client_id].append(time.time())
    
    def _get_remaining_requests(self, client_id: str) -> int:
        """Get remaining requests for client"""
        current_requests = len(self.requests[client_id])
        return max(0, self.max_requests - current_requests)
    
    async def _periodic_cleanup(self):
        """Periodically cleanup old rate limit data"""
        
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        # Remove empty and old client entries
        clients_to_remove = []
        for client_id, requests in self.requests.items():
            # Remove old requests
            while requests and current_time - requests[0] > self.window_size * 2:
                requests.popleft()
            
            # Mark empty clients for removal
            if not requests:
                clients_to_remove.append(client_id)
        
        # Remove empty clients
        for client_id in clients_to_remove:
            del self.requests[client_id]
        
        self.last_cleanup = current_time

class IPBasedRateLimit:
    """Simple IP-based rate limiting"""
    
    def __init__(self, max_requests: int = 100, window_minutes: int = 1):
        self.max_requests = max_requests
        self.window_seconds = window_minutes * 60
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_allowed(self, ip: str) -> bool:
        """Check if IP is allowed to make request"""
        
        current_time = time.time()
        ip_requests = self.requests[ip]
        
        # Remove old requests
        self.requests[ip] = [
            req_time for req_time in ip_requests
            if current_time - req_time < self.window_seconds
        ]
        
        # Check limit
        if len(self.requests[ip]) >= self.max_requests:
            return False
        
        # Record request
        self.requests[ip].append(current_time)
        return True

# Global rate limiter instance
rate_limiter = RateLimitMiddleware()