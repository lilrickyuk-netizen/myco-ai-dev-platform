"""
Authentication middleware for the AI Engine
"""

import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
import time

from ..core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

class AuthMiddleware(BaseHTTPMiddleware):
    """Authentication middleware"""
    
    async def dispatch(self, request: Request, call_next):
        # Skip auth for health endpoints and docs
        if request.url.path in ["/health", "/health/ping", "/health/live", "/health/ready", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # In development mode, skip auth if disabled
        if not settings.ENABLE_AUTH and settings.DEBUG:
            # Add a fake user for development
            request.state.user = {
                "user_id": "dev-user",
                "email": "dev@example.com",
                "name": "Development User"
            }
            return await call_next(request)
        
        # Check for API key authentication first
        api_key = request.headers.get("X-API-Key")
        if api_key and api_key in settings.ALLOWED_API_KEYS:
            request.state.user = {
                "user_id": f"api-key-{api_key[:8]}",
                "api_key": True
            }
            return await call_next(request)
        
        # Check for JWT token
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        token = auth_header.split(" ")[1]
        try:
            user = await verify_jwt_token(token)
            request.state.user = user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
        
        return await call_next(request)

async def verify_jwt_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return user info"""
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check expiration
        exp = payload.get("exp")
        if exp and exp < time.time():
            raise HTTPException(status_code=401, detail="Token expired")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "name": payload.get("name"),
            "roles": payload.get("roles", []),
            "exp": exp
        }
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """Get current authenticated user"""
    
    # If user is already set by middleware, return it
    if hasattr(request.state, "user"):
        return request.state.user
    
    # In development mode, return a fake user if auth is disabled
    if not settings.ENABLE_AUTH and settings.DEBUG:
        return {
            "user_id": "dev-user",
            "email": "dev@example.com",
            "name": "Development User"
        }
    
    # Check for API key in headers
    api_key = request.headers.get("X-API-Key")
    if api_key and api_key in settings.ALLOWED_API_KEYS:
        return {
            "user_id": f"api-key-{api_key[:8]}",
            "api_key": True
        }
    
    # Require JWT token
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    return await verify_jwt_token(credentials.credentials)

async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, otherwise return None"""
    
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None

def require_roles(required_roles: list):
    """Decorator to require specific roles"""
    
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get current user from kwargs
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            user_roles = current_user.get("roles", [])
            if not any(role in user_roles for role in required_roles):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def create_jwt_token(user_data: Dict[str, Any]) -> str:
    """Create a JWT token for a user"""
    
    payload = {
        "sub": user_data["user_id"],
        "email": user_data.get("email"),
        "name": user_data.get("name"),
        "roles": user_data.get("roles", []),
        "iat": int(time.time()),
        "exp": int(time.time()) + (settings.JWT_EXPIRATION_HOURS * 3600)
    }
    
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)