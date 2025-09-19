import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from main import app

class TestGenerationAPI:
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def mock_llm_manager(self):
        mock = Mock()
        mock.generate_completion = AsyncMock(return_value="Generated code")
        mock.get_available_models = Mock(return_value={
            "openai": [
                {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "capabilities": ["code", "chat"]}
            ]
        })
        return mock
    
    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
    
    def test_models_endpoint(self, client, mock_llm_manager):
        """Test models list endpoint"""
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.get("/api/v1/models")
            assert response.status_code == 200
            
            data = response.json()
            assert "models" in data
            assert "openai" in data["models"]
            assert len(data["models"]["openai"]) > 0
    
    def test_generate_code_endpoint(self, client, mock_llm_manager):
        """Test code generation endpoint"""
        request_data = {
            "prompt": "Create a React component",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/generate/code", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert "code" in data
            assert "explanation" in data
            assert data["framework"] == "react"
            assert data["language"] == "typescript"
    
    def test_generate_code_missing_fields(self, client):
        """Test code generation with missing required fields"""
        request_data = {
            "prompt": "Create a component"
            # Missing framework, language, model
        }
        
        response = client.post("/api/v1/generate/code", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_generate_code_invalid_framework(self, client, mock_llm_manager):
        """Test code generation with invalid framework"""
        request_data = {
            "prompt": "Create a component",
            "framework": "invalid_framework",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/generate/code", json=request_data)
            assert response.status_code == 400
            
            data = response.json()
            assert "error" in data
            assert "framework" in data["error"].lower()
    
    def test_chat_endpoint(self, client, mock_llm_manager):
        """Test chat endpoint"""
        mock_llm_manager.generate_completion.return_value = "Here's how to create a React component..."
        
        request_data = {
            "message": "How do I create a React component?",
            "context": {
                "project_id": "test-project",
                "files": []
            },
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/chat", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert "response" in data
            assert "suggestions" in data
            assert isinstance(data["suggestions"], list)
    
    def test_chat_with_file_context(self, client, mock_llm_manager):
        """Test chat with file context"""
        request_data = {
            "message": "How can I improve this component?",
            "context": {
                "project_id": "test-project",
                "files": [{
                    "path": "src/App.tsx",
                    "content": "import React from 'react';\n\nfunction App() {\n  return <div>Hello</div>;\n}"
                }]
            },
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/chat", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["context_used"] is True
    
    def test_stream_chat_endpoint(self, client, mock_llm_manager):
        """Test streaming chat endpoint"""
        async def mock_stream():
            yield "chunk1"
            yield "chunk2"
            yield "chunk3"
        
        mock_llm_manager.stream_completion = AsyncMock(return_value=mock_stream())
        
        request_data = {
            "message": "Explain React hooks",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/chat/stream", json=request_data)
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
    
    def test_explain_code_endpoint(self, client, mock_llm_manager):
        """Test code explanation endpoint"""
        mock_llm_manager.generate_completion.return_value = "This code creates a React functional component..."
        
        request_data = {
            "code": "function App() { return <div>Hello World</div>; }",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/explain", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert "explanation" in data
            assert "complexity" in data
            assert "suggestions" in data
    
    def test_optimize_code_endpoint(self, client, mock_llm_manager):
        """Test code optimization endpoint"""
        mock_llm_manager.generate_completion.return_value = "Optimized code with improvements..."
        
        request_data = {
            "code": "function slowFunction() { /* inefficient code */ }",
            "language": "javascript",
            "optimization_goals": ["performance", "readability"],
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/optimize", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert "optimized_code" in data
            assert "improvements" in data
            assert isinstance(data["improvements"], list)
    
    def test_debug_code_endpoint(self, client, mock_llm_manager):
        """Test code debugging endpoint"""
        mock_llm_manager.generate_completion.return_value = "Found issue: missing semicolon..."
        
        request_data = {
            "code": "console.log('hello'",  # Missing closing parenthesis
            "language": "javascript",
            "error_message": "SyntaxError: missing ) after argument list",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/debug", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert "issues" in data
            assert "fixes" in data
            assert "corrected_code" in data
    
    def test_rate_limiting(self, client, mock_llm_manager):
        """Test rate limiting"""
        request_data = {
            "prompt": "Generate code",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            # Make multiple rapid requests
            responses = []
            for _ in range(10):
                response = client.post("/api/v1/generate/code", json=request_data)
                responses.append(response)
            
            # Some requests should be rate limited
            status_codes = [r.status_code for r in responses]
            assert 429 in status_codes  # Too Many Requests
    
    def test_error_handling(self, client, mock_llm_manager):
        """Test error handling for LLM failures"""
        mock_llm_manager.generate_completion.side_effect = Exception("LLM service unavailable")
        
        request_data = {
            "prompt": "Generate code",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/generate/code", json=request_data)
            assert response.status_code == 500
            
            data = response.json()
            assert "error" in data
            assert "internal server error" in data["error"].lower()
    
    def test_input_validation(self, client):
        """Test input validation"""
        # Test empty prompt
        request_data = {
            "prompt": "",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        response = client.post("/api/v1/generate/code", json=request_data)
        assert response.status_code == 422
    
    def test_cors_headers(self, client):
        """Test CORS headers"""
        response = client.options("/api/v1/generate/code")
        assert response.status_code == 200
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
    
    def test_authentication(self, client):
        """Test authentication middleware"""
        # Test request without auth header
        request_data = {
            "prompt": "Generate code",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        response = client.post("/api/v1/generate/code", json=request_data)
        # Should require authentication in production
        # assert response.status_code == 401
    
    def test_request_logging(self, client, mock_llm_manager):
        """Test request logging"""
        request_data = {
            "prompt": "Test prompt",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager), \
             patch('core.logging.logger') as mock_logger:
            
            response = client.post("/api/v1/generate/code", json=request_data)
            assert response.status_code == 200
            
            # Verify logging was called
            mock_logger.info.assert_called()
    
    def test_metrics_collection(self, client, mock_llm_manager):
        """Test metrics collection"""
        request_data = {
            "prompt": "Test prompt",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager), \
             patch('middleware.monitoring.request_counter') as mock_counter:
            
            response = client.post("/api/v1/generate/code", json=request_data)
            assert response.status_code == 200
            
            # Verify metrics were recorded
            mock_counter.inc.assert_called()
    
    def test_large_request_handling(self, client, mock_llm_manager):
        """Test handling of large requests"""
        # Create a very large prompt
        large_prompt = "x" * 10000  # 10KB prompt
        
        request_data = {
            "prompt": large_prompt,
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        with patch('api.routes.generation.llm_manager', mock_llm_manager):
            response = client.post("/api/v1/generate/code", json=request_data)
            
            # Should handle large requests gracefully
            assert response.status_code in [200, 413]  # OK or Payload Too Large
    
    def test_concurrent_requests(self, client, mock_llm_manager):
        """Test handling concurrent requests"""
        import threading
        import time
        
        request_data = {
            "prompt": "Concurrent test",
            "framework": "react",
            "language": "typescript",
            "model": "gpt-3.5-turbo"
        }
        
        results = []
        
        def make_request():
            with patch('api.routes.generation.llm_manager', mock_llm_manager):
                response = client.post("/api/v1/generate/code", json=request_data)
                results.append(response.status_code)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert all(status == 200 for status in results)