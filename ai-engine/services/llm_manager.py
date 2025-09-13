"""
LLM Manager - Handles multiple LLM providers and model management
"""

import asyncio
import logging
import json
import time
from typing import Dict, List, Any, Optional, AsyncGenerator, Union
from dataclasses import dataclass
from enum import Enum
import httpx
import openai
import anthropic
import google.generativeai as genai
import cohere

from ..core.config import settings, LLM_MODELS
from ..core.exceptions import LLMError, ModelNotFoundError, RateLimitError

logger = logging.getLogger(__name__)

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    COHERE = "cohere"
    OLLAMA = "ollama"
    HUGGINGFACE = "huggingface"

@dataclass
class LLMMessage:
    role: str  # "system", "user", "assistant"
    content: str
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class LLMResponse:
    content: str
    model: str
    provider: str
    tokens_used: int
    finish_reason: str
    response_time: float
    cost: float
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class ModelInfo:
    name: str
    provider: LLMProvider
    max_tokens: int
    supports_streaming: bool
    cost_per_1k_tokens: float
    available: bool = True

class LLMAdapter:
    """Base class for LLM adapters"""
    
    def __init__(self, provider: LLMProvider, api_key: Optional[str] = None):
        self.provider = provider
        self.api_key = api_key
        self.logger = logging.getLogger(f"{__name__}.{provider.value}")
        
    async def complete(self, model: str, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        """Generate completion"""
        raise NotImplementedError
        
    async def stream(self, model: str, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        """Stream completion"""
        raise NotImplementedError
        
    def get_available_models(self) -> List[str]:
        """Get list of available models"""
        raise NotImplementedError

class OpenAIAdapter(LLMAdapter):
    """OpenAI API adapter"""
    
    def __init__(self, api_key: str):
        super().__init__(LLMProvider.OPENAI, api_key)
        self.client = openai.AsyncOpenAI(api_key=api_key)
        
    async def complete(self, model: str, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        start_time = time.time()
        
        try:
            formatted_messages = [{"role": msg.role, "content": msg.content} for msg in messages]
            
            response = await self.client.chat.completions.create(
                model=model,
                messages=formatted_messages,
                max_tokens=kwargs.get("max_tokens", settings.MAX_TOKENS),
                temperature=kwargs.get("temperature", settings.DEFAULT_TEMPERATURE),
                stream=False
            )
            
            response_time = time.time() - start_time
            tokens_used = response.usage.total_tokens
            cost = self._calculate_cost(model, tokens_used)
            
            return LLMResponse(
                content=response.choices[0].message.content,
                model=model,
                provider=self.provider.value,
                tokens_used=tokens_used,
                finish_reason=response.choices[0].finish_reason,
                response_time=response_time,
                cost=cost,
                metadata={"id": response.id}
            )
            
        except openai.RateLimitError as e:
            raise RateLimitError(f"OpenAI rate limit exceeded: {e}")
        except Exception as e:
            self.logger.error(f"OpenAI completion failed: {e}")
            raise LLMError(f"OpenAI error: {e}")
    
    async def stream(self, model: str, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        try:
            formatted_messages = [{"role": msg.role, "content": msg.content} for msg in messages]
            
            stream = await self.client.chat.completions.create(
                model=model,
                messages=formatted_messages,
                max_tokens=kwargs.get("max_tokens", settings.MAX_TOKENS),
                temperature=kwargs.get("temperature", settings.DEFAULT_TEMPERATURE),
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            self.logger.error(f"OpenAI streaming failed: {e}")
            raise LLMError(f"OpenAI streaming error: {e}")
    
    def get_available_models(self) -> List[str]:
        return list(LLM_MODELS["openai"].keys())
    
    def _calculate_cost(self, model: str, tokens: int) -> float:
        model_config = LLM_MODELS["openai"].get(model, {})
        cost_per_1k = model_config.get("cost_per_1k_tokens", 0)
        return (tokens / 1000) * cost_per_1k

class AnthropicAdapter(LLMAdapter):
    """Anthropic Claude API adapter"""
    
    def __init__(self, api_key: str):
        super().__init__(LLMProvider.ANTHROPIC, api_key)
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        
    async def complete(self, model: str, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        start_time = time.time()
        
        try:
            system_prompt, conversation = self._format_messages(messages)
            
            response = await self.client.messages.create(
                model=model,
                system=system_prompt if system_prompt else None,
                messages=conversation,
                max_tokens=kwargs.get("max_tokens", settings.MAX_TOKENS),
                temperature=kwargs.get("temperature", settings.DEFAULT_TEMPERATURE)
            )
            
            response_time = time.time() - start_time
            tokens_used = response.usage.input_tokens + response.usage.output_tokens
            cost = self._calculate_cost(model, tokens_used)
            
            return LLMResponse(
                content=response.content[0].text,
                model=model,
                provider=self.provider.value,
                tokens_used=tokens_used,
                finish_reason=response.stop_reason,
                response_time=response_time,
                cost=cost,
                metadata={"id": response.id}
            )
            
        except Exception as e:
            self.logger.error(f"Anthropic completion failed: {e}")
            raise LLMError(f"Anthropic error: {e}")
    
    async def stream(self, model: str, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        try:
            system_prompt, conversation = self._format_messages(messages)
            
            async with self.client.messages.stream(
                model=model,
                system=system_prompt if system_prompt else None,
                messages=conversation,
                max_tokens=kwargs.get("max_tokens", settings.MAX_TOKENS),
                temperature=kwargs.get("temperature", settings.DEFAULT_TEMPERATURE)
            ) as stream:
                async for text in stream.text_stream:
                    yield text
                    
        except Exception as e:
            self.logger.error(f"Anthropic streaming failed: {e}")
            raise LLMError(f"Anthropic streaming error: {e}")
    
    def _format_messages(self, messages: List[LLMMessage]) -> tuple:
        """Format messages for Anthropic (system prompt separate)"""
        system_prompt = ""
        conversation = []
        
        for msg in messages:
            if msg.role == "system":
                system_prompt += msg.content + "\n"
            else:
                conversation.append({"role": msg.role, "content": msg.content})
        
        return system_prompt.strip(), conversation
    
    def get_available_models(self) -> List[str]:
        return list(LLM_MODELS["anthropic"].keys())
    
    def _calculate_cost(self, model: str, tokens: int) -> float:
        model_config = LLM_MODELS["anthropic"].get(model, {})
        cost_per_1k = model_config.get("cost_per_1k_tokens", 0)
        return (tokens / 1000) * cost_per_1k

class OllamaAdapter(LLMAdapter):
    """Ollama local LLM adapter"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        super().__init__(LLMProvider.OLLAMA)
        self.base_url = base_url
        
    async def complete(self, model: str, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                prompt = self._messages_to_prompt(messages)
                
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": kwargs.get("temperature", settings.DEFAULT_TEMPERATURE),
                            "num_predict": kwargs.get("max_tokens", settings.MAX_TOKENS)
                        }
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                response_time = time.time() - start_time
                tokens_used = result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
                
                return LLMResponse(
                    content=result["response"],
                    model=model,
                    provider=self.provider.value,
                    tokens_used=tokens_used,
                    finish_reason="stop",
                    response_time=response_time,
                    cost=0.0,  # Ollama is free
                    metadata=result
                )
                
        except Exception as e:
            self.logger.error(f"Ollama completion failed: {e}")
            raise LLMError(f"Ollama error: {e}")
    
    async def stream(self, model: str, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                prompt = self._messages_to_prompt(messages)
                
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": True,
                        "options": {
                            "temperature": kwargs.get("temperature", settings.DEFAULT_TEMPERATURE),
                            "num_predict": kwargs.get("max_tokens", settings.MAX_TOKENS)
                        }
                    }
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                                
        except Exception as e:
            self.logger.error(f"Ollama streaming failed: {e}")
            raise LLMError(f"Ollama streaming error: {e}")
    
    def _messages_to_prompt(self, messages: List[LLMMessage]) -> str:
        """Convert messages to a single prompt for Ollama"""
        prompt_parts = []
        for msg in messages:
            if msg.role == "system":
                prompt_parts.append(f"System: {msg.content}")
            elif msg.role == "user":
                prompt_parts.append(f"Human: {msg.content}")
            elif msg.role == "assistant":
                prompt_parts.append(f"Assistant: {msg.content}")
        
        prompt_parts.append("Assistant:")
        return "\n\n".join(prompt_parts)
    
    async def get_available_models(self) -> List[str]:
        """Get available models from Ollama"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
        except Exception as e:
            self.logger.error(f"Failed to get Ollama models: {e}")
            return []

class LLMManager:
    """Manages multiple LLM providers and handles routing"""
    
    def __init__(self):
        self.adapters: Dict[LLMProvider, LLMAdapter] = {}
        self.available_models: Dict[str, ModelInfo] = {}
        self.request_counts: Dict[str, int] = {}
        self.logger = logging.getLogger(__name__)
        
    async def initialize(self):
        """Initialize LLM adapters"""
        self.logger.info("Initializing LLM Manager...")
        
        # Initialize OpenAI
        if settings.OPENAI_API_KEY:
            self.adapters[LLMProvider.OPENAI] = OpenAIAdapter(settings.OPENAI_API_KEY)
            await self._register_models(LLMProvider.OPENAI)
        
        # Initialize Anthropic
        if settings.ANTHROPIC_API_KEY:
            self.adapters[LLMProvider.ANTHROPIC] = AnthropicAdapter(settings.ANTHROPIC_API_KEY)
            await self._register_models(LLMProvider.ANTHROPIC)
        
        # Initialize Google
        if settings.GOOGLE_API_KEY:
            # Implementation for Google Gemini
            pass
        
        # Initialize Ollama
        try:
            ollama_adapter = OllamaAdapter(settings.OLLAMA_BASE_URL)
            models = await ollama_adapter.get_available_models()
            if models:
                self.adapters[LLMProvider.OLLAMA] = ollama_adapter
                await self._register_models(LLMProvider.OLLAMA)
        except Exception as e:
            self.logger.warning(f"Ollama not available: {e}")
        
        self.logger.info(f"Initialized LLM Manager with {len(self.adapters)} providers and {len(self.available_models)} models")
    
    async def _register_models(self, provider: LLMProvider):
        """Register models for a provider"""
        provider_models = LLM_MODELS.get(provider.value, {})
        
        for model_name, config in provider_models.items():
            model_info = ModelInfo(
                name=model_name,
                provider=provider,
                max_tokens=config["max_tokens"],
                supports_streaming=config["supports_streaming"],
                cost_per_1k_tokens=config["cost_per_1k_tokens"],
                available=True
            )
            self.available_models[model_name] = model_info
    
    async def complete(self, model: str, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        """Generate completion using specified model"""
        if model not in self.available_models:
            raise ModelNotFoundError(f"Model {model} not found")
        
        model_info = self.available_models[model]
        adapter = self.adapters.get(model_info.provider)
        
        if not adapter:
            raise LLMError(f"No adapter available for provider {model_info.provider}")
        
        try:
            response = await adapter.complete(model, messages, **kwargs)
            self.request_counts[model] = self.request_counts.get(model, 0) + 1
            return response
        except Exception as e:
            self.logger.error(f"Completion failed for model {model}: {e}")
            raise
    
    async def stream(self, model: str, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        """Stream completion using specified model"""
        if model not in self.available_models:
            raise ModelNotFoundError(f"Model {model} not found")
        
        model_info = self.available_models[model]
        
        if not model_info.supports_streaming:
            raise LLMError(f"Model {model} does not support streaming")
        
        adapter = self.adapters.get(model_info.provider)
        
        if not adapter:
            raise LLMError(f"No adapter available for provider {model_info.provider}")
        
        try:
            async for chunk in adapter.stream(model, messages, **kwargs):
                yield chunk
        except Exception as e:
            self.logger.error(f"Streaming failed for model {model}: {e}")
            raise
    
    async def complete_with_fallback(self, 
                                   messages: List[LLMMessage], 
                                   preferred_models: List[str] = None,
                                   **kwargs) -> LLMResponse:
        """Complete with fallback to other models if preferred fails"""
        if not preferred_models:
            preferred_models = [settings.DEFAULT_MODEL, "gpt-3.5-turbo", "claude-3-haiku-20240307"]
        
        for model in preferred_models:
            if model in self.available_models:
                try:
                    return await self.complete(model, messages, **kwargs)
                except Exception as e:
                    self.logger.warning(f"Model {model} failed, trying next: {e}")
                    continue
        
        raise LLMError("All fallback models failed")
    
    async def stream_completion(self, model: str, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        """Public method for streaming completions"""
        async for chunk in self.stream(model, messages, **kwargs):
            yield chunk
    
    def get_available_models(self) -> Dict[str, ModelInfo]:
        """Get all available models"""
        return self.available_models.copy()
    
    def get_model_info(self, model: str) -> Optional[ModelInfo]:
        """Get information about a specific model"""
        return self.available_models.get(model)
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics"""
        return {
            "total_requests": sum(self.request_counts.values()),
            "requests_by_model": self.request_counts.copy(),
            "available_providers": list(self.adapters.keys()),
            "available_models": len(self.available_models)
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        self.logger.info("Cleaning up LLM Manager...")
        self.adapters.clear()
        self.available_models.clear()
        self.request_counts.clear()