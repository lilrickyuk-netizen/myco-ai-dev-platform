"""
Cache Manager - Handles caching for AI responses and embeddings
"""

import asyncio
import json
import hashlib
import logging
import time
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

# Cache backend imports
try:
    import redis.asyncio as redis
except ImportError:
    redis = None

try:
    import pymongo
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    pymongo = None
    AsyncIOMotorClient = None

from ..core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class CacheEntry:
    key: str
    value: Any
    expires_at: Optional[float] = None
    created_at: float = None
    access_count: int = 0
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()

class CacheBackend(ABC):
    """Abstract base class for cache backends"""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value with optional TTL"""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete key"""
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        pass
    
    @abstractmethod
    async def clear(self) -> None:
        """Clear all cache entries"""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check cache backend health"""
        pass

class MemoryCache(CacheBackend):
    """In-memory cache implementation"""
    
    def __init__(self, max_size: int = 1000):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        async with self._lock:
            entry = self.cache.get(key)
            if not entry:
                return None
            
            # Check expiration
            if entry.expires_at and time.time() > entry.expires_at:
                del self.cache[key]
                return None
            
            # Update access count
            entry.access_count += 1
            return entry.value
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value with optional TTL"""
        async with self._lock:
            # Evict entries if cache is full
            if len(self.cache) >= self.max_size:
                await self._evict_lru()
            
            expires_at = None
            if ttl:
                expires_at = time.time() + ttl
            
            self.cache[key] = CacheEntry(
                key=key,
                value=value,
                expires_at=expires_at
            )
    
    async def delete(self, key: str) -> None:
        """Delete key"""
        async with self._lock:
            self.cache.pop(key, None)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        return key in self.cache
    
    async def clear(self) -> None:
        """Clear all cache entries"""
        async with self._lock:
            self.cache.clear()
    
    async def _evict_lru(self) -> None:
        """Evict least recently used entry"""
        if not self.cache:
            return
        
        # Find entry with lowest access count and oldest creation time
        lru_key = min(
            self.cache.keys(),
            key=lambda k: (self.cache[k].access_count, self.cache[k].created_at)
        )
        del self.cache[lru_key]
    
    async def health_check(self) -> Dict[str, Any]:
        """Check memory cache health"""
        return {
            "status": "healthy",
            "backend": "memory",
            "size": len(self.cache),
            "max_size": self.max_size
        }

class RedisCache(CacheBackend):
    """Redis cache implementation"""
    
    def __init__(self, redis_url: str):
        if redis is None:
            raise ImportError("redis not installed")
        
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
    
    async def _get_client(self) -> redis.Redis:
        """Get Redis client, creating if necessary"""
        if not self.redis_client:
            self.redis_client = redis.from_url(self.redis_url)
        return self.redis_client
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        try:
            client = await self._get_client()
            value = await client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value with optional TTL"""
        try:
            client = await self._get_client()
            serialized = json.dumps(value, default=str)
            
            if ttl:
                await client.setex(key, ttl, serialized)
            else:
                await client.set(key, serialized)
        except Exception as e:
            logger.error(f"Redis set error: {e}")
    
    async def delete(self, key: str) -> None:
        """Delete key"""
        try:
            client = await self._get_client()
            await client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        try:
            client = await self._get_client()
            return bool(await client.exists(key))
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False
    
    async def clear(self) -> None:
        """Clear all cache entries"""
        try:
            client = await self._get_client()
            await client.flushdb()
        except Exception as e:
            logger.error(f"Redis clear error: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Redis health"""
        try:
            client = await self._get_client()
            await client.ping()
            info = await client.info()
            
            return {
                "status": "healthy",
                "backend": "redis",
                "memory_usage": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "backend": "redis",
                "error": str(e)
            }

