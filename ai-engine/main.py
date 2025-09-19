"""
AI Engine - FastAPI-based service for LLM orchestration and AI capabilities
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
import uvicorn
import logging
import asyncio
from typing import Dict, List, Any, Optional
import json
import time
from pydantic import BaseModel, Field, validator
import re
import sys

import os
from dotenv import load_dotenv

load_dotenv()

# Simplified imports for standalone mode
try:
    from .core.config import settings
except ImportError:
    # Create basic settings if config module doesn't exist
    class Settings:
        HOST = "0.0.0.0"
        PORT = 8001
        DEBUG = True
        WORKERS = 1
        LOG_LEVEL = "INFO"
        ALLOWED_ORIGINS = ["*"]
    settings = Settings()

try:
    from .services.llm_manager import llm_manager
    from .services.provider_selector import provider_selector
except ImportError:
    # Create basic llm_manager if module doesn't exist
    from services.llm_manager import llm_manager
    from services.provider_selector import provider_selector

# Setup logging
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

setup_logging()
logger = logging.getLogger(__name__)

# Managers are imported from their modules

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("Starting AI Engine...")
    
    # Initialize services - only llm_manager for now
    if hasattr(llm_manager, 'initialize'):
        await llm_manager.initialize()
    
    logger.info("AI Engine started successfully")
    yield
    
    # Cleanup
    logger.info("Shutting down AI Engine...")
    if hasattr(llm_manager, 'cleanup'):
        await llm_manager.cleanup()
    logger.info("AI Engine shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Myco AI Engine",
    description="AI-powered development platform engine with multi-model LLM support",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include API routes
try:
    from .api.routes.health import router as health_router
    from .api.routes.generation import router as generation_router
    app.include_router(health_router, tags=["health"])
    app.include_router(generation_router, prefix="/api/v1", tags=["generation"])
    logger.info("Loaded hardened API routes")
except ImportError:
    try:
        from api.routes.health import router as health_router
        from api.routes.generation import router as generation_router
        app.include_router(health_router, tags=["health"])
        app.include_router(generation_router, prefix="/api/v1", tags=["generation"])
        logger.info("Loaded hardened API routes")
    except ImportError:
        logger.warning("API routes not available - using built-in endpoints")

# Add request ID middleware for tracking
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    import uuid
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Myco AI Engine",
        "version": "1.0.0",
        "status": "running",
        "timestamp": time.time(),
        "capabilities": [
            "multi-model LLM support",
            "code generation",
            "AI assistance"
        ]
    }

@app.get("/healthz")
async def healthz():
    """Kubernetes health check endpoint"""
    try:
        # Basic health checks
        health_status = {
            "status": "healthy",
            "service": "ai-engine",
            "version": "1.0.0",
            "timestamp": time.time()
        }
        
        # Check LLM manager
        if hasattr(llm_manager, 'health_check'):
            health_status["llm_manager"] = await llm_manager.health_check()
        else:
            health_status["llm_manager"] = "available"
        
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.get("/health")
async def health():
    """Legacy health check endpoint"""
    return await healthz()

@app.get("/ready")
async def ready():
    """Readiness check endpoint"""
    try:
        # Check if LLM manager is available
        providers = llm_manager.get_available_providers()
        
        # Check environment variables for any configured providers
        has_openai = bool(os.getenv("OPENAI_API_KEY"))
        has_anthropic = bool(os.getenv("ANTHROPIC_API_KEY"))
        has_google = bool(os.getenv("GOOGLE_API_KEY"))
        
        status = "ready"
        if not (has_openai or has_anthropic or has_google):
            status = "degraded"  # Running with stub provider only
        
        # Test a simple generation to ensure providers are working
        try:
            test_response = await llm_manager.generate("test", max_tokens=1)
            if not test_response or not test_response.content:
                status = "degraded"
        except Exception as test_error:
            logger.warning(f"Provider test failed: {test_error}")
            status = "degraded"
        
        return {
            "status": status,
            "providers_available": providers,
            "configured_providers": {
                "openai": has_openai,
                "anthropic": has_anthropic,
                "google": has_google
            }
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")

@app.get("/models")
async def get_models():
    """Get available models"""
    try:
        providers = llm_manager.get_available_providers()
        models = {}
        
        for provider_str in providers:
            # Convert string back to enum for method call
            from services.llm_manager import LLMProvider
            try:
                provider_enum = LLMProvider(provider_str)
                models[provider_str] = llm_manager.get_provider_models(provider_enum)
            except ValueError:
                models[provider_str] = ["stub-model"]
        
        return {"models": models}
    except Exception as e:
        return {"error": str(e), "models": {}}

# Pydantic models for request validation
class GenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=32000, description="The text prompt")
    model: Optional[str] = Field("gpt-3.5-turbo", description="Model to use")
    messages: Optional[List[Dict[str, str]]] = Field(None, description="Chat messages")
    max_tokens: Optional[int] = Field(1000, ge=1, le=4000, description="Maximum tokens")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    timeout: Optional[int] = Field(30, ge=1, le=120, description="Request timeout in seconds")
    
    @validator('prompt')
    def validate_prompt(cls, v):
        if not v or not v.strip():
            raise ValueError('Prompt cannot be empty')
        # Basic content filtering
        if len(v) > 32000:
            raise ValueError('Prompt too long')
        return v.strip()
    
    @validator('model')
    def validate_model(cls, v):
        allowed_models = [
            'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo',
            'claude-3-sonnet', 'claude-3-opus', 'claude-3-haiku',
            'gemini-pro', 'gemini-1.5-pro'
        ]
        if v and v not in allowed_models:
            logger.warning(f"Unknown model requested: {v}")
        return v

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., min_items=1, description="Chat messages")
    model: Optional[str] = Field("gpt-3.5-turbo", description="Model to use")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(1000, ge=1, le=4000, description="Maximum tokens")
    
    @validator('messages')
    def validate_messages(cls, v):
        if not v:
            raise ValueError('Messages cannot be empty')
        for msg in v:
            if 'role' not in msg or 'content' not in msg:
                raise ValueError('Each message must have role and content')
            if msg['role'] not in ['user', 'assistant', 'system']:
                raise ValueError('Invalid message role')
        return v

@app.post("/generation")
async def generate_text(request: GenerationRequest):
    """Generate text using LLM with full validation and error handling"""
    start_time = time.time()
    
    try:
        # Extract prompt from messages or direct prompt
        if request.messages:
            prompt = request.messages[-1].get("content", "")
            if not prompt:
                raise HTTPException(status_code=400, detail="Last message must have content")
        else:
            prompt = request.prompt
        
        # Use provider selector to choose best provider
        model = request.model or "gpt-3.5-turbo"
        
        # Get best provider for this model
        provider_name = await provider_selector.get_best_provider(model=model)
        if not provider_name:
            raise HTTPException(status_code=503, detail="No available AI providers")
        
        # Convert to enum
        provider = None
        if provider_name == "openai":
            from services.llm_manager import LLMProvider
            provider = LLMProvider.OPENAI
        elif provider_name == "anthropic":
            from services.llm_manager import LLMProvider
            provider = LLMProvider.ANTHROPIC
        elif provider_name == "google":
            from services.llm_manager import LLMProvider
            provider = LLMProvider.GOOGLE
        
        # Set timeout
        timeout = request.timeout or 30
        
        # Generate response with timeout
        response = await asyncio.wait_for(
            llm_manager.generate(
                prompt=prompt,
                provider=provider,
                model=model,
                max_tokens=request.max_tokens,
                temperature=request.temperature
            ),
            timeout=timeout
        )
        
        # Format OpenAI-compatible response
        formatted_response = llm_manager.format_openai_response(response)
        
        # Add timing information
        formatted_response["processing_time"] = time.time() - start_time
        
        return formatted_response
        
    except asyncio.TimeoutError:
        logger.error(f"Generation timeout after {request.timeout}s")
        raise HTTPException(status_code=408, detail="Request timeout")
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Generation error: {e}")
        # Record error for provider health tracking
        if 'provider_name' in locals():
            await provider_selector.record_provider_error(provider_name, e)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/chat")
async def chat_completion(request: ChatRequest):
    """Chat completion endpoint with validation"""
    start_time = time.time()
    
    try:
        # Get the last user message
        last_message = request.messages[-1]
        if last_message.get('role') != 'user':
            raise HTTPException(status_code=400, detail="Last message must be from user")
        
        prompt = last_message.get('content', '')
        if not prompt.strip():
            raise HTTPException(status_code=400, detail="Message content cannot be empty")
        
        # Use provider selector for chat as well
        model = request.model or "gpt-3.5-turbo"
        
        provider_name = await provider_selector.get_best_provider(model=model)
        if not provider_name:
            raise HTTPException(status_code=503, detail="No available AI providers")
        
        provider = None
        if provider_name == "openai":
            from services.llm_manager import LLMProvider
            provider = LLMProvider.OPENAI
        elif provider_name == "anthropic":
            from services.llm_manager import LLMProvider
            provider = LLMProvider.ANTHROPIC
        elif provider_name == "google":
            from services.llm_manager import LLMProvider
            provider = LLMProvider.GOOGLE
        
        # Generate response
        response = await asyncio.wait_for(
            llm_manager.generate(
                prompt=prompt,
                provider=provider,
                model=model,
                max_tokens=request.max_tokens,
                temperature=request.temperature
            ),
            timeout=30.0
        )
        
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response.content
                },
                "finish_reason": "stop"
            }],
            "usage": response.usage if hasattr(response, 'usage') else {},
            "model": model,
            "processing_time": time.time() - start_time
        }
        
    except asyncio.TimeoutError:
        logger.error("Chat completion timeout")
        raise HTTPException(status_code=408, detail="Request timeout")
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        # Record error for provider health tracking
        if 'provider_name' in locals():
            await provider_selector.record_provider_error(provider_name, e)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/agents/plan")
async def plan_agent_task(request: dict):
    """Basic agent planning endpoint"""
    return {
        "status": "ok",
        "plan": "Agent planning is under development",
        "tasks": []
    }

@app.websocket("/ws/generation")
async def websocket_generation(websocket: WebSocket):
    """WebSocket endpoint for real-time generation"""
    await websocket.accept()
    
    try:
        while True:
            # Receive generation request
            data = await websocket.receive_json()
            request_type = data.get("type")
            
            if request_type == "generate":
                # Handle generation request
                async for chunk in _handle_streaming_generation(data.get("payload", {})):
                    await websocket.send_json({
                        "type": "chunk",
                        "data": chunk
                    })
                
                await websocket.send_json({
                    "type": "complete",
                    "data": {"status": "generation_complete"}
                })
                
            elif request_type == "agent_status":
                # Handle agent status request - basic implementation
                await websocket.send_json({
                    "type": "agent_status",
                    "data": {"status": "ready", "agents": []}
                })
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.send_json({
            "type": "error",
            "data": {"error": str(e)}
        })
    finally:
        await websocket.close()

async def _handle_streaming_generation(payload: Dict[str, Any]):
    """Handle streaming generation requests"""
    try:
        model_name = payload.get("model", "gpt-4")
        messages = payload.get("messages", [])
        stream = payload.get("stream", True)
        
        prompt = messages[-1].get("content", "") if messages else ""
        
        if stream:
            async for chunk in llm_manager.generate_stream(prompt):
                yield {"content": chunk, "timestamp": time.time()}
        else:
            response = await llm_manager.generate(prompt, model=model_name)
            yield {"content": response.content, "timestamp": time.time(), "complete": True}
            
    except Exception as e:
        yield {"error": str(e), "timestamp": time.time()}

# Enhanced error handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.url}: {exc}")
    return {
        "error": "Validation failed",
        "details": exc.errors(),
        "status_code": 422,
        "timestamp": time.time()
    }

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(f"HTTP exception on {request.url}: {exc.detail}")
    return {
        "error": exc.detail,
        "status_code": exc.status_code,
        "timestamp": time.time()
    }

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    return {
        "error": "Internal server error",
        "status_code": 500,
        "timestamp": time.time(),
        "request_id": getattr(request.state, 'request_id', 'unknown')
    }

# Health check endpoints
@app.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {"message": "pong", "timestamp": time.time()}

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    try:
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        # Fallback if prometheus_client is not installed
        return {
            "error": "Metrics not available - prometheus_client not installed",
            "timestamp": time.time()
        }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS if not settings.DEBUG else 1,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True
    )