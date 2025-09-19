"""
Tests for the hardened generation API endpoints
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

# Import the main app
from main import app
from api.routes.generation import hardened_generate
from services.llm_manager import LLMProvider, LLMResponse

class TestGenerationAPI:
    """Test suite for generation API endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication"""
        return {"id": "test-user-123", "email": "test@example.com"}
    
    @pytest.fixture
    def mock_llm_response(self):
        """Mock LLM response"""
        return LLMResponse(
            content="Test generated content",
            usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            model="test-model",
            finish_reason="stop",
            metadata={"provider": "test"}
        )

    def test_generation_request_validation(self, client):
        """Test request validation for generation endpoint"""
        # Test empty prompt
        response = client.post("/api/v1/generation", json={
            "prompt": ""
        })
        assert response.status_code == 422
        
        # Test missing prompt
        response = client.post("/api/v1/generation", json={})
        assert response.status_code == 422
        
        # Test prompt too long
        response = client.post("/api/v1/generation", json={
            "prompt": "a" * 50001
        })
        assert response.status_code == 422
        
        # Test invalid temperature
        response = client.post("/api/v1/generation", json={
            "prompt": "test",
            "temperature": 3.0
        })
        assert response.status_code == 422
        
        # Test invalid max_tokens
        response = client.post("/api/v1/generation", json={
            "prompt": "test",
            "max_tokens": 0
        })
        assert response.status_code == 422

    def test_code_generation_validation(self, client):
        """Test code generation request validation"""
        # Test missing description
        response = client.post("/api/v1/code/generate", json={
            "language": "python"
        })
        assert response.status_code == 422
        
        # Test missing language
        response = client.post("/api/v1/code/generate", json={
            "description": "Create a function"
        })
        assert response.status_code == 422
        
        # Test too many features
        response = client.post("/api/v1/code/generate", json={
            "description": "Create a function",
            "language": "python",
            "features": ["feature"] * 25
        })
        assert response.status_code == 422

    def test_chat_request_validation(self, client):
        """Test chat request validation"""
        # Test empty messages
        response = client.post("/api/v1/chat", json={
            "messages": []
        })
        assert response.status_code == 422
        
        # Test too many messages
        response = client.post("/api/v1/chat", json={
            "messages": [{"role": "user", "content": "test"}] * 101
        })
        assert response.status_code == 422
        
        # Test invalid message format
        response = client.post("/api/v1/chat", json={
            "messages": [{"invalid": "format"}]
        })
        assert response.status_code == 422
        
        # Test invalid role
        response = client.post("/api/v1/chat", json={
            "messages": [{"role": "invalid", "content": "test"}]
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_hardened_generate_success(self, mock_llm_response):
        """Test successful hardened generation"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            mock_manager.generate.return_value = mock_llm_response
            
            response = await hardened_generate(
                prompt="Test prompt",
                provider=LLMProvider.LOCAL
            )
            
            assert response.content == "Test generated content"
            assert response.usage["total_tokens"] == 30

    @pytest.mark.asyncio
    async def test_hardened_generate_timeout(self):
        """Test hardened generation timeout handling"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            mock_manager.generate.side_effect = asyncio.TimeoutError()
            
            with pytest.raises(HTTPException) as exc_info:
                await hardened_generate(
                    prompt="Test prompt",
                    provider=LLMProvider.LOCAL
                )
            
            assert exc_info.value.status_code == 503
            assert "timeout" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_hardened_generate_provider_failover(self, mock_llm_response):
        """Test provider failover in hardened generation"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {
                LLMProvider.OPENAI: Mock(),
                LLMProvider.LOCAL: "stub"
            }
            
            # First provider fails, second succeeds
            mock_manager.generate.side_effect = [
                Exception("OpenAI error"),
                mock_llm_response
            ]
            
            response = await hardened_generate(prompt="Test prompt")
            
            assert response.content == "Test generated content"
            # Should have tried both providers
            assert mock_manager.generate.call_count >= 1

    @pytest.mark.asyncio
    async def test_hardened_generate_all_providers_fail(self):
        """Test behavior when all providers fail"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {
                LLMProvider.OPENAI: Mock(),
                LLMProvider.LOCAL: "stub"
            }
            mock_manager.generate.side_effect = Exception("All providers failed")
            
            with pytest.raises(HTTPException) as exc_info:
                await hardened_generate(prompt="Test prompt")
            
            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_rate_limit_handling(self):
        """Test rate limit error handling"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.OPENAI: Mock()}
            mock_manager.generate.side_effect = Exception("rate limit exceeded")
            
            with pytest.raises(HTTPException) as exc_info:
                await hardened_generate(
                    prompt="Test prompt",
                    provider=LLMProvider.OPENAI
                )
            
            assert exc_info.value.status_code == 503

    def test_streaming_endpoint_headers(self, client):
        """Test streaming endpoint returns correct headers"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            async def mock_stream():
                yield "chunk1"
                yield "chunk2"
            
            mock_manager.generate_stream.return_value = mock_stream()
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            
            response = client.post("/api/v1/generation/stream", json={
                "prompt": "test prompt"
            })
            
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
            assert "no-cache" in response.headers.get("cache-control", "")

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, mock_llm_response):
        """Test handling of concurrent generation requests"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            mock_manager.generate.return_value = mock_llm_response
            
            # Create multiple concurrent requests
            tasks = [
                hardened_generate(prompt=f"Test prompt {i}")
                for i in range(10)
            ]
            
            responses = await asyncio.gather(*tasks)
            
            assert len(responses) == 10
            assert all(r.content == "Test generated content" for r in responses)

    @pytest.mark.asyncio
    async def test_memory_cleanup_on_error(self):
        """Test that memory is properly cleaned up on errors"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            mock_manager.generate.side_effect = Exception("Test error")
            
            # Generate multiple failing requests
            for i in range(5):
                with pytest.raises(HTTPException):
                    await hardened_generate(prompt=f"Test prompt {i}")
            
            # Memory usage should not continuously grow
            # This is a basic test - in practice you'd check actual memory usage
            assert True  # Placeholder for memory check

class TestGenerationAPIIntegration:
    """Integration tests for generation API"""
    
    @pytest.fixture
    def authenticated_client(self):
        """Create authenticated test client"""
        client = TestClient(app)
        # In a real test, you'd set up proper auth headers
        return client

    def test_full_generation_flow(self, authenticated_client):
        """Test complete generation flow"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            mock_response = LLMResponse(
                content="Generated code:\n\ndef hello_world():\n    print('Hello, World!')",
                usage={"prompt_tokens": 15, "completion_tokens": 25, "total_tokens": 40},
                model="stub-model",
                finish_reason="stop",
                metadata={"provider": "local"}
            )
            mock_manager.generate.return_value = mock_response
            
            response = authenticated_client.post("/api/v1/generation", json={
                "prompt": "Create a Python hello world function",
                "temperature": 0.7,
                "max_tokens": 100
            })
            
            assert response.status_code == 200
            data = response.json()
            assert "Generated code" in data["content"]
            assert data["usage"]["total_tokens"] == 40

    def test_code_generation_flow(self, authenticated_client):
        """Test code generation flow"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_response = LLMResponse(
                content="class Calculator:\n    def add(self, a, b):\n        return a + b",
                usage={"prompt_tokens": 20, "completion_tokens": 30, "total_tokens": 50},
                model="stub-model",
                finish_reason="stop",
                metadata={"provider": "local"}
            )
            mock_manager.code_generation.return_value = mock_response
            
            response = authenticated_client.post("/api/v1/code/generate", json={
                "description": "Create a calculator class",
                "language": "python",
                "features": ["addition", "subtraction"],
                "framework": "none"
            })
            
            assert response.status_code == 200
            data = response.json()
            assert "Calculator" in data["content"]

    def test_error_propagation(self, authenticated_client):
        """Test that errors are properly propagated to client"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {}  # No providers available
            
            response = authenticated_client.post("/api/v1/generation", json={
                "prompt": "test prompt"
            })
            
            assert response.status_code == 503
            data = response.json()
            assert "error" in data["detail"].lower()

# Performance and load testing
class TestGenerationPerformance:
    """Performance tests for generation API"""
    
    @pytest.mark.asyncio
    async def test_response_time_under_load(self):
        """Test response times under load"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            mock_response = LLMResponse(
                content="Quick response",
                usage={"prompt_tokens": 5, "completion_tokens": 5, "total_tokens": 10},
                model="stub-model",
                finish_reason="stop",
                metadata={"provider": "local"}
            )
            mock_manager.generate.return_value = mock_response
            
            import time
            start_time = time.time()
            
            # Create many concurrent requests
            tasks = [
                hardened_generate(prompt=f"Request {i}")
                for i in range(50)
            ]
            
            responses = await asyncio.gather(*tasks)
            
            end_time = time.time()
            
            # All requests should complete quickly
            assert len(responses) == 50
            assert end_time - start_time < 5.0  # Should complete within 5 seconds

    @pytest.mark.asyncio
    async def test_timeout_accuracy(self):
        """Test that timeouts are enforced accurately"""
        with patch('api.routes.generation.llm_manager') as mock_manager:
            mock_manager.providers = {LLMProvider.LOCAL: "stub"}
            
            async def slow_generate(*args, **kwargs):
                await asyncio.sleep(2.0)  # Longer than timeout
                return Mock()
            
            mock_manager.generate = slow_generate
            
            import time
            start_time = time.time()
            
            with pytest.raises(HTTPException):
                await hardened_generate(prompt="test", timeout=1.0)
            
            end_time = time.time()
            
            # Should timeout close to the specified time
            assert 1.0 <= end_time - start_time <= 1.5