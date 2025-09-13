"""
Authentication middleware and utilities
"""

import jwt
import bcrypt
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..core.config import settings
from ..core.exceptions import AuthenticationError

# Authentication middleware
security = HTTPBearer()

class AuthMiddleware:
    """Authentication middleware for FastAPI"""
    
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.expiration_hours = settings.JWT_EXPIRATION_HOURS
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=self.expiration_hours)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": "myco-platform"
        })
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        
        return encoded_jwt
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm],
                issuer="myco-platform"
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")
        except jwt.InvalidIssuerError:
            raise AuthenticationError("Invalid token issuer")
    
    async def get_current_user(
        self, 
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> Dict[str, Any]:
        """Get current user from JWT token"""
        
        if not settings.ENABLE_AUTH:
            # Return mock user for development only
            return {
                "id": "dev-user",
                "email": "dev@example.com",
                "role": "admin",
                "permissions": ["*"]
            }
        
        try:
            payload = self.verify_token(credentials.credentials)
            
            user_id = payload.get("sub")
            if not user_id:
                raise AuthenticationError("Invalid token payload")
            
            # Validate user still exists and is active
            user_data = await self.validate_user_active(user_id)
            
            return {
                "id": user_id,
                "email": payload.get("email"),
                "role": payload.get("role", "user"),
                "permissions": payload.get("permissions", []),
                "active": user_data.get("active", True)
            }
            
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def validate_user_active(self, user_id: str) -> Dict[str, Any]:
        """Validate that a user is still active"""
        # In a real implementation, this would check a user database
        # For now, assume all users are active
        return {"active": True}
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    async def authenticate_with_oauth(self, provider: str, code: str) -> Dict[str, Any]:
        """Authenticate user with OAuth provider"""
        if provider == "github":
            return await self.authenticate_github(code)
        elif provider == "google":
            return await self.authenticate_google(code)
        else:
            raise AuthenticationError(f"Unsupported OAuth provider: {provider}")
    
    async def authenticate_github(self, code: str) -> Dict[str, Any]:
        """Authenticate with GitHub OAuth"""
        if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
            raise AuthenticationError("GitHub OAuth not configured")
        
        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code
                },
                headers={"Accept": "application/json"}
            )
            
            if token_response.status_code != 200:
                raise AuthenticationError("Failed to exchange code for token")
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise AuthenticationError("No access token received")
            
            # Get user info
            user_response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise AuthenticationError("Failed to get user info")
            
            user_data = user_response.json()
            
            return {
                "id": str(user_data["id"]),
                "email": user_data.get("email"),
                "name": user_data.get("name"),
                "avatar_url": user_data.get("avatar_url"),
                "provider": "github"
            }
    
    async def authenticate_google(self, code: str) -> Dict[str, Any]:
        """Authenticate with Google OAuth"""
        if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
            raise AuthenticationError("Google OAuth not configured")
        
        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": "postmessage"  # For web applications
                }
            )
            
            if token_response.status_code != 200:
                raise AuthenticationError("Failed to exchange code for token")
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise AuthenticationError("No access token received")
            
            # Get user info
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise AuthenticationError("Failed to get user info")
            
            user_data = user_response.json()
            
            return {
                "id": user_data["id"],
                "email": user_data.get("email"),
                "name": user_data.get("name"),
                "avatar_url": user_data.get("picture"),
                "provider": "google"
            }
    
    def create_user_token(self, user_data: Dict[str, Any]) -> str:
        """Create a JWT token for authenticated user"""
        token_data = {
            "sub": user_data["id"],
            "email": user_data.get("email"),
            "name": user_data.get("name"),
            "role": "user",  # Default role
            "permissions": ["read", "write"],  # Default permissions
            "provider": user_data.get("provider", "local")
        }
        
        return self.create_access_token(token_data)

# Global auth middleware instance
auth_middleware = AuthMiddleware()

# Convenience functions
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    return auth_middleware.create_access_token(data, expires_delta)

def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode a JWT token"""
    return auth_middleware.verify_token(token)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current user from JWT token"""
    return await auth_middleware.get_current_user(credentials)

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return auth_middleware.hash_password(password)

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return auth_middleware.verify_password(password, hashed_password)

async def authenticate_with_oauth(provider: str, code: str) -> Dict[str, Any]:
    """Authenticate user with OAuth provider"""
    return await auth_middleware.authenticate_with_oauth(provider, code)

def create_user_token(user_data: Dict[str, Any]) -> str:
    """Create a JWT token for authenticated user"""
    return auth_middleware.create_user_token(user_data)