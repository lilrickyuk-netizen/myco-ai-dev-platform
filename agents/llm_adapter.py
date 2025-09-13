import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from abc import ABC, abstractmethod
from dataclasses import dataclass
import httpx
import openai
import anthropic
import google.generativeai as genai
from .config import LLMConfig, LLMProvider

@dataclass
class LLMMessage:
    role: str  # "system", "user", "assistant"
    content: str
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class LLMResponse:
    content: str
    model: str
    tokens_used: int
    finish_reason: str
    metadata: Optional[Dict[str, Any]] = None

class LLMAdapter(ABC):
    def __init__(self, config: LLMConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{config.provider.value}")
    
    @abstractmethod
    async def complete(self, messages: List[LLMMessage]) -> LLMResponse:
        """Generate a completion for the given messages"""
        pass
    
    @abstractmethod
    async def stream(self, messages: List[LLMMessage]) -> AsyncGenerator[str, None]:
        """Stream completion tokens"""
        pass
    
    def _format_messages(self, messages: List[LLMMessage]) -> List[Dict[str, str]]:
        """Format messages for the specific provider"""
        return [{"role": msg.role, "content": msg.content} for msg in messages]

class OpenAIAdapter(LLMAdapter):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.client = openai.AsyncOpenAI(api_key=config.api_key)
    
    async def complete(self, messages: List[LLMMessage]) -> LLMResponse:
        try:
            response = await self.client.chat.completions.create(
                model=self.config.model_name,
                messages=self._format_messages(messages),
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                timeout=self.config.timeout
            )
            
            return LLMResponse(
                content=response.choices[0].message.content,
                model=response.model,
                tokens_used=response.usage.total_tokens,
                finish_reason=response.choices[0].finish_reason,
                metadata={"id": response.id}
            )
        except Exception as e:
            self.logger.error(f"OpenAI completion failed: {e}")
            raise
    
    async def stream(self, messages: List[LLMMessage]) -> AsyncGenerator[str, None]:
        try:
            stream = await self.client.chat.completions.create(
                model=self.config.model_name,
                messages=self._format_messages(messages),
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                stream=True,
                timeout=self.config.timeout
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            self.logger.error(f"OpenAI streaming failed: {e}")
            raise

class AnthropicAdapter(LLMAdapter):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.client = anthropic.AsyncAnthropic(api_key=config.api_key)
    
    def _format_messages_anthropic(self, messages: List[LLMMessage]) -> tuple:
        """Format messages for Anthropic (system prompt separate)"""
        system_prompt = ""
        conversation = []
        
        for msg in messages:
            if msg.role == "system":
                system_prompt += msg.content + "\n"
            else:
                conversation.append({"role": msg.role, "content": msg.content})
        
        return system_prompt.strip(), conversation
    
    async def complete(self, messages: List[LLMMessage]) -> LLMResponse:
        try:
            system_prompt, conversation = self._format_messages_anthropic(messages)
            
            response = await self.client.messages.create(
                model=self.config.model_name,
                system=system_prompt if system_prompt else None,
                messages=conversation,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                timeout=self.config.timeout
            )
            
            return LLMResponse(
                content=response.content[0].text,
                model=response.model,
                tokens_used=response.usage.input_tokens + response.usage.output_tokens,
                finish_reason=response.stop_reason,
                metadata={"id": response.id}
            )
        except Exception as e:
            self.logger.error(f"Anthropic completion failed: {e}")
            raise
    
    async def stream(self, messages: List[LLMMessage]) -> AsyncGenerator[str, None]:
        try:
            system_prompt, conversation = self._format_messages_anthropic(messages)
            
            async with self.client.messages.stream(
                model=self.config.model_name,
                system=system_prompt if system_prompt else None,
                messages=conversation,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            self.logger.error(f"Anthropic streaming failed: {e}")
            raise

class GoogleAdapter(LLMAdapter):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        genai.configure(api_key=config.api_key)
        self.model = genai.GenerativeModel(config.model_name)
    
    async def complete(self, messages: List[LLMMessage]) -> LLMResponse:
        try:
            # Combine all messages into a single prompt for Google
            prompt = "\n".join([f"{msg.role}: {msg.content}" for msg in messages])
            
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=self.config.max_tokens,
                    temperature=self.config.temperature
                )
            )
            
            return LLMResponse(
                content=response.text,
                model=self.config.model_name,
                tokens_used=response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0,
                finish_reason="stop",
                metadata={}
            )
        except Exception as e:
            self.logger.error(f"Google completion failed: {e}")
            raise
    
    async def stream(self, messages: List[LLMMessage]) -> AsyncGenerator[str, None]:
        try:
            prompt = "\n".join([f"{msg.role}: {msg.content}" for msg in messages])
            
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                stream=True
            )
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            self.logger.error(f"Google streaming failed: {e}")
            raise

class OllamaAdapter(LLMAdapter):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.base_url = config.base_url or "http://localhost:11434"
    
    async def complete(self, messages: List[LLMMessage]) -> LLMResponse:
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.config.model_name,
                        "prompt": self._messages_to_prompt(messages),
                        "stream": False,
                        "options": {
                            "temperature": self.config.temperature,
                            "num_predict": self.config.max_tokens
                        }
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                return LLMResponse(
                    content=result["response"],
                    model=self.config.model_name,
                    tokens_used=result.get("eval_count", 0) + result.get("prompt_eval_count", 0),
                    finish_reason="stop",
                    metadata=result
                )
        except Exception as e:
            self.logger.error(f"Ollama completion failed: {e}")
            raise
    
    async def stream(self, messages: List[LLMMessage]) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.config.model_name,
                        "prompt": self._messages_to_prompt(messages),
                        "stream": True,
                        "options": {
                            "temperature": self.config.temperature,
                            "num_predict": self.config.max_tokens
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
            raise
    
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

class LLMManager:
    def __init__(self):
        self.adapters: Dict[str, LLMAdapter] = {}
        self.logger = logging.getLogger(__name__)
    
    def register_adapter(self, name: str, config: LLMConfig) -> LLMAdapter:
        """Register an LLM adapter"""
        adapter_classes = {
            LLMProvider.OPENAI: OpenAIAdapter,
            LLMProvider.ANTHROPIC: AnthropicAdapter,
            LLMProvider.GOOGLE: GoogleAdapter,
            LLMProvider.OLLAMA: OllamaAdapter
        }
        
        adapter_class = adapter_classes.get(config.provider)
        if not adapter_class:
            raise ValueError(f"Unsupported LLM provider: {config.provider}")
        
        adapter = adapter_class(config)
        self.adapters[name] = adapter
        self.logger.info(f"Registered LLM adapter: {name} ({config.provider.value})")
        return adapter
    
    def get_adapter(self, name: str) -> LLMAdapter:
        """Get an LLM adapter by name"""
        if name not in self.adapters:
            raise ValueError(f"LLM adapter not found: {name}")
        return self.adapters[name]
    
    async def complete_with_fallback(self, messages: List[LLMMessage], preferred_adapter: str = "primary") -> LLMResponse:
        """Complete with fallback to other adapters if primary fails"""
        adapter_order = [preferred_adapter] + [name for name in self.adapters.keys() if name != preferred_adapter]
        
        for adapter_name in adapter_order:
            try:
                adapter = self.get_adapter(adapter_name)
                response = await adapter.complete(messages)
                self.logger.info(f"Completion successful with adapter: {adapter_name}")
                return response
            except Exception as e:
                self.logger.warning(f"Adapter {adapter_name} failed: {e}")
                continue
        
        raise RuntimeError("All LLM adapters failed")

# Global LLM manager instance
llm_manager = LLMManager()