class CacheManager:
    """Manages caching for AI responses and embeddings"""
    
    def __init__(self):
        self.backend: Optional[CacheBackend] = None
        self.default_ttl = settings.CACHE_TTL
        self._initialize_backend()
    
    def _initialize_backend(self):
        """Initialize cache backend"""
        
        # Try Redis first
        if redis and settings.REDIS_URL:
            try:
                self.backend = RedisCache(settings.REDIS_URL)
                logger.info("Initialized Redis cache backend")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize Redis cache: {e}")
        
        # Fallback to memory cache
        self.backend = MemoryCache(max_size=settings.CACHE_MAX_SIZE)
        logger.info("Initialized memory cache backend")
    
    async def initialize(self):
        """Initialize the cache manager"""
        logger.info("Cache manager initialized")
    
    async def cleanup(self):
        """Cleanup cache resources"""
        if hasattr(self.backend, 'redis_client') and self.backend.redis_client:
            await self.backend.redis_client.close()
        logger.info("Cache manager cleaned up")
    
    def _generate_key(self, namespace: str, data: Union[str, Dict[str, Any]]) -> str:
        """Generate cache key from data"""
        if isinstance(data, str):
            content = data
        else:
            content = json.dumps(data, sort_keys=True, default=str)
        
        hash_obj = hashlib.sha256(content.encode())
        return f"{namespace}:{hash_obj.hexdigest()[:16]}"
    
    async def get_llm_response(
        self,
        prompt: str,
        context: Optional[str] = None,
        provider: str = "openai",
        model: str = "gpt-4"
    ) -> Optional[Dict[str, Any]]:
        """Get cached LLM response"""
        
        cache_data = {
            "prompt": prompt,
            "context": context,
            "provider": provider,
            "model": model
        }
        
        key = self._generate_key("llm_response", cache_data)
        return await self.backend.get(key)
    
    async def set_llm_response(
        self,
        prompt: str,
        response: Dict[str, Any],
        context: Optional[str] = None,
        provider: str = "openai",
        model: str = "gpt-4",
        ttl: Optional[int] = None
    ) -> None:
        """Cache LLM response"""
        
        cache_data = {
            "prompt": prompt,
            "context": context,
            "provider": provider,
            "model": model
        }
        
        key = self._generate_key("llm_response", cache_data)
        await self.backend.set(key, response, ttl or self.default_ttl)
    
    async def get_embedding(self, text: str, model: str = "text-embedding-ada-002") -> Optional[List[float]]:
        """Get cached embedding"""
        
        cache_data = {
            "text": text,
            "model": model
        }
        
        key = self._generate_key("embedding", cache_data)
        return await self.backend.get(key)
    
    async def set_embedding(
        self,
        text: str,
        embedding: List[float],
        model: str = "text-embedding-ada-002",
        ttl: Optional[int] = None
    ) -> None:
        """Cache embedding"""
        
        cache_data = {
            "text": text,
            "model": model
        }
        
        key = self._generate_key("embedding", cache_data)
        await self.backend.set(key, embedding, ttl or self.default_ttl)
    
    async def get_code_generation(
        self,
        description: str,
        language: str,
        framework: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached code generation result"""
        
        cache_data = {
            "description": description,
            "language": language,
            "framework": framework
        }
        
        key = self._generate_key("code_generation", cache_data)
        return await self.backend.get(key)
    
    async def set_code_generation(
        self,
        description: str,
        result: Dict[str, Any],
        language: str,
        framework: Optional[str] = None,
        ttl: Optional[int] = None
    ) -> None:
        """Cache code generation result"""
        
        cache_data = {
            "description": description,
            "language": language,
            "framework": framework
        }
        
        key = self._generate_key("code_generation", cache_data)
        await self.backend.set(key, result, ttl or self.default_ttl)
    
    async def get_agent_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get cached agent session data"""
        key = f"agent_session:{session_id}"
        return await self.backend.get(key)
    
    async def set_agent_session(
        self,
        session_id: str,
        session_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> None:
        """Cache agent session data"""
        key = f"agent_session:{session_id}"
        await self.backend.set(key, session_data, ttl or self.default_ttl)
    
    async def invalidate_pattern(self, pattern: str) -> None:
        """Invalidate cache entries matching pattern"""
        # This is a simplified implementation
        # In production, you might want to use Redis SCAN for pattern matching
        logger.info(f"Invalidating cache pattern: {pattern}")
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        
        if isinstance(self.backend, MemoryCache):
            return {
                "backend": "memory",
                "size": len(self.backend.cache),
                "max_size": self.backend.max_size
            }
        elif isinstance(self.backend, RedisCache):
            return await self.backend.health_check()
        else:
            return {"backend": "unknown"}
    
    async def clear_cache(self) -> None:
        """Clear all cache entries"""
        await self.backend.clear()
        logger.info("Cache cleared")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check cache health"""
        if self.backend:
            return await self.backend.health_check()
        else:
            return {
                "status": "unhealthy",
                "error": "No cache backend initialized"
            }

# Global instance
cache_manager = CacheManager()