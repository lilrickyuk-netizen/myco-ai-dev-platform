"""
Cache Manager - Handles caching for improved performance
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
import hashlib

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.redis_client: Optional[redis.Redis] = None
        self.memory_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "errors": 0
        }
        self.max_memory_cache_size = 1000
        self.default_ttl = 3600  # 1 hour
    
    async def initialize(self):
        """Initialize the cache manager"""
        self.logger.info("Initializing Cache Manager...")
        
        # Try to connect to Redis if available
        if REDIS_AVAILABLE:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/1")
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                await self.redis_client.ping()
                self.logger.info(f"Connected to Redis at {redis_url}")
            except Exception as e:
                self.logger.warning(f"Could not connect to Redis: {e}. Using memory cache only.")
                self.redis_client = None
        else:
            self.logger.warning("Redis not available. Using memory cache only.")
        
        self.logger.info("Cache Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.logger.info("Cleaning up Cache Manager...")
        
        if self.redis_client:
            try:
                await self.redis_client.close()
                self.logger.info("Redis connection closed")
            except Exception as e:
                self.logger.warning(f"Error closing Redis connection: {e}")
        
        # Clear memory cache
        self.memory_cache.clear()
        
        self.logger.info("Cache Manager cleanup complete")
    
    def _get_cache_key(self, key: str, namespace: str = "default") -> str:
        """Generate a namespaced cache key"""
        return f"myco:{namespace}:{key}"
    
    def _hash_key(self, key: str) -> str:
        """Hash a key for consistent length"""
        return hashlib.md5(key.encode()).hexdigest()
    
    def _serialize_value(self, value: Any) -> str:
        """Serialize a value for storage"""
        return json.dumps({
            "data": value,
            "timestamp": time.time(),
            "type": type(value).__name__
        })
    
    def _deserialize_value(self, serialized: str) -> Any:
        """Deserialize a value from storage"""
        try:
            data = json.loads(serialized)
            return data["data"]
        except (json.JSONDecodeError, KeyError):
            return None
    
    async def get(self, key: str, namespace: str = "default") -> Optional[Any]:
        """Get a value from cache"""
        cache_key = self._get_cache_key(key, namespace)
        
        try:
            # Try Redis first
            if self.redis_client:
                try:
                    value = await self.redis_client.get(cache_key)
                    if value is not None:
                        self.cache_stats["hits"] += 1
                        return self._deserialize_value(value)
                except Exception as e:
                    self.logger.warning(f"Redis get error: {e}")
                    self.cache_stats["errors"] += 1
            
            # Fallback to memory cache
            if cache_key in self.memory_cache:
                cache_item = self.memory_cache[cache_key]
                
                # Check TTL
                if cache_item.get("expires_at", float('inf')) > time.time():
                    self.cache_stats["hits"] += 1
                    return cache_item["value"]
                else:
                    # Expired, remove from memory cache
                    del self.memory_cache[cache_key]
            
            self.cache_stats["misses"] += 1
            return None
        
        except Exception as e:
            self.logger.error(f"Error getting cache key {cache_key}: {e}")
            self.cache_stats["errors"] += 1
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None, 
        namespace: str = "default"
    ) -> bool:
        """Set a value in cache"""
        cache_key = self._get_cache_key(key, namespace)
        ttl = ttl or self.default_ttl
        
        try:
            serialized_value = self._serialize_value(value)
            
            # Try Redis first
            if self.redis_client:
                try:
                    await self.redis_client.setex(cache_key, ttl, serialized_value)
                    self.cache_stats["sets"] += 1
                    return True
                except Exception as e:
                    self.logger.warning(f"Redis set error: {e}")
                    self.cache_stats["errors"] += 1
            
            # Fallback to memory cache
            # Implement LRU eviction if cache is full
            if len(self.memory_cache) >= self.max_memory_cache_size:
                # Remove oldest items
                sorted_items = sorted(
                    self.memory_cache.items(),
                    key=lambda x: x[1].get("accessed_at", 0)
                )
                items_to_remove = len(sorted_items) - self.max_memory_cache_size + 1
                for old_key, _ in sorted_items[:items_to_remove]:
                    del self.memory_cache[old_key]
            
            self.memory_cache[cache_key] = {
                "value": value,
                "expires_at": time.time() + ttl,
                "accessed_at": time.time()
            }
            
            self.cache_stats["sets"] += 1
            return True
        
        except Exception as e:
            self.logger.error(f"Error setting cache key {cache_key}: {e}")
            self.cache_stats["errors"] += 1
            return False
    
    async def delete(self, key: str, namespace: str = "default") -> bool:
        """Delete a value from cache"""
        cache_key = self._get_cache_key(key, namespace)
        
        try:
            deleted = False
            
            # Try Redis first
            if self.redis_client:
                try:
                    result = await self.redis_client.delete(cache_key)
                    deleted = result > 0
                except Exception as e:
                    self.logger.warning(f"Redis delete error: {e}")
                    self.cache_stats["errors"] += 1
            
            # Remove from memory cache
            if cache_key in self.memory_cache:
                del self.memory_cache[cache_key]
                deleted = True
            
            if deleted:
                self.cache_stats["deletes"] += 1
            
            return deleted
        
        except Exception as e:
            self.logger.error(f"Error deleting cache key {cache_key}: {e}")
            self.cache_stats["errors"] += 1
            return False
    
    async def exists(self, key: str, namespace: str = "default") -> bool:
        """Check if a key exists in cache"""
        cache_key = self._get_cache_key(key, namespace)
        
        try:
            # Try Redis first
            if self.redis_client:
                try:
                    result = await self.redis_client.exists(cache_key)
                    if result:
                        return True
                except Exception as e:
                    self.logger.warning(f"Redis exists error: {e}")
            
            # Check memory cache
            if cache_key in self.memory_cache:
                cache_item = self.memory_cache[cache_key]
                # Check if not expired
                return cache_item.get("expires_at", float('inf')) > time.time()
            
            return False
        
        except Exception as e:
            self.logger.error(f"Error checking cache key {cache_key}: {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1, namespace: str = "default") -> Optional[int]:
        """Increment a numeric value in cache"""
        cache_key = self._get_cache_key(key, namespace)
        
        try:
            # Try Redis first
            if self.redis_client:
                try:
                    result = await self.redis_client.incrby(cache_key, amount)
                    return result
                except Exception as e:
                    self.logger.warning(f"Redis increment error: {e}")
            
            # Fallback to memory cache
            current_value = await self.get(key, namespace) or 0
            new_value = int(current_value) + amount
            await self.set(key, new_value, namespace=namespace)
            return new_value
        
        except Exception as e:
            self.logger.error(f"Error incrementing cache key {cache_key}: {e}")
            return None
    
    async def get_pattern(self, pattern: str, namespace: str = "default") -> Dict[str, Any]:
        """Get all keys matching a pattern"""
        cache_pattern = self._get_cache_key(pattern, namespace)
        results = {}
        
        try:
            # Try Redis first
            if self.redis_client:
                try:
                    keys = await self.redis_client.keys(cache_pattern)
                    if keys:
                        values = await self.redis_client.mget(keys)
                        for key, value in zip(keys, values):
                            if value is not None:
                                # Remove namespace prefix for result
                                clean_key = key.replace(f"myco:{namespace}:", "")
                                results[clean_key] = self._deserialize_value(value)
                        return results
                except Exception as e:
                    self.logger.warning(f"Redis pattern get error: {e}")
            
            # Fallback to memory cache
            prefix = self._get_cache_key("", namespace)
            pattern_suffix = pattern.replace("*", "")
            
            for cache_key, cache_item in self.memory_cache.items():
                if cache_key.startswith(prefix):
                    # Check if not expired
                    if cache_item.get("expires_at", float('inf')) > time.time():
                        clean_key = cache_key.replace(prefix, "")
                        if pattern_suffix in clean_key or pattern == "*":
                            results[clean_key] = cache_item["value"]
            
            return results
        
        except Exception as e:
            self.logger.error(f"Error getting pattern {cache_pattern}: {e}")
            return {}
    
    async def clear_namespace(self, namespace: str = "default") -> bool:
        """Clear all keys in a namespace"""
        try:
            pattern = self._get_cache_key("*", namespace)
            
            # Clear from Redis
            if self.redis_client:
                try:
                    keys = await self.redis_client.keys(pattern)
                    if keys:
                        await self.redis_client.delete(*keys)
                except Exception as e:
                    self.logger.warning(f"Redis clear namespace error: {e}")
            
            # Clear from memory cache
            prefix = self._get_cache_key("", namespace)
            keys_to_delete = [
                key for key in self.memory_cache.keys()
                if key.startswith(prefix)
            ]
            
            for key in keys_to_delete:
                del self.memory_cache[key]
            
            self.logger.info(f"Cleared namespace: {namespace}")
            return True
        
        except Exception as e:
            self.logger.error(f"Error clearing namespace {namespace}: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = (self.cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        stats = {
            "hits": self.cache_stats["hits"],
            "misses": self.cache_stats["misses"],
            "hit_rate": round(hit_rate, 2),
            "sets": self.cache_stats["sets"],
            "deletes": self.cache_stats["deletes"],
            "errors": self.cache_stats["errors"],
            "memory_cache_size": len(self.memory_cache),
            "redis_available": self.redis_client is not None
        }
        
        # Add Redis info if available
        if self.redis_client:
            try:
                redis_info = await self.redis_client.info()
                stats["redis_info"] = {
                    "used_memory": redis_info.get("used_memory"),
                    "connected_clients": redis_info.get("connected_clients"),
                    "total_commands_processed": redis_info.get("total_commands_processed")
                }
            except Exception as e:
                self.logger.warning(f"Could not get Redis info: {e}")
        
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of the cache manager"""
        try:
            # Test basic operations
            test_key = f"health_check_{int(time.time())}"
            test_value = {"test": True, "timestamp": time.time()}
            
            # Test set
            set_success = await self.set(test_key, test_value, ttl=60)
            
            # Test get
            retrieved_value = await self.get(test_key)
            get_success = retrieved_value == test_value
            
            # Test delete
            delete_success = await self.delete(test_key)
            
            redis_status = "healthy" if self.redis_client else "not_available"
            
            return {
                "status": "healthy" if (set_success and get_success) else "unhealthy",
                "redis_status": redis_status,
                "memory_cache_size": len(self.memory_cache),
                "operations": {
                    "set": set_success,
                    "get": get_success,
                    "delete": delete_success
                },
                "stats": await self.get_stats(),
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Global instance
cache_manager = CacheManager()