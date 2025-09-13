"""
Tests for LLM Manager service
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from ai_engine.services.llm_manager import LLMManager, LLMProvider, LLMConfig, LLMResponse


class TestLLMManager:
    """Test LLM Manager functionality"""

    @pytest.fixture
    def llm_manager(self):
        """Create LLM manager instance for testing"""
        return LLMManager()

    @pytest.fixture
    def mock_openai_response(self):
        """Mock OpenAI API response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Generated response"
        mock_response.choices[0].finish_reason = "stop"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 5
        mock_response.usage.total_tokens = 15
        mock_response.model = "gpt-4"
        return mock_response

    @pytest.fixture
    def mock_anthropic_response(self):
        """Mock Anthropic API response"""
        mock_response = Mock()
        mock_response.content = [Mock()]
        mock_response.content[0].text = "Generated response"
        mock_response.stop_reason = "end_turn"
        mock_response.usage.input_tokens = 10
        mock_response.usage.output_tokens = 5
        mock_response.model = "claude-3-sonnet-20240229"
        return mock_response

    def test_initialization(self, llm_manager):
        """Test LLM manager initialization"""
        assert llm_manager is not None
        assert isinstance(llm_manager.providers, dict)
        assert isinstance(llm_manager.configs, dict)
        assert llm_manager.default_provider == LLMProvider.OPENAI

    def test_provider_initialization_with_api_keys(self, llm_manager):
        """Test provider initialization when API keys are available"""
        with patch.dict('os.environ', {
            'OPENAI_API_KEY': 'test-openai-key',
            'ANTHROPIC_API_KEY': 'test-anthropic-key'
        }):
            with patch('ai_engine.services.llm_manager.openai') as mock_openai:
                with patch('ai_engine.services.llm_manager.anthropic') as mock_anthropic:
                    llm_manager._initialize_providers()
                    
                    assert LLMProvider.OPENAI in llm_manager.configs
                    assert LLMProvider.ANTHROPIC in llm_manager.configs
                    assert llm_manager.configs[LLMProvider.OPENAI].api_key == 'test-openai-key'
                    assert llm_manager.configs[LLMProvider.ANTHROPIC].api_key == 'test-anthropic-key'

    def test_provider_initialization_without_api_keys(self, llm_manager):
        """Test provider initialization when no API keys are available"""
        with patch.dict('os.environ', {}, clear=True):
            llm_manager._initialize_providers()
            assert len(llm_manager.providers) == 0

    @pytest.mark.asyncio
    async def test_openai_generation(self, llm_manager, mock_openai_response):
        """Test OpenAI text generation"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            result = await llm_manager.generate(
                prompt="Test prompt",
                provider=LLMProvider.OPENAI
            )
            
            assert isinstance(result, LLMResponse)
            assert result.content == "Generated response"
            assert result.model == "gpt-4"
            assert result.usage["total_tokens"] == 15
            assert result.metadata["provider"] == "openai"

    @pytest.mark.asyncio
    async def test_anthropic_generation(self, llm_manager, mock_anthropic_response):
        """Test Anthropic text generation"""
        with patch('ai_engine.services.llm_manager.anthropic') as mock_anthropic:
            mock_client = Mock()
            
            # Setup async execution for anthropic
            async def mock_to_thread(func, *args, **kwargs):
                return mock_anthropic_response
            
            with patch('asyncio.to_thread', side_effect=mock_to_thread):
                # Setup provider
                llm_manager.providers[LLMProvider.ANTHROPIC] = mock_client
                llm_manager.configs[LLMProvider.ANTHROPIC] = LLMConfig(
                    provider=LLMProvider.ANTHROPIC,
                    model="claude-3-sonnet-20240229",
                    api_key="test-key"
                )
                
                result = await llm_manager.generate(
                    prompt="Test prompt",
                    provider=LLMProvider.ANTHROPIC
                )
                
                assert isinstance(result, LLMResponse)
                assert result.content == "Generated response"
                assert result.model == "claude-3-sonnet-20240229"
                assert result.usage["input_tokens"] == 10
                assert result.usage["output_tokens"] == 5
                assert result.metadata["provider"] == "anthropic"

    @pytest.mark.asyncio
    async def test_generation_with_context(self, llm_manager, mock_openai_response):
        """Test text generation with context"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            result = await llm_manager.generate(
                prompt="Test prompt",
                context="Test context",
                provider=LLMProvider.OPENAI
            )
            
            # Verify the context was included in the prompt
            call_args = mock_client.chat.completions.create.call_args
            messages = call_args[1]["messages"]
            prompt_content = messages[0]["content"]
            
            assert "Context:" in prompt_content
            assert "Test context" in prompt_content
            assert "Test prompt" in prompt_content

    @pytest.mark.asyncio
    async def test_streaming_generation(self, llm_manager):
        """Test streaming text generation"""
        mock_chunks = [
            Mock(choices=[Mock(delta=Mock(content="Hello"))]),
            Mock(choices=[Mock(delta=Mock(content=" world"))]),
            Mock(choices=[Mock(delta=Mock(content="!"))])
        ]
        
        async def mock_stream():
            for chunk in mock_chunks:
                yield chunk
        
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_stream()
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            chunks = []
            async for chunk in llm_manager.generate_stream(
                prompt="Test prompt",
                provider=LLMProvider.OPENAI
            ):
                chunks.append(chunk)
            
            assert chunks == ["Hello", " world", "!"]

    @pytest.mark.asyncio
    async def test_code_generation(self, llm_manager, mock_openai_response):
        """Test specialized code generation"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_openai_response.choices[0].message.content = "function hello() { return 'Hello World'; }"
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            result = await llm_manager.code_generation(
                description="Create a hello world function",
                language="javascript",
                framework="vanilla",
                features=["function", "return"],
                style_guide="standard"
            )
            
            assert isinstance(result, LLMResponse)
            assert "function hello()" in result.content
            
            # Verify the prompt was constructed correctly
            call_args = mock_client.chat.completions.create.call_args
            messages = call_args[1]["messages"]
            prompt_content = messages[0]["content"]
            
            assert "javascript" in prompt_content
            assert "Create a hello world function" in prompt_content
            assert "function, return" in prompt_content

    @pytest.mark.asyncio
    async def test_code_explanation(self, llm_manager, mock_openai_response):
        """Test code explanation functionality"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_openai_response.choices[0].message.content = "This function prints hello world"
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            code = "console.log('Hello, World!');"
            result = await llm_manager.code_explanation(
                code=code,
                language="javascript",
                focus="purpose"
            )
            
            assert isinstance(result, LLMResponse)
            assert "function" in result.content
            
            # Verify the code was included in the prompt
            call_args = mock_client.chat.completions.create.call_args
            messages = call_args[1]["messages"]
            prompt_content = messages[0]["content"]
            
            assert code in prompt_content
            assert "javascript" in prompt_content
            assert "purpose" in prompt_content

    @pytest.mark.asyncio
    async def test_debug_assistance(self, llm_manager, mock_openai_response):
        """Test debug assistance functionality"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_openai_response.choices[0].message.content = "The error is caused by undefined variable"
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            code = "console.log(undefinedVar);"
            error = "ReferenceError: undefinedVar is not defined"
            
            result = await llm_manager.debug_assistance(
                code=code,
                error=error,
                language="javascript",
                context="Node.js environment"
            )
            
            assert isinstance(result, LLMResponse)
            assert "undefined" in result.content
            
            # Verify all information was included in the prompt
            call_args = mock_client.chat.completions.create.call_args
            messages = call_args[1]["messages"]
            prompt_content = messages[0]["content"]
            
            assert code in prompt_content
            assert error in prompt_content
            assert "Node.js environment" in prompt_content

    @pytest.mark.asyncio
    async def test_performance_optimization(self, llm_manager, mock_openai_response):
        """Test performance optimization functionality"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_openai_response.choices[0].message.content = "Use array methods instead of loops"
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            code = "for(let i=0; i<array.length; i++) { console.log(array[i]); }"
            metrics = {"execution_time": "100ms", "memory_usage": "50MB"}
            
            result = await llm_manager.performance_optimization(
                code=code,
                language="javascript",
                metrics=metrics
            )
            
            assert isinstance(result, LLMResponse)
            assert "array" in result.content
            
            # Verify metrics were included
            call_args = mock_client.chat.completions.create.call_args
            messages = call_args[1]["messages"]
            prompt_content = messages[0]["content"]
            
            assert code in prompt_content
            assert "100ms" in prompt_content
            assert "50MB" in prompt_content

    @pytest.mark.asyncio
    async def test_error_handling(self, llm_manager):
        """Test error handling for API failures"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.side_effect = Exception("API Error")
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            with pytest.raises(Exception) as exc_info:
                await llm_manager.generate(
                    prompt="Test prompt",
                    provider=LLMProvider.OPENAI
                )
            
            assert "API Error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_unsupported_provider(self, llm_manager):
        """Test error handling for unsupported providers"""
        with pytest.raises(ValueError) as exc_info:
            await llm_manager.generate(
                prompt="Test prompt",
                provider=LLMProvider.OPENAI  # Not configured
            )
        
        assert "not available" in str(exc_info.value)

    def test_get_available_providers(self, llm_manager):
        """Test getting available providers"""
        llm_manager.providers[LLMProvider.OPENAI] = Mock()
        llm_manager.providers[LLMProvider.ANTHROPIC] = Mock()
        
        providers = llm_manager.get_available_providers()
        
        assert "openai" in providers
        assert "anthropic" in providers
        assert len(providers) == 2

    def test_get_provider_models(self, llm_manager):
        """Test getting models for a provider"""
        openai_models = llm_manager.get_provider_models(LLMProvider.OPENAI)
        anthropic_models = llm_manager.get_provider_models(LLMProvider.ANTHROPIC)
        
        assert "gpt-4" in openai_models
        assert "gpt-3.5-turbo" in openai_models
        assert "claude-3-opus-20240229" in anthropic_models
        assert "claude-3-sonnet-20240229" in anthropic_models

    @pytest.mark.asyncio
    async def test_health_check(self, llm_manager, mock_openai_response):
        """Test health check functionality"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_openai_response.choices[0].message.content = "OK"
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            health = await llm_manager.health_check()
            
            assert "openai" in health
            assert health["openai"]["status"] == "healthy"
            assert health["openai"]["model"] == "gpt-4"
            assert health["openai"]["response_length"] == 2  # "OK"

    @pytest.mark.asyncio
    async def test_health_check_with_error(self, llm_manager):
        """Test health check with provider error"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.side_effect = Exception("Connection error")
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            health = await llm_manager.health_check()
            
            assert "openai" in health
            assert health["openai"]["status"] == "error"
            assert "Connection error" in health["openai"]["error"]

    def test_build_prompt_without_context(self, llm_manager):
        """Test prompt building without context"""
        prompt = "Test prompt"
        result = llm_manager._build_prompt(prompt)
        
        assert result == prompt

    def test_build_prompt_with_context(self, llm_manager):
        """Test prompt building with context"""
        prompt = "Test prompt"
        context = "Test context"
        result = llm_manager._build_prompt(prompt, context)
        
        assert "Context:" in result
        assert context in result
        assert prompt in result
        assert "Request:" in result

    @pytest.mark.asyncio
    async def test_custom_parameters(self, llm_manager, mock_openai_response):
        """Test generation with custom parameters"""
        with patch('ai_engine.services.llm_manager.openai') as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_openai_response
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Setup provider
            llm_manager.providers[LLMProvider.OPENAI] = mock_openai
            llm_manager.configs[LLMProvider.OPENAI] = LLMConfig(
                provider=LLMProvider.OPENAI,
                model="gpt-4",
                api_key="test-key"
            )
            
            await llm_manager.generate(
                prompt="Test prompt",
                provider=LLMProvider.OPENAI,
                max_tokens=100,
                temperature=0.5,
                top_p=0.9
            )
            
            # Verify custom parameters were used
            call_args = mock_client.chat.completions.create.call_args
            assert call_args[1]["max_tokens"] == 100
            assert call_args[1]["temperature"] == 0.5
            assert call_args[1]["top_p"] == 0.9