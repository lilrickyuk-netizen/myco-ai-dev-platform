"""
Authentication middleware for AI Engine
"""

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import time
from typing import Optional, Dict, Any

from ..core.config import settings

security = HTTPBearer()

class AuthMiddleware:
    """Authentication middleware"""
    
    def __init__(self):
        self.jwt_secret = settings.JWT_SECRET_KEY
        self.jwt_algorithm = settings.JWT_ALGORITHM
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(
                token, 
                self.jwt_secret, 
                algorithms=[self.jwt_algorithm]
            )
            
            # Check expiration
            if payload.get("exp", 0) < time.time():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired"
                )
            
            return payload
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    def verify_api_key(self, api_key: str) -> bool:
        """Verify API key"""
        if not settings.ENABLE_AUTH:
            return True
        
        # Check against allowed API keys
        if settings.ALLOWED_API_KEYS and api_key in settings.ALLOWED_API_KEYS:
            return True
        
        # For development, allow a default key
        if settings.DEBUG and api_key == "dev-key":
            return True
        
        return False

auth_middleware = AuthMiddleware()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current authenticated user"""
    
    if not settings.ENABLE_AUTH:
        # Return mock user for development
        return {
            "user_id": "dev-user",
            "email": "dev@example.com",
            "is_authenticated": True
        }
    
    token = credentials.credentials
    
    # Check if it's an API key format (simple string) or JWT
    if token.startswith("sk-") or token == "dev-key":
        # API key authentication
        if auth_middleware.verify_api_key(token):
            return {
                "user_id": f"api-key-user-{hash(token) % 10000}",
                "email": "api@example.com",
                "is_authenticated": True,
                "auth_type": "api_key"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
    else:
        # JWT authentication
        payload = auth_middleware.verify_token(token)
        return {
            "user_id": payload.get("sub", "unknown"),
            "email": payload.get("email", "unknown@example.com"),
            "is_authenticated": True,
            "auth_type": "jwt",
            "payload": payload
        }

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, otherwise None"""
    
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Require admin privileges"""
    
    # Check if user has admin role
    if current_user.get("auth_type") == "api_key":
        # API key users have admin access
        return current_user
    
    # Check JWT payload for admin role
    payload = current_user.get("payload", {})
    roles = payload.get("roles", [])
    
    if "admin" not in roles and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user

class RateLimitedAuth:
    """Rate-limited authentication to prevent brute force attacks"""
    
    def __init__(self):
        self.failed_attempts: Dict[str, list] = {}
        self.max_attempts = 10
        self.window_size = 300  # 5 minutes
    
    def is_rate_limited(self, identifier: str) -> bool:
        """Check if identifier is rate limited"""
        now = time.time()
        
        if identifier not in self.failed_attempts:
            return False
        
        # Clean old attempts
        self.failed_attempts[identifier] = [
            attempt_time for attempt_time in self.failed_attempts[identifier]
            if now - attempt_time < self.window_size
        ]
        
        # Check if over limit
        return len(self.failed_attempts[identifier]) >= self.max_attempts
    
    def record_failed_attempt(self, identifier: str):
        """Record a failed authentication attempt"""
        now = time.time()
        
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = []
        
        self.failed_attempts[identifier].append(now)

rate_limited_auth = RateLimitedAuth()

async def rate_limited_get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current user with rate limiting"""
    
    # Use IP address as identifier (in production, get from request)
    identifier = "default-ip"  # This would be extracted from request.client.host
    
    if rate_limited_auth.is_rate_limited(identifier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed authentication attempts. Try again later."
        )
    
    try:
        return await get_current_user(credentials)
    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            rate_limited_auth.record_failed_attempt(identifier)
        raise

# Mock authentication for development
async def mock_auth() -> Dict[str, Any]:
    """Mock authentication for testing"""
    return {
        "user_id": "mock-user-123",
        "email": "mock@example.com",
        "is_authenticated": True,
        "auth_type": "mock"
    }