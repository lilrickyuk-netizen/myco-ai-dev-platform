import asyncio
import json
import logging
import os
from typing import Dict, List, Any, Optional, AsyncGenerator
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

# LLM Provider imports
try:
    import openai
except ImportError:
    openai = None

try:
    import anthropic
except ImportError:
    anthropic = None

try:
    from cohere import Client as CohereClient
except ImportError:
    CohereClient = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    COHERE = "cohere"
    GOOGLE = "google"
    LOCAL = "local"

@dataclass
class LLMConfig:
    provider: LLMProvider
    model: str
    api_key: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0

@dataclass
class LLMResponse:
    content: str
    usage: Dict[str, int]
    model: str
    finish_reason: str
    metadata: Dict[str, Any]

class LLMManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.providers = {}
        self.default_provider = LLMProvider.LOCAL  # Start with local/stub
        self.configs = {}
        self._initialize_providers()
    
    async def initialize(self):
        """Initialize the LLM Manager"""
        self.logger.info("LLM Manager initialized")
        
    async def cleanup(self):
        """Cleanup resources"""
        self.logger.info("LLM Manager cleanup completed")
    
    def _initialize_providers(self):
        """Initialize available LLM providers"""
        
        # Check AI_PROVIDER environment variable
        ai_provider = os.getenv("AI_PROVIDER", "").lower()
        
        # OpenAI
        if openai and os.getenv("OPENAI_API_KEY"):
            self.providers[LLMProvider.OPENAI] = openai
            self.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-3.5-turbo",
                api_key=os.getenv("OPENAI_API_KEY")
            )
            if ai_provider == "openai" or not ai_provider:
                self.default_provider = LLMProvider.OPENAI
            self.logger.info("OpenAI provider initialized")
        
        # Anthropic
        if anthropic and os.getenv("ANTHROPIC_API_KEY"):
            self.providers[LLMProvider.ANTHROPIC] = anthropic.Anthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY")
            )
            self.configs[LLMProvider.ANTHROPIC] = LLMConfig(
                provider=LLMProvider.ANTHROPIC,
                model="claude-3-sonnet-20240229",
                api_key=os.getenv("ANTHROPIC_API_KEY")
            )
            if ai_provider == "anthropic":
                self.default_provider = LLMProvider.ANTHROPIC
            self.logger.info("Anthropic provider initialized")
        
        # Google
        if genai and os.getenv("GOOGLE_API_KEY"):
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
            self.providers[LLMProvider.GOOGLE] = genai
            self.configs[LLMProvider.GOOGLE] = LLMConfig(
                provider=LLMProvider.GOOGLE,
                model="gemini-pro",
                api_key=os.getenv("GOOGLE_API_KEY")
            )
            if ai_provider == "google" or ai_provider == "gemini":
                self.default_provider = LLMProvider.GOOGLE
            self.logger.info("Google provider initialized")
        
        # Always add stub provider
        self.providers[LLMProvider.LOCAL] = "stub"
        self.configs[LLMProvider.LOCAL] = LLMConfig(
            provider=LLMProvider.LOCAL,
            model="stub-model",
            api_key=None
        )
        
        # Use stub as default if specified or no other providers available
        if ai_provider == "stub" or not self.providers or len(self.providers) == 1:
            self.default_provider = LLMProvider.LOCAL
            self.logger.info("Using stub provider as default")
        
        if not self.providers or len(self.providers) == 1:
            self.logger.warning("No external LLM providers initialized. Using stub provider.")
    
    async def generate(
        self, 
        prompt: str, 
        context: Optional[str] = None,
        provider: Optional[LLMProvider] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate text using specified or default LLM provider"""
        
        provider = provider or self.default_provider
        if provider not in self.providers:
            raise ValueError(f"Provider {provider} not available")
        
        config = self.configs[provider]
        if model:
            config.model = model
        
        # Update config with kwargs
        for key, value in kwargs.items():
            if hasattr(config, key):
                setattr(config, key, value)
        
        # Build full prompt
        full_prompt = self._build_prompt(prompt, context)
        
        try:
            if provider == LLMProvider.OPENAI:
                return await self._generate_openai(full_prompt, config)
            elif provider == LLMProvider.ANTHROPIC:
                return await self._generate_anthropic(full_prompt, config)
            elif provider == LLMProvider.COHERE:
                return await self._generate_cohere(full_prompt, config)
            elif provider == LLMProvider.GOOGLE:
                return await self._generate_google(full_prompt, config)
            elif provider == LLMProvider.LOCAL:
                return await self._generate_stub(full_prompt, config)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
        
        except Exception as e:
            self.logger.error(f"LLM generation failed with {provider}: {str(e)}")
            raise
    
    async def generate_stream(
        self,
        prompt: str,
        context: Optional[str] = None,
        provider: Optional[LLMProvider] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream text generation"""
        
        provider = provider or self.default_provider
        if provider not in self.providers:
            raise ValueError(f"Provider {provider} not available")
        
        config = self.configs[provider]
        full_prompt = self._build_prompt(prompt, context)
        
        try:
            if provider == LLMProvider.OPENAI:
                async for chunk in self._stream_openai(full_prompt, config):
                    yield chunk
            elif provider == LLMProvider.ANTHROPIC:
                async for chunk in self._stream_anthropic(full_prompt, config):
                    yield chunk
            elif provider == LLMProvider.LOCAL:
                async for chunk in self._stream_stub(full_prompt, config):
                    yield chunk
            else:
                # Fallback to non-streaming for providers that don't support it
                response = await self.generate(prompt, context, provider, **kwargs)
                yield response.content
        
        except Exception as e:
            self.logger.error(f"Streaming generation failed with {provider}: {str(e)}")
            raise
    
    def _build_prompt(self, prompt: str, context: Optional[str] = None) -> str:
        """Build the full prompt with context"""
        if not context:
            return prompt
        
        return f"""Context:
{context}

Request:
{prompt}

Please provide a helpful response based on the context above."""
    
    async def _generate_openai(self, prompt: str, config: LLMConfig) -> LLMResponse:
        """Generate using OpenAI"""
        client = openai.AsyncOpenAI(api_key=config.api_key)
        
        response = await client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            top_p=config.top_p,
            frequency_penalty=config.frequency_penalty,
            presence_penalty=config.presence_penalty
        )
        
        choice = response.choices[0]
        return LLMResponse(
            content=choice.message.content,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            model=response.model,
            finish_reason=choice.finish_reason,
            metadata={"provider": "openai"}
        )
    
    async def _stream_openai(self, prompt: str, config: LLMConfig) -> AsyncGenerator[str, None]:
        """Stream using OpenAI"""
        client = openai.AsyncOpenAI(api_key=config.api_key)
        
        stream = await client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    
    async def _generate_anthropic(self, prompt: str, config: LLMConfig) -> LLMResponse:
        """Generate using Anthropic"""
        client = self.providers[LLMProvider.ANTHROPIC]
        
        response = await asyncio.to_thread(
            client.messages.create,
            model=config.model,
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return LLMResponse(
            content=response.content[0].text,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            },
            model=response.model,
            finish_reason=response.stop_reason,
            metadata={"provider": "anthropic"}
        )
    
    async def _stream_anthropic(self, prompt: str, config: LLMConfig) -> AsyncGenerator[str, None]:
        """Stream using Anthropic"""
        client = self.providers[LLMProvider.ANTHROPIC]
        
        with client.messages.stream(
            model=config.model,
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            for text in stream.text_stream:
                yield text
    
    async def _generate_cohere(self, prompt: str, config: LLMConfig) -> LLMResponse:
        """Generate using Cohere"""
        client = self.providers[LLMProvider.COHERE]
        
        response = await asyncio.to_thread(
            client.generate,
            prompt=prompt,
            model=config.model,
            max_tokens=config.max_tokens,
            temperature=config.temperature
        )
        
        return LLMResponse(
            content=response.generations[0].text,
            usage={
                "prompt_tokens": 0,  # Cohere doesn't provide detailed token usage
                "completion_tokens": len(response.generations[0].text.split()),
                "total_tokens": len(response.generations[0].text.split())
            },
            model=config.model,
            finish_reason="stop",
            metadata={"provider": "cohere"}
        )
    
    async def _generate_google(self, prompt: str, config: LLMConfig) -> LLMResponse:
        """Generate using Google"""
        model = genai.GenerativeModel(config.model)
        
        response = await asyncio.to_thread(
            model.generate_content,
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=config.max_tokens,
                temperature=config.temperature
            )
        )
        
        return LLMResponse(
            content=response.text,
            usage={
                "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else 0,
                "completion_tokens": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else 0,
                "total_tokens": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0
            },
            model=config.model,
            finish_reason=response.candidates[0].finish_reason.name if response.candidates else "stop",
            metadata={"provider": "google"}
        )
    
    async def code_generation(
        self,
        description: str,
        language: str,
        framework: Optional[str] = None,
        features: Optional[List[str]] = None,
        style_guide: Optional[str] = None
    ) -> LLMResponse:
        """Specialized code generation"""
        
        prompt = f"""Generate {language} code for: {description}
        
Language: {language}
Framework: {framework or 'None specified'}
Features required: {', '.join(features) if features else 'Basic functionality'}
Style guide: {style_guide or 'Follow language conventions'}

Please provide:
1. Clean, well-structured code
2. Proper error handling
3. Meaningful comments
4. Type hints/annotations where applicable
5. Security best practices

Code:"""
        
        return await self.generate(prompt, provider=LLMProvider.OPENAI, temperature=0.3)
    
    async def code_explanation(self, code: str, language: str, focus: Optional[str] = None) -> LLMResponse:
        """Explain code functionality"""
        
        prompt = f"""Explain this {language} code:

```{language}
{code}
```

{f'Please focus on: {focus}' if focus else ''}

Provide:
1. Overall purpose and functionality
2. Step-by-step breakdown
3. Key concepts used
4. Potential improvements
5. Common use cases"""
        
        return await self.generate(prompt, provider=LLMProvider.OPENAI, temperature=0.2)
    
    async def debug_assistance(
        self,
        code: str,
        error: Optional[str] = None,
        language: str = "javascript",
        context: Optional[str] = None
    ) -> LLMResponse:
        """Help debug code issues"""
        
        prompt = f"""Help debug this {language} code:

```{language}
{code}
```

{f'Error message: {error}' if error else ''}
{f'Additional context: {context}' if context else ''}

Please provide:
1. Identification of the issue(s)
2. Explanation of why it's happening
3. Step-by-step solution
4. Corrected code
5. Prevention tips for the future"""
        
        return await self.generate(prompt, provider=LLMProvider.OPENAI, temperature=0.2)
    
    async def performance_optimization(self, code: str, language: str, metrics: Optional[Dict] = None) -> LLMResponse:
        """Suggest performance optimizations"""
        
        prompt = f"""Analyze and optimize this {language} code for performance:

```{language}
{code}
```

{f'Current metrics: {json.dumps(metrics, indent=2)}' if metrics else ''}

Please provide:
1. Performance bottlenecks identified
2. Optimization strategies
3. Optimized code
4. Expected performance improvements
5. Trade-offs to consider"""
        
        return await self.generate(prompt, provider=LLMProvider.OPENAI, temperature=0.3)
    
    def get_available_providers(self) -> List[str]:
        """Get list of available providers"""
        return [provider.value for provider in self.providers.keys()]
    
    def get_provider_models(self, provider: LLMProvider) -> List[str]:
        """Get available models for a provider"""
        model_map = {
            LLMProvider.OPENAI: ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo-preview"],
            LLMProvider.ANTHROPIC: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
            LLMProvider.COHERE: ["command-r-plus", "command-r", "command"],
            LLMProvider.GOOGLE: ["gemini-pro", "gemini-pro-vision"],
            LLMProvider.LOCAL: ["stub-model"]
        }
        return model_map.get(provider, ["stub-model"])
    
    async def _generate_stub(self, prompt: str, config: LLMConfig) -> LLMResponse:
        """Generate stub response for development/testing when no API keys available"""
        await asyncio.sleep(0.1)  # Simulate API delay
        
        # Return a helpful stub response based on the prompt
        stub_content = f"""This is a stub response from the local development provider.

Original prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}

In a production environment with API keys configured, this would return:
- Generated code based on your requirements
- AI-powered suggestions and explanations
- Context-aware responses from OpenAI, Anthropic, Google, or Cohere

Configure API keys in your environment to enable full functionality:
- OPENAI_API_KEY for OpenAI GPT models
- ANTHROPIC_API_KEY for Claude models  
- GOOGLE_API_KEY for Gemini models
- COHERE_API_KEY for Command models

For now, this stub allows the service to run and be tested without API keys."""

        return LLMResponse(
            content=stub_content,
            usage={
                "prompt_tokens": len(prompt.split()),
                "completion_tokens": len(stub_content.split()),
                "total_tokens": len(prompt.split()) + len(stub_content.split())
            },
            model="stub-model",
            finish_reason="stop",
            metadata={"provider": "local", "stub": True}
        )
    
    async def _stream_stub(self, prompt: str, config: LLMConfig) -> AsyncGenerator[str, None]:
        """Stream stub response for development"""
        stub_content = await self._generate_stub(prompt, config)
        words = stub_content.content.split()
        
        for word in words:
            await asyncio.sleep(0.05)  # Simulate streaming delay
            yield word + " "
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all providers"""
        health = {}
        
        for provider in self.providers:
            try:
                # Simple test generation
                response = await self.generate(
                    "Say 'OK'", 
                    provider=provider,
                    max_tokens=10
                )
                health[provider.value] = {
                    "status": "healthy",
                    "model": self.configs[provider].model,
                    "response_length": len(response.content)
                }
            except Exception as e:
                health[provider.value] = {
                    "status": "error",
                    "error": str(e)
                }
        
        return health

# Global instance
llm_manager = LLMManager()