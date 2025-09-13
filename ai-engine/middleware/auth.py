"""
Authentication middleware and utilities
"""

from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Dict, Any, Optional
import time

from ..core.config import settings
from ..core.exceptions import AuthenticationError

security = HTTPBearer()

class AuthMiddleware:
    """Authentication middleware for FastAPI"""
    
    def __init__(self):
        self.secret_key = settings.JWT_SECRET
        self.algorithm = settings.JWT_ALGORITHM
    
    async def __call__(self, request: Request, call_next):
        """Process authentication for requests"""
        
        # Skip authentication for health checks and docs
        if request.url.path in ["/health", "/health/", "/docs", "/redoc", "/openapi.json"]:
            response = await call_next(request)
            return response
        
        # Check if authentication is enabled
        if not settings.ENABLE_AUTH:
            response = await call_next(request)
            return response
        
        # Check for API key authentication
        api_key = request.headers.get("X-API-Key")
        if api_key and api_key in settings.ALLOWED_API_KEYS:
            response = await call_next(request)
            return response
        
        # Process request
        response = await call_next(request)
        return response

def verify_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check expiration
        exp = payload.get("exp")
        if exp and exp < time.time():
            raise AuthenticationError("Token has expired")
        
        return payload
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {str(e)}")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current user from JWT token"""
    
    if not settings.ENABLE_AUTH:
        # Return mock user for development
        return {
            "id": "dev-user",
            "email": "dev@example.com",
            "role": "admin"
        }
    
    try:
        payload = verify_token(credentials.credentials)
        
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("Invalid token payload")
        
        return {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "user"),
            "permissions": payload.get("permissions", [])
        }
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")

def get_optional_user(
    request: Request
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, otherwise return None"""
    
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.replace("Bearer ", "")
        payload = verify_token(token)
        
        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "role": payload.get("role", "user")
        }
    except:
        return None

def require_role(required_role: str):
    """Decorator to require specific role"""
    def decorator(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role", "user")
        
        # Define role hierarchy
        role_hierarchy = {
            "user": 1,
            "admin": 2,
            "superuser": 3
        }
        
        required_level = role_hierarchy.get(required_role, 0)
        user_level = role_hierarchy.get(user_role, 0)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required role: {required_role}"
            )
        
        return current_user
    
    return decorator

def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(current_user: Dict[str, Any] = Depends(get_current_user)):
        permissions = current_user.get("permissions", [])
        
        if permission not in permissions and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=403,
                detail=f"Missing required permission: {permission}"
            )
        
        return current_user
    
    return decorator

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[int] = None
) -> str:
    """Create JWT access token"""
    
    to_encode = data.copy()
    
    if expires_delta:
        expire = time.time() + expires_delta
    else:
        expire = time.time() + (settings.JWT_EXPIRE_MINUTES * 60)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt