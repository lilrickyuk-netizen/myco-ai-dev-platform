"""
Cache management service for AI responses and embeddings
"""

import asyncio
import json
import logging
import hashlib
import time
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import os

try:
    import redis.asyncio as redis
except ImportError:
    redis = None

try:
    import aioredis
except ImportError:
    aioredis = None

logger = logging.getLogger(__name__)

@dataclass
class CacheEntry:
    key: str
    value: Any
    ttl: Optional[int] = None
    created_at: datetime = field(default_factory=datetime.now)
    accessed_at: datetime = field(default_factory=datetime.now)
    access_count: int = 0

class InMemoryCache:
    """Simple in-memory cache implementation"""
    
    def __init__(self, max_size: int = 10000, default_ttl: int = 3600):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.logger = logging.getLogger(__name__)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from cache"""
        if key not in self.cache:
            return None
        
        entry = self.cache[key]
        
        # Check if expired
        if entry.ttl and entry.created_at + timedelta(seconds=entry.ttl) < datetime.now():
            del self.cache[key]
            return None
        
        # Update access stats
        entry.accessed_at = datetime.now()
        entry.access_count += 1
        
        return entry.value
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set a value in cache"""
        # Evict old entries if cache is full
        if len(self.cache) >= self.max_size:
            await self._evict_lru()
        
        entry = CacheEntry(
            key=key,
            value=value,
            ttl=ttl or self.default_ttl
        )
        
        self.cache[key] = entry
        return True
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if key in self.cache:
            del self.cache[key]
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        return key in self.cache
    
    async def clear(self) -> bool:
        """Clear all cache entries"""
        self.cache.clear()
        return True
    
    async def keys(self, pattern: str = "*") -> List[str]:
        """Get all keys matching pattern"""
        if pattern == "*":
            return list(self.cache.keys())
        
        # Simple pattern matching
        import fnmatch
        return [key for key in self.cache.keys() if fnmatch.fnmatch(key, pattern)]
    
    async def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_access = sum(entry.access_count for entry in self.cache.values())
        
        return {
            "type": "in_memory",
            "size": len(self.cache),
            "max_size": self.max_size,
            "total_accesses": total_access,
            "memory_usage_mb": 0  # Not implemented for in-memory
        }
    
    async def _evict_lru(self):
        """Evict least recently used entries"""
        if not self.cache:
            return
        
        # Sort by last accessed time
        entries = sorted(
            self.cache.items(),
            key=lambda x: x[1].accessed_at
        )
        
        # Remove oldest 10% of entries
        remove_count = max(1, len(entries) // 10)
        for i in range(remove_count):
            key, _ = entries[i]
            del self.cache[key]

class RedisCache:
    """Redis-based cache implementation"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379", default_ttl: int = 3600):
        if not redis and not aioredis:
            raise ImportError("redis or aioredis not installed")
        
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self.client = None
        self.logger = logging.getLogger(__name__)
    
    async def connect(self):
        """Connect to Redis"""
        try:
            if redis:
                self.client = redis.from_url(self.redis_url, decode_responses=True)
            elif aioredis:
                self.client = await aioredis.from_url(self.redis_url)
            
            # Test connection
            await self.client.ping()
            self.logger.info("Connected to Redis successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from cache"""
        if not self.client:
            return None
        
        try:
            value = await self.client.get(key)
            if value is None:
                return None
            
            # Try to deserialize JSON
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
                
        except Exception as e:
            self.logger.error(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set a value in cache"""
        if not self.client:
            return False
        
        try:
            # Serialize value
            if isinstance(value, (dict, list)):
                serialized_value = json.dumps(value)
            else:
                serialized_value = str(value)
            
            ttl = ttl or self.default_ttl
            result = await self.client.setex(key, ttl, serialized_value)
            return result is True
            
        except Exception as e:
            self.logger.error(f"Redis set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if not self.client:
            return False
        
        try:
            result = await self.client.delete(key)
            return result > 0
        except Exception as e:
            self.logger.error(f"Redis delete error: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.client:
            return False
        
        try:
            result = await self.client.exists(key)
            return result > 0
        except Exception as e:
            self.logger.error(f"Redis exists error: {e}")
            return False
    
    async def clear(self) -> bool:
        """Clear all cache entries"""
        if not self.client:
            return False
        
        try:
            await self.client.flushdb()
            return True
        except Exception as e:
            self.logger.error(f"Redis clear error: {e}")
            return False
    
    async def keys(self, pattern: str = "*") -> List[str]:
        """Get all keys matching pattern"""
        if not self.client:
            return []
        
        try:
            keys = await self.client.keys(pattern)
            return keys
        except Exception as e:
            self.logger.error(f"Redis keys error: {e}")
            return []
    
    async def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.client:
            return {"type": "redis", "connected": False}
        
        try:
            info = await self.client.info()
            return {
                "type": "redis",
                "connected": True,
                "used_memory": info.get("used_memory", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "connected_clients": info.get("connected_clients", 0),
                "total_commands_processed": info.get("total_commands_processed", 0)
            }
        except Exception as e:
            self.logger.error(f"Redis stats error: {e}")
            return {"type": "redis", "connected": False, "error": str(e)}

class CacheManager:
    """Main cache manager"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.cache = None
        self.initialized = False
        
        # Cache prefixes for different data types
        self.prefixes = {
            "llm_response": "llm:resp:",
            "embedding": "embed:",
            "code_generation": "code:gen:",
            "agent_result": "agent:result:",
            "user_session": "user:session:",
            "project_data": "project:"
        }
    
    async def initialize(self):
        """Initialize the cache manager"""
        self.logger.info("Initializing Cache Manager...")
        
        # Try Redis first
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        if redis or aioredis:
            try:
                self.cache = RedisCache(redis_url)
                await self.cache.connect()
                self.logger.info("Using Redis cache")
            except Exception as e:
                self.logger.warning(f"Failed to initialize Redis cache: {e}")
                self.cache = None
        
        # Fallback to in-memory cache
        if not self.cache:
            self.cache = InMemoryCache()
            self.logger.info("Using in-memory cache")
        
        self.initialized = True
        self.logger.info("Cache Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup cache manager"""
        self.logger.info("Shutting down Cache Manager...")
        
        if isinstance(self.cache, RedisCache):
            await self.cache.disconnect()
        
        self.initialized = False
        self.logger.info("Cache Manager shutdown complete")
    
    def _generate_key(self, prefix: str, *args: str) -> str:
        """Generate a cache key"""
        key_parts = [prefix] + list(args)
        key = ":".join(str(part) for part in key_parts)
        return hashlib.sha256(key.encode()).hexdigest()[:16]
    
    async def cache_llm_response(
        self,
        prompt: str,
        provider: str,
        model: str,
        response: Any,
        ttl: int = 3600
    ) -> str:
        """Cache an LLM response"""
        key = self._generate_key(
            self.prefixes["llm_response"],
            prompt,
            provider,
            model
        )
        
        cache_data = {
            "prompt": prompt,
            "provider": provider,
            "model": model,
            "response": response,
            "cached_at": datetime.now().isoformat()
        }
        
        await self.cache.set(key, cache_data, ttl)
        return key
    
    async def get_llm_response(
        self,
        prompt: str,
        provider: str,
        model: str
    ) -> Optional[Any]:
        """Get cached LLM response"""
        key = self._generate_key(
            self.prefixes["llm_response"],
            prompt,
            provider,
            model
        )
        
        cached_data = await self.cache.get(key)
        if cached_data:
            self.logger.info(f"Cache hit for LLM response: {key}")
            return cached_data.get("response")
        
        return None
    
    async def cache_embedding(
        self,
        text: str,
        model: str,
        embedding: List[float],
        ttl: int = 86400  # 24 hours
    ) -> str:
        """Cache an embedding"""
        key = self._generate_key(
            self.prefixes["embedding"],
            text,
            model
        )
        
        cache_data = {
            "text": text,
            "model": model,
            "embedding": embedding,
            "cached_at": datetime.now().isoformat()
        }
        
        await self.cache.set(key, cache_data, ttl)
        return key
    
    async def get_embedding(
        self,
        text: str,
        model: str
    ) -> Optional[List[float]]:
        """Get cached embedding"""
        key = self._generate_key(
            self.prefixes["embedding"],
            text,
            model
        )
        
        cached_data = await self.cache.get(key)
        if cached_data:
            self.logger.info(f"Cache hit for embedding: {key}")
            return cached_data.get("embedding")
        
        return None
    
    async def cache_code_generation(
        self,
        description: str,
        language: str,
        framework: str,
        code: str,
        ttl: int = 7200  # 2 hours
    ) -> str:
        """Cache generated code"""
        key = self._generate_key(
            self.prefixes["code_generation"],
            description,
            language,
            framework
        )
        
        cache_data = {
            "description": description,
            "language": language,
            "framework": framework,
            "code": code,
            "cached_at": datetime.now().isoformat()
        }
        
        await self.cache.set(key, cache_data, ttl)
        return key
    
    async def get_code_generation(
        self,
        description: str,
        language: str,
        framework: str
    ) -> Optional[str]:
        """Get cached generated code"""
        key = self._generate_key(
            self.prefixes["code_generation"],
            description,
            language,
            framework
        )
        
        cached_data = await self.cache.get(key)
        if cached_data:
            self.logger.info(f"Cache hit for code generation: {key}")
            return cached_data.get("code")
        
        return None
    
    async def cache_agent_result(
        self,
        agent_type: str,
        task_type: str,
        input_hash: str,
        result: Any,
        ttl: int = 1800  # 30 minutes
    ) -> str:
        """Cache agent execution result"""
        key = self._generate_key(
            self.prefixes["agent_result"],
            agent_type,
            task_type,
            input_hash
        )
        
        cache_data = {
            "agent_type": agent_type,
            "task_type": task_type,
            "input_hash": input_hash,
            "result": result,
            "cached_at": datetime.now().isoformat()
        }
        
        await self.cache.set(key, cache_data, ttl)
        return key
    
    async def get_agent_result(
        self,
        agent_type: str,
        task_type: str,
        input_hash: str
    ) -> Optional[Any]:
        """Get cached agent result"""
        key = self._generate_key(
            self.prefixes["agent_result"],
            agent_type,
            task_type,
            input_hash
        )
        
        cached_data = await self.cache.get(key)
        if cached_data:
            self.logger.info(f"Cache hit for agent result: {key}")
            return cached_data.get("result")
        
        return None
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        keys = await self.cache.keys(pattern)
        count = 0
        
        for key in keys:
            if await self.cache.delete(key):
                count += 1
        
        self.logger.info(f"Invalidated {count} cache entries matching pattern: {pattern}")
        return count
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.initialized or not self.cache:
            return {"initialized": False}
        
        stats = await self.cache.stats()
        stats["initialized"] = True
        
        # Add prefix statistics
        prefix_stats = {}
        for prefix_name, prefix in self.prefixes.items():
            keys = await self.cache.keys(f"{prefix}*")
            prefix_stats[prefix_name] = len(keys)
        
        stats["prefix_counts"] = prefix_stats
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """Check cache health"""
        if not self.initialized:
            return {"status": "not_initialized"}
        
        try:
            # Test basic operations
            test_key = "health_check_test"
            test_value = {"timestamp": time.time()}
            
            # Set test value
            set_success = await self.cache.set(test_key, test_value, 60)
            
            # Get test value
            retrieved_value = await self.cache.get(test_key)
            
            # Delete test value
            delete_success = await self.cache.delete(test_key)
            
            return {
                "status": "healthy" if set_success and retrieved_value and delete_success else "degraded",
                "operations": {
                    "set": set_success,
                    "get": retrieved_value is not None,
                    "delete": delete_success
                },
                "cache_type": type(self.cache).__name__
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "cache_type": type(self.cache).__name__
            }

# Global instance
cache_manager = CacheManager()