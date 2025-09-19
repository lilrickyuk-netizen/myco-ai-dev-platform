"""
Comprehensive tests for LLM Manager with negative path testing
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from services.llm_manager import LLMManager, LLMProvider, LLMConfig, LLMResponse

class TestLLMManager:
    """Test suite for LLM Manager"""
    
    @pytest.fixture
    def llm_manager(self):
        """Create LLM manager instance for testing"""
        manager = LLMManager()
        return manager
    
    @pytest.fixture
    def mock_openai_response(self):
        """Mock OpenAI response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Test response"
        mock_response.choices[0].finish_reason = "stop"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30
        mock_response.model = "gpt-3.5-turbo"
        mock_response.id = "test-id"
        mock_response.created = 1234567890
        return mock_response

    def test_initialization(self, llm_manager):
        """Test LLM manager initialization"""
        assert llm_manager is not None
        assert LLMProvider.LOCAL in llm_manager.providers
        assert llm_manager.default_provider == LLMProvider.LOCAL

    @pytest.mark.asyncio
    async def test_generate_with_stub_provider(self, llm_manager):
        """Test generation with stub provider"""
        response = await llm_manager.generate("Test prompt")
        
        assert response is not None
        assert isinstance(response, LLMResponse)
        assert "stub response" in response.content.lower()
        assert response.model == "stub-model"
        assert response.metadata.get("stub") is True

    @pytest.mark.asyncio
    async def test_generate_stream_with_stub_provider(self, llm_manager):
        """Test streaming generation with stub provider"""
        chunks = []
        async for chunk in llm_manager.generate_stream("Test prompt"):
            chunks.append(chunk)
        
        assert len(chunks) > 0
        assert all(isinstance(chunk, str) for chunk in chunks)

    @pytest.mark.asyncio
    async def test_generate_with_context(self, llm_manager):
        """Test generation with context"""
        response = await llm_manager.generate(
            prompt="Test prompt",
            context="Test context"
        )
        
        assert response is not None
        assert "Test prompt" in response.content
        assert "Test context" in response.content

    @pytest.mark.asyncio
    async def test_generate_with_invalid_provider(self, llm_manager):
        """Test generation with invalid provider"""
        with pytest.raises(ValueError, match="Provider .* not available"):
            await llm_manager.generate(
                "Test prompt",
                provider=LLMProvider.OPENAI  # Not configured in test
            )

    @pytest.mark.asyncio
    @patch('services.llm_manager.openai')
    async def test_generate_with_openai_timeout(self, mock_openai, llm_manager):
        """Test OpenAI generation timeout"""
        # Mock OpenAI to be available
        llm_manager.providers[LLMProvider.OPENAI] = mock_openai
        llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
            provider=LLMProvider.OPENAI,
            model="gpt-3.5-turbo",
            api_key="test-key"
        )
        
        # Mock timeout
        mock_client = AsyncMock()
        mock_openai.AsyncOpenAI.return_value = mock_client
        mock_client.chat.completions.create.side_effect = asyncio.TimeoutError()
        
        with pytest.raises(asyncio.TimeoutError):
            await llm_manager.generate(
                "Test prompt",
                provider=LLMProvider.OPENAI
            )

    @pytest.mark.asyncio
    @patch('services.llm_manager.openai')
    async def test_generate_with_openai_success(self, mock_openai, llm_manager, mock_openai_response):
        """Test successful OpenAI generation"""
        # Mock OpenAI to be available
        llm_manager.providers[LLMProvider.OPENAI] = mock_openai
        llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
            provider=LLMProvider.OPENAI,
            model="gpt-3.5-turbo",
            api_key="test-key"
        )
        
        mock_client = AsyncMock()
        mock_openai.AsyncOpenAI.return_value = mock_client
        mock_client.chat.completions.create.return_value = mock_openai_response
        
        response = await llm_manager.generate(
            "Test prompt",
            provider=LLMProvider.OPENAI
        )
        
        assert response.content == "Test response"
        assert response.model == "gpt-3.5-turbo"
        assert response.usage["total_tokens"] == 30

    @pytest.mark.asyncio
    @patch('services.llm_manager.anthropic')
    async def test_generate_with_anthropic_error(self, mock_anthropic, llm_manager):
        """Test Anthropic generation error"""
        # Mock Anthropic to be available
        mock_client = Mock()
        llm_manager.providers[LLMProvider.ANTHROPIC] = mock_client
        llm_manager.configs[LLMProvider.ANTHROPIC] = LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            model="claude-3-sonnet",
            api_key="test-key"
        )
        
        # Mock error
        with patch('asyncio.to_thread') as mock_to_thread:
            mock_to_thread.side_effect = Exception("Anthropic API error")
            
            with pytest.raises(Exception, match="Anthropic API error"):
                await llm_manager.generate(
                    "Test prompt",
                    provider=LLMProvider.ANTHROPIC
                )

    @pytest.mark.asyncio
    async def test_code_generation(self, llm_manager):
        """Test specialized code generation"""
        response = await llm_manager.code_generation(
            description="Create a React component",
            language="typescript",
            framework="react",
            features=["hooks", "props"],
            style_guide="eslint-airbnb"
        )
        
        assert response is not None
        assert "React component" in response.content

    @pytest.mark.asyncio
    async def test_code_explanation(self, llm_manager):
        """Test code explanation"""
        test_code = """
        function factorial(n) {
            if (n <= 1) return 1;
            return n * factorial(n - 1);
        }
        """
        
        response = await llm_manager.code_explanation(
            code=test_code,
            language="javascript",
            focus="recursion"
        )
        
        assert response is not None
        assert "factorial" in response.content

    @pytest.mark.asyncio
    async def test_debug_assistance(self, llm_manager):
        """Test debug assistance"""
        test_code = "console.log(undefined_variable);"
        error_message = "ReferenceError: undefined_variable is not defined"
        
        response = await llm_manager.debug_assistance(
            code=test_code,
            error=error_message,
            language="javascript",
            context="Node.js application"
        )
        
        assert response is not None
        assert "undefined_variable" in response.content

    @pytest.mark.asyncio
    async def test_performance_optimization(self, llm_manager):
        """Test performance optimization"""
        test_code = """
        for (let i = 0; i < 1000000; i++) {
            document.getElementById('my-element').innerHTML = i;
        }
        """
        
        response = await llm_manager.performance_optimization(
            code=test_code,
            language="javascript",
            metrics={"execution_time": 5000}
        )
        
        assert response is not None
        assert "performance" in response.content.lower()

    def test_get_available_providers(self, llm_manager):
        """Test getting available providers"""
        providers = llm_manager.get_available_providers()
        assert isinstance(providers, list)
        assert "local" in providers

    def test_get_provider_models(self, llm_manager):
        """Test getting provider models"""
        models = llm_manager.get_provider_models(LLMProvider.LOCAL)
        assert isinstance(models, list)
        assert "stub-model" in models
        
        openai_models = llm_manager.get_provider_models(LLMProvider.OPENAI)
        assert "gpt-4" in openai_models
        assert "gpt-3.5-turbo" in openai_models

    @pytest.mark.asyncio
    async def test_health_check(self, llm_manager):
        """Test health check"""
        health = await llm_manager.health_check()
        
        assert isinstance(health, dict)
        assert "local" in health
        assert health["local"]["status"] in ["healthy", "error"]

    @pytest.mark.asyncio
    async def test_health_check_with_provider_error(self, llm_manager):
        """Test health check with provider error"""
        # Temporarily break the stub provider
        original_generate = llm_manager._generate_stub
        llm_manager._generate_stub = AsyncMock(side_effect=Exception("Test error"))
        
        health = await llm_manager.health_check()
        
        assert health["local"]["status"] == "error"
        assert "Test error" in health["local"]["error"]
        
        # Restore original method
        llm_manager._generate_stub = original_generate

    def test_format_openai_response(self, llm_manager):
        """Test OpenAI response formatting"""
        response = LLMResponse(
            content="Test content",
            usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            model="test-model",
            finish_reason="stop",
            metadata={"provider": "test"}
        )
        
        formatted = llm_manager.format_openai_response(response, "test-request-id")
        
        assert formatted["id"] == "test-request-id"
        assert formatted["object"] == "chat.completion"
        assert formatted["model"] == "test-model"
        assert formatted["choices"][0]["message"]["content"] == "Test content"
        assert formatted["usage"]["total_tokens"] == 30

    @pytest.mark.asyncio
    async def test_concurrent_generations(self, llm_manager):
        """Test concurrent generation requests"""
        tasks = [
            llm_manager.generate(f"Test prompt {i}")
            for i in range(5)
        ]
        
        responses = await asyncio.gather(*tasks)
        
        assert len(responses) == 5
        assert all(isinstance(r, LLMResponse) for r in responses)

    @pytest.mark.asyncio
    async def test_large_prompt_handling(self, llm_manager):
        """Test handling of large prompts"""
        large_prompt = "a" * 10000
        
        response = await llm_manager.generate(large_prompt)
        
        assert response is not None
        assert len(response.content) > 0

    @pytest.mark.asyncio
    async def test_empty_prompt_handling(self, llm_manager):
        """Test handling of empty prompts"""
        response = await llm_manager.generate("")
        
        assert response is not None
        # Stub should handle empty prompts gracefully

    @pytest.mark.asyncio
    async def test_special_characters_in_prompt(self, llm_manager):
        """Test handling of special characters in prompts"""
        special_prompt = "Test with émojis 🚀 and symbols @#$%^&*()"
        
        response = await llm_manager.generate(special_prompt)
        
        assert response is not None
        assert len(response.content) > 0

# Integration tests
class TestLLMManagerIntegration:
    """Integration tests for LLM Manager"""
    
    @pytest.mark.asyncio
    async def test_provider_fallback_chain(self):
        """Test provider fallback when primary provider fails"""
        manager = LLMManager()
        
        # Mock multiple providers with failures
        with patch.dict(manager.providers, {
            LLMProvider.OPENAI: Mock(),
            LLMProvider.ANTHROPIC: Mock(),
            LLMProvider.LOCAL: "stub"
        }):
            # All external providers should fail, fall back to stub
            response = await manager.generate("Test prompt")
            assert response is not None
            assert response.metadata.get("stub") is True

    @pytest.mark.asyncio
    async def test_rate_limiting_simulation(self, llm_manager):
        """Test rate limiting behavior simulation"""
        # Simulate rapid requests
        start_time = asyncio.get_event_loop().time()
        
        tasks = [
            llm_manager.generate(f"Request {i}")
            for i in range(10)
        ]
        
        responses = await asyncio.gather(*tasks)
        
        end_time = asyncio.get_event_loop().time()
        
        # All requests should complete
        assert len(responses) == 10
        assert all(r is not None for r in responses)
        
        # Should take some time due to stub delays
        assert end_time - start_time > 0.5  # Minimum expected time