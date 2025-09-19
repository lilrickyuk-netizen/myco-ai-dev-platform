"""
Provider selection and load balancing for AI engine
"""

import os
import time
import logging
from typing import Optional, Dict, List
from enum import Enum
import asyncio
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class ProviderHealth(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"

@dataclass
class ProviderStatus:
    name: str
    health: ProviderHealth
    response_time: float
    error_rate: float
    last_check: float
    available_models: List[str]

class ProviderSelector:
    """Intelligent provider selection with health monitoring"""
    
    def __init__(self):
        self.provider_status: Dict[str, ProviderStatus] = {}
        self.health_check_interval = 300  # 5 minutes
        self.last_health_check = 0
        
        # Provider priority order
        self.provider_priority = ["openai", "anthropic", "google"]
        
        # Model to provider mapping
        self.model_providers = {
            "gpt-3.5-turbo": ["openai"],
            "gpt-4": ["openai"],
            "gpt-4-turbo": ["openai"],
            "claude-3-sonnet": ["anthropic"],
            "claude-3-opus": ["anthropic"],
            "claude-3-haiku": ["anthropic"],
            "gemini-pro": ["google"],
            "gemini-1.5-pro": ["google"]
        }
        
    async def get_best_provider(self, model: str = None, preferred_provider: str = None) -> Optional[str]:
        """Select the best available provider for the request"""
        
        # Update health status if needed
        await self._update_health_status()
        
        # If specific provider requested, validate it
        if preferred_provider:
            if self._is_provider_available(preferred_provider):
                return preferred_provider
            else:
                logger.warning(f"Preferred provider {preferred_provider} not available")
        
        # If model specified, filter providers that support it
        candidate_providers = []
        if model and model in self.model_providers:
            candidate_providers = self.model_providers[model]
        else:
            candidate_providers = self.provider_priority
            
        # Select best available provider
        for provider in candidate_providers:
            if self._is_provider_available(provider):
                logger.info(f"Selected provider: {provider} for model: {model}")
                return provider
                
        logger.error("No available providers found")
        return None
        
    def _is_provider_available(self, provider: str) -> bool:
        """Check if provider is available and healthy"""
        
        # Check if API key is configured
        if not self._has_api_key(provider):
            return False
            
        # Check health status
        if provider in self.provider_status:
            status = self.provider_status[provider]
            return status.health in [ProviderHealth.HEALTHY, ProviderHealth.DEGRADED]
            
        # Assume available if no status recorded yet
        return True
        
    def _has_api_key(self, provider: str) -> bool:
        """Check if provider has API key configured"""
        key_mapping = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY", 
            "google": "GOOGLE_API_KEY"
        }
        
        env_var = key_mapping.get(provider)
        return bool(env_var and os.getenv(env_var))
        
    async def _update_health_status(self):
        """Update provider health status"""
        
        current_time = time.time()
        if current_time - self.last_health_check < self.health_check_interval:
            return
            
        self.last_health_check = current_time
        
        # Check each provider
        for provider in self.provider_priority:
            if self._has_api_key(provider):
                health_status = await self._check_provider_health(provider)
                self.provider_status[provider] = health_status
                
    async def _check_provider_health(self, provider: str) -> ProviderStatus:
        """Perform health check on specific provider"""
        
        start_time = time.time()
        
        try:
            # Import here to avoid circular imports
            from .llm_manager import llm_manager, LLMProvider
            
            provider_enum = LLMProvider(provider.upper())
            
            # Test simple generation
            response = await asyncio.wait_for(
                llm_manager.generate(
                    prompt="test",
                    provider=provider_enum,
                    max_tokens=1
                ),
                timeout=10.0
            )
            
            response_time = time.time() - start_time
            
            if response and response.content:
                health = ProviderHealth.HEALTHY
                error_rate = 0.0
            else:
                health = ProviderHealth.DEGRADED
                error_rate = 0.5
                
        except asyncio.TimeoutError:
            health = ProviderHealth.DEGRADED
            response_time = 10.0
            error_rate = 1.0
            logger.warning(f"Provider {provider} health check timed out")
            
        except Exception as e:
            health = ProviderHealth.UNAVAILABLE
            response_time = time.time() - start_time
            error_rate = 1.0
            logger.error(f"Provider {provider} health check failed: {e}")
            
        return ProviderStatus(
            name=provider,
            health=health,
            response_time=response_time,
            error_rate=error_rate,
            last_check=time.time(),
            available_models=self._get_provider_models(provider)
        )
        
    def _get_provider_models(self, provider: str) -> List[str]:
        """Get available models for provider"""
        models = []
        for model, providers in self.model_providers.items():
            if provider in providers:
                models.append(model)
        return models
        
    def get_provider_status(self) -> Dict[str, ProviderStatus]:
        """Get current status of all providers"""
        return self.provider_status.copy()
        
    async def record_provider_error(self, provider: str, error: Exception):
        """Record an error for provider statistics"""
        if provider in self.provider_status:
            status = self.provider_status[provider]
            status.error_rate = min(1.0, status.error_rate + 0.1)
            if status.error_rate > 0.5:
                status.health = ProviderHealth.DEGRADED
            logger.warning(f"Recorded error for provider {provider}: {error}")

# Global instance
provider_selector = ProviderSelector()