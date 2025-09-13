"""
Cache management service
"""

import asyncio
import json
import logging
import time
import hashlib
from typing import Dict, Any, Optional, Union
from datetime import datetime, timedelta

from ..core.config import settings
from ..core.exceptions import AIEngineError

class CacheManager:
    """Manages caching for AI responses and data"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.access_times: Dict[str, float] = {}
        self.ttl_default = settings.CACHE_TTL
        self.max_size = settings.CACHE_MAX_SIZE
        self.cleanup_interval = 300  # 5 minutes
        self.last_cleanup = time.time()
        
    async def initialize(self):
        """Initialize the cache manager"""
        self.logger.info("Initializing Cache Manager...")
        
        # Start periodic cleanup
        asyncio.create_task(self._periodic_cleanup())
        
        self.logger.info("Cache Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup the cache manager"""
        self.logger.info("Shutting down Cache Manager...")
        
        # Clear all cache
        self.cache.clear()
        self.access_times.clear()
        
        self.logger.info("Cache Manager shutdown complete")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        
        cache_key = self._hash_key(key)
        
        if cache_key not in self.cache:
            return None
        
        entry = self.cache[cache_key]
        
        # Check if expired
        if self._is_expired(entry):
            await self.delete(key)
            return None
        
        # Update access time
        self.access_times[cache_key] = time.time()
        
        # Return value
        return entry["value"]
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        tags: Optional[list] = None
    ):
        """Set value in cache"""
        
        cache_key = self._hash_key(key)
        
        # Use default TTL if not specified
        if ttl is None:
            ttl = self.ttl_default
        
        # Calculate expiration time
        expires_at = time.time() + ttl if ttl > 0 else None
        
        # Create cache entry
        entry = {
            "value": value,
            "created_at": time.time(),
            "expires_at": expires_at,
            "ttl": ttl,
            "tags": tags or [],
            "hit_count": 0
        }
        
        # Store in cache
        self.cache[cache_key] = entry
        self.access_times[cache_key] = time.time()
        
        # Enforce size limit
        await self._enforce_size_limit()
        
        self.logger.debug(f"Cached value for key: {key[:50]}...")
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        
        cache_key = self._hash_key(key)
        
        if cache_key in self.cache:
            del self.cache[cache_key]
            self.access_times.pop(cache_key, None)
            self.logger.debug(f"Deleted cache key: {key[:50]}...")
            return True
        
        return False
    
    async def delete_by_tags(self, tags: list) -> int:
        """Delete all cache entries with specified tags"""
        
        deleted_count = 0
        keys_to_delete = []
        
        for cache_key, entry in self.cache.items():
            entry_tags = entry.get("tags", [])
            if any(tag in entry_tags for tag in tags):
                keys_to_delete.append(cache_key)
        
        for cache_key in keys_to_delete:
            del self.cache[cache_key]
            self.access_times.pop(cache_key, None)
            deleted_count += 1
        
        self.logger.info(f"Deleted {deleted_count} cache entries with tags: {tags}")
        return deleted_count
    
    async def clear(self):
        """Clear all cache"""
        
        count = len(self.cache)
        self.cache.clear()
        self.access_times.clear()
        
        self.logger.info(f"Cleared {count} cache entries")
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        
        cache_key = self._hash_key(key)
        
        if cache_key not in self.cache:
            return False
        
        entry = self.cache[cache_key]
        
        # Check if expired
        if self._is_expired(entry):
            await self.delete(key)
            return False
        
        return True
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        
        # Count expired entries
        expired_count = 0
        total_size = 0
        
        for entry in self.cache.values():
            if self._is_expired(entry):
                expired_count += 1
            
            # Estimate size (rough calculation)
            total_size += len(str(entry["value"]))
        
        return {
            "total_entries": len(self.cache),
            "expired_entries": expired_count,
            "active_entries": len(self.cache) - expired_count,
            "estimated_size_bytes": total_size,
            "max_size": self.max_size,
            "ttl_default": self.ttl_default,
            "hit_ratio": self._calculate_hit_ratio(),
            "last_cleanup": self.last_cleanup
        }
    
    def _hash_key(self, key: str) -> str:
        """Create hash of cache key"""
        return hashlib.sha256(key.encode()).hexdigest()
    
    def _is_expired(self, entry: Dict[str, Any]) -> bool:
        """Check if cache entry is expired"""
        
        expires_at = entry.get("expires_at")
        
        if expires_at is None:
            return False  # No expiration
        
        return time.time() > expires_at
    
    async def _enforce_size_limit(self):
        """Enforce cache size limit using LRU eviction"""
        
        if len(self.cache) <= self.max_size:
            return
        
        # Sort by access time (oldest first)
        sorted_keys = sorted(
            self.access_times.items(),
            key=lambda x: x[1]
        )
        
        # Remove oldest entries
        entries_to_remove = len(self.cache) - self.max_size
        
        for cache_key, _ in sorted_keys[:entries_to_remove]:
            self.cache.pop(cache_key, None)
            self.access_times.pop(cache_key, None)
        
        self.logger.debug(f"Evicted {entries_to_remove} cache entries due to size limit")
    
    async def _periodic_cleanup(self):
        """Periodically clean up expired entries"""
        
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                
                # Remove expired entries
                expired_keys = []
                
                for cache_key, entry in self.cache.items():
                    if self._is_expired(entry):
                        expired_keys.append(cache_key)
                
                for cache_key in expired_keys:
                    self.cache.pop(cache_key, None)
                    self.access_times.pop(cache_key, None)
                
                if expired_keys:
                    self.logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
                
                self.last_cleanup = time.time()
                
            except Exception as e:
                self.logger.error(f"Error during cache cleanup: {e}")
    
    def _calculate_hit_ratio(self) -> float:
        """Calculate cache hit ratio"""
        
        total_hits = sum(entry.get("hit_count", 0) for entry in self.cache.values())
        total_entries = len(self.cache)
        
        if total_entries == 0:
            return 0.0
        
        return total_hits / total_entries

class LLMResponseCache:
    """Specialized cache for LLM responses"""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
        self.cache_prefix = "llm_response:"
    
    async def get_response(
        self,
        prompt: str,
        model: str,
        provider: str,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Get cached LLM response"""
        
        cache_key = self._build_cache_key(prompt, model, provider, **kwargs)
        return await self.cache_manager.get(cache_key)
    
    async def cache_response(
        self,
        prompt: str,
        model: str,
        provider: str,
        response: Dict[str, Any],
        ttl: int = 3600,
        **kwargs
    ):
        """Cache LLM response"""
        
        cache_key = self._build_cache_key(prompt, model, provider, **kwargs)
        
        # Add metadata to response
        cached_response = {
            **response,
            "cached_at": time.time(),
            "cache_key": cache_key
        }
        
        await self.cache_manager.set(
            cache_key,
            cached_response,
            ttl=ttl,
            tags=["llm_response", provider, model]
        )
    
    def _build_cache_key(
        self,
        prompt: str,
        model: str,
        provider: str,
        **kwargs
    ) -> str:
        """Build cache key for LLM response"""
        
        # Include relevant parameters in cache key
        key_data = {
            "prompt": prompt,
            "model": model,
            "provider": provider,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 4096),
            "top_p": kwargs.get("top_p", 1.0)
        }
        
        # Create deterministic key
        key_string = json.dumps(key_data, sort_keys=True)
        cache_key = self.cache_prefix + hashlib.sha256(key_string.encode()).hexdigest()
        
        return cache_key

# Global cache manager instance
cache_manager = CacheManager()

# Global LLM response cache
llm_response_cache = LLMResponseCache(cache_manager)