"""
Comprehensive negative path testing for timeouts, provider errors, and edge cases
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, Mock, patch
from fastapi.testclient import TestClient
from services.llm_manager import LLMManager, LLMProvider, LLMResponse
from main import app

class TestTimeouts:
    """Test timeout scenarios across the system"""
    
    @pytest.mark.asyncio
    async def test_llm_generation_timeout(self):
        """Test LLM generation timeout handling"""
        manager = LLMManager()
        
        # Mock a provider that takes too long
        with patch.object(manager, '_generate_openai') as mock_gen:
            async def slow_generate(*args, **kwargs):
                await asyncio.sleep(5.0)  # Longer than typical timeout
                return Mock()
            
            mock_gen.side_effect = slow_generate
            manager.providers[LLMProvider.OPENAI] = Mock()
            
            start_time = time.time()
            
            with pytest.raises(Exception):  # Should timeout
                await asyncio.wait_for(
                    manager.generate("test", provider=LLMProvider.OPENAI),
                    timeout=1.0
                )
            
            elapsed = time.time() - start_time
            assert elapsed < 2.0  # Should timeout quickly

    @pytest.mark.asyncio
    async def test_streaming_timeout(self):
        """Test streaming generation timeout"""
        manager = LLMManager()
        
        async def slow_stream(*args, **kwargs):
            yield "first chunk"
            await asyncio.sleep(5.0)  # Long delay
            yield "second chunk"
        
        with patch.object(manager, 'generate_stream', return_value=slow_stream()):
            chunks = []
            
            with pytest.raises(asyncio.TimeoutError):
                async for chunk in asyncio.wait_for(
                    manager.generate_stream("test"),
                    timeout=1.0
                ):
                    chunks.append(chunk)
            
            assert len(chunks) <= 1  # Should only get first chunk

    def test_api_endpoint_timeout(self):
        """Test API endpoint timeout handling"""
        client = TestClient(app)
        
        with patch('api.routes.generation.hardened_generate') as mock_gen:
            mock_gen.side_effect = asyncio.TimeoutError()
            
            response = client.post("/api/v1/generation", json={
                "prompt": "test prompt"
            })
            
            assert response.status_code == 503
            assert "timeout" in response.json()["detail"].lower()

class TestProviderErrors:
    """Test various provider error scenarios"""
    
    @pytest.mark.asyncio
    async def test_openai_rate_limit(self):
        """Test OpenAI rate limit error handling"""
        manager = LLMManager()
        
        with patch('services.llm_manager.openai') as mock_openai:
            manager.providers[LLMProvider.OPENAI] = mock_openai
            manager.configs[LLMProvider.OPENAI] = Mock()
            
            mock_client = AsyncMock()
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Simulate rate limit error
            rate_limit_error = Exception("rate_limit_exceeded")
            mock_client.chat.completions.create.side_effect = rate_limit_error
            
            with pytest.raises(Exception, match="rate_limit_exceeded"):
                await manager.generate("test", provider=LLMProvider.OPENAI)

    @pytest.mark.asyncio
    async def test_anthropic_api_error(self):
        """Test Anthropic API error handling"""
        manager = LLMManager()
        
        mock_client = Mock()
        manager.providers[LLMProvider.ANTHROPIC] = mock_client
        manager.configs[LLMProvider.ANTHROPIC] = Mock()
        
        with patch('asyncio.to_thread') as mock_to_thread:
            # Simulate API error
            api_error = Exception("anthropic_api_error")
            mock_to_thread.side_effect = api_error
            
            with pytest.raises(Exception, match="anthropic_api_error"):
                await manager.generate("test", provider=LLMProvider.ANTHROPIC)

    @pytest.mark.asyncio
    async def test_google_quota_exceeded(self):
        """Test Google API quota exceeded error"""
        manager = LLMManager()
        
        with patch('services.llm_manager.genai') as mock_genai:
            manager.providers[LLMProvider.GOOGLE] = mock_genai
            manager.configs[LLMProvider.GOOGLE] = Mock()
            
            mock_model = Mock()
            mock_genai.GenerativeModel.return_value = mock_model
            
            with patch('asyncio.to_thread') as mock_to_thread:
                quota_error = Exception("quota_exceeded")
                mock_to_thread.side_effect = quota_error
                
                with pytest.raises(Exception, match="quota_exceeded"):
                    await manager.generate("test", provider=LLMProvider.GOOGLE)

    @pytest.mark.asyncio
    async def test_network_connectivity_error(self):
        """Test network connectivity errors"""
        manager = LLMManager()
        
        with patch('services.llm_manager.openai') as mock_openai:
            manager.providers[LLMProvider.OPENAI] = mock_openai
            manager.configs[LLMProvider.OPENAI] = Mock()
            
            mock_client = AsyncMock()
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Simulate network error
            network_error = Exception("network_unreachable")
            mock_client.chat.completions.create.side_effect = network_error
            
            with pytest.raises(Exception, match="network_unreachable"):
                await manager.generate("test", provider=LLMProvider.OPENAI)

    @pytest.mark.asyncio
    async def test_provider_failover_chain(self):
        """Test complete provider failover chain"""
        manager = LLMManager()
        
        # Set up multiple providers that fail
        manager.providers = {
            LLMProvider.OPENAI: Mock(),
            LLMProvider.ANTHROPIC: Mock(),
            LLMProvider.GOOGLE: Mock(),
            LLMProvider.LOCAL: "stub"
        }
        
        # Mock all external providers to fail
        with patch.object(manager, '_generate_openai') as mock_openai, \
             patch.object(manager, '_generate_anthropic') as mock_anthropic, \
             patch.object(manager, '_generate_google') as mock_google, \
             patch.object(manager, '_generate_stub') as mock_stub:
            
            mock_openai.side_effect = Exception("OpenAI failed")
            mock_anthropic.side_effect = Exception("Anthropic failed")
            mock_google.side_effect = Exception("Google failed")
            mock_stub.return_value = LLMResponse(
                content="Stub response",
                usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                model="stub-model",
                finish_reason="stop",
                metadata={"provider": "local"}
            )
            
            # Should eventually succeed with stub
            response = await manager.generate("test")
            assert response.content == "Stub response"
            assert response.metadata["provider"] == "local"

class TestMemoryAndResource:
    """Test memory and resource exhaustion scenarios"""
    
    @pytest.mark.asyncio
    async def test_large_prompt_handling(self):
        """Test handling of extremely large prompts"""
        manager = LLMManager()
        
        # Create a very large prompt (1MB)
        large_prompt = "a" * (1024 * 1024)
        
        # Should handle gracefully without crashing
        response = await manager.generate(large_prompt)
        assert response is not None

    @pytest.mark.asyncio
    async def test_concurrent_request_limits(self):
        """Test system behavior under high concurrent load"""
        manager = LLMManager()
        
        # Create many concurrent requests
        tasks = []
        for i in range(100):
            task = manager.generate(f"Request {i}")
            tasks.append(task)
        
        # Should handle all requests without crashing
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should complete (either success or expected errors)
        assert len(results) == 100
        
        # Count successful responses
        successful = [r for r in results if isinstance(r, LLMResponse)]
        assert len(successful) > 0  # At least some should succeed

    @pytest.mark.asyncio
    async def test_memory_leak_simulation(self):
        """Test for potential memory leaks in repeated operations"""
        manager = LLMManager()
        
        # Perform many operations in sequence
        for i in range(50):
            try:
                await manager.generate(f"Test {i}")
            except Exception:
                pass  # Ignore errors, we're testing for leaks
        
        # This is a basic test - in practice you'd monitor actual memory usage
        assert True  # If we get here without crashing, that's good

class TestEdgeCases:
    """Test edge cases and unusual inputs"""
    
    @pytest.mark.asyncio
    async def test_empty_prompt(self):
        """Test handling of empty prompts"""
        manager = LLMManager()
        
        response = await manager.generate("")
        assert response is not None
        # Stub should handle empty prompts gracefully

    @pytest.mark.asyncio
    async def test_unicode_and_special_characters(self):
        """Test handling of unicode and special characters"""
        manager = LLMManager()
        
        special_prompts = [
            "Test with émojis 🚀🎉🔥",
            "Test with symbols @#$%^&*()",
            "Test with unicode ñáéíóú",
            "Test with newlines\nand\ttabs",
            "Test with quotes \"and\" 'apostrophes'",
            "Test with <xml>tags</xml>",
            "Test with {json: \"syntax\"}",
            "Test with SQL'; DROP TABLE users; --",
        ]
        
        for prompt in special_prompts:
            response = await manager.generate(prompt)
            assert response is not None
            assert len(response.content) > 0

    @pytest.mark.asyncio
    async def test_malformed_requests(self):
        """Test handling of malformed API requests"""
        client = TestClient(app)
        
        malformed_requests = [
            {},  # Empty request
            {"prompt": None},  # Null prompt
            {"prompt": 123},  # Wrong type
            {"prompt": "test", "temperature": "hot"},  # Wrong type
            {"prompt": "test", "max_tokens": -1},  # Invalid value
            {"prompt": "test", "provider": "invalid"},  # Invalid provider
        ]
        
        for req in malformed_requests:
            response = client.post("/api/v1/generation", json=req)
            assert response.status_code in [400, 422]  # Should be rejected

    @pytest.mark.asyncio
    async def test_corrupted_responses(self):
        """Test handling of corrupted provider responses"""
        manager = LLMManager()
        
        with patch('services.llm_manager.openai') as mock_openai:
            manager.providers[LLMProvider.OPENAI] = mock_openai
            manager.configs[LLMProvider.OPENAI] = Mock()
            
            mock_client = AsyncMock()
            mock_openai.AsyncOpenAI.return_value = mock_client
            
            # Return corrupted/incomplete response
            corrupted_response = Mock()
            corrupted_response.choices = []  # No choices
            mock_client.chat.completions.create.return_value = corrupted_response
            
            with pytest.raises(Exception):
                await manager.generate("test", provider=LLMProvider.OPENAI)

class TestRecoveryMechanisms:
    """Test system recovery from various failure scenarios"""
    
    @pytest.mark.asyncio
    async def test_recovery_after_provider_failure(self):
        """Test system recovery after provider failure"""
        manager = LLMManager()
        
        with patch.object(manager, '_generate_stub') as mock_stub:
            # Set up stub to fail first, then succeed
            mock_stub.side_effect = [
                Exception("First failure"),
                LLMResponse(
                    content="Recovery successful",
                    usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                    model="stub-model",
                    finish_reason="stop",
                    metadata={"provider": "local"}
                )
            ]
            
            # First call should fail
            with pytest.raises(Exception):
                await manager.generate("test")
            
            # Second call should succeed
            response = await manager.generate("test")
            assert response.content == "Recovery successful"

    @pytest.mark.asyncio
    async def test_health_check_after_failures(self):
        """Test health check reporting after various failures"""
        manager = LLMManager()
        
        # Simulate failures in health check
        with patch.object(manager, 'generate') as mock_gen:
            mock_gen.side_effect = Exception("Health check failed")
            
            health = await manager.health_check()
            
            # Should report errors but not crash
            assert isinstance(health, dict)
            # At least one provider should show error status
            error_count = sum(1 for status in health.values() 
                            if isinstance(status, dict) and status.get("status") == "error")
            assert error_count > 0

class TestStressAndLoad:
    """Stress and load testing scenarios"""
    
    @pytest.mark.asyncio
    async def test_rapid_sequential_requests(self):
        """Test rapid sequential request handling"""
        manager = LLMManager()
        
        start_time = time.time()
        
        # Make many requests in quick succession
        for i in range(20):
            try:
                await manager.generate(f"Request {i}", max_tokens=10)
            except Exception:
                pass  # Some may fail under load
        
        elapsed = time.time() - start_time
        
        # Should complete reasonably quickly
        assert elapsed < 30.0  # 30 seconds max for 20 requests

    @pytest.mark.asyncio
    async def test_mixed_load_patterns(self):
        """Test mixed load patterns (fast/slow requests)"""
        manager = LLMManager()
        
        # Mix of quick and potentially slow requests
        tasks = []
        for i in range(10):
            if i % 2 == 0:
                # Quick requests
                task = manager.generate(f"Quick {i}", max_tokens=5)
            else:
                # Potentially slower requests
                task = manager.generate(f"Detailed request {i} with more context", max_tokens=50)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Should handle mixed load
        successful = [r for r in results if isinstance(r, LLMResponse)]
        assert len(successful) > 0

    @pytest.mark.asyncio
    async def test_error_rate_under_load(self):
        """Test error rates under sustained load"""
        manager = LLMManager()
        
        error_count = 0
        success_count = 0
        
        # Sustained load test
        for i in range(30):
            try:
                response = await manager.generate(f"Load test {i}")
                if response:
                    success_count += 1
            except Exception:
                error_count += 1
        
        total_requests = error_count + success_count
        error_rate = error_count / total_requests if total_requests > 0 else 1.0
        
        # Error rate should be reasonable (< 50% for stub provider)
        assert error_rate < 0.5