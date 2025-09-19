"""
AI Engine - FastAPI-based service for LLM orchestration and AI capabilities
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, Response
from contextlib import asynccontextmanager
import uvicorn
import logging
import asyncio
from typing import Dict, List, Any, Optional
import json
import time

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
except ImportError:
    # Create basic llm_manager if module doesn't exist
    from services.llm_manager import llm_manager

# Setup logging
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

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-engine",
        "version": "1.0.0",
        "uptime": time.time(),
        "timestamp": time.time()
    }

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
        return {
            "status": "degraded",
            "error": str(e)
        }

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

@app.post("/generation")
async def generate_text(request: dict):
    """Generate text using LLM"""
    try:
        prompt = request.get("messages", [{}])[-1].get("content", "") or request.get("prompt", "")
        model = request.get("model", "gpt-3.5-turbo")
        
        if not prompt:
            return {"error": "No prompt provided"}
        
        # Use the appropriate provider based on model
        provider = None
        if "gpt" in model:
            from services.llm_manager import LLMProvider
            provider = LLMProvider.OPENAI
        elif "claude" in model:
            from services.llm_manager import LLMProvider
            provider = LLMProvider.ANTHROPIC
        elif "gemini" in model:
            from services.llm_manager import LLMProvider
            provider = LLMProvider.GOOGLE
        
        response = await llm_manager.generate(
            prompt=prompt,
            provider=provider,
            model=model
        )
        
        return {
            "choices": [{
                "message": {
                    "content": response.content,
                    "role": "assistant"
                },
                "finish_reason": response.finish_reason
            }],
            "usage": response.usage,
            "model": response.model,
            "object": "chat.completion"
        }
    except Exception as e:
        logger.error(f"Generation error: {e}")
        return {"error": str(e)}

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
                # Handle agent status request
                status = await agent_manager.get_status()
                await websocket.send_json({
                    "type": "agent_status",
                    "data": status
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
        
        if stream:
            async for chunk in llm_manager.stream_completion(model_name, messages):
                yield {"content": chunk, "timestamp": time.time()}
        else:
            response = await llm_manager.complete(model_name, messages)
            yield {"content": response.content, "timestamp": time.time(), "complete": True}
            
    except Exception as e:
        yield {"error": str(e), "timestamp": time.time()}

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "error": exc.detail,
        "status_code": exc.status_code,
        "timestamp": time.time()
    }

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return {
        "error": "Internal server error",
        "status_code": 500,
        "timestamp": time.time()
    }

# Health check endpoints
@app.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {"message": "pong", "timestamp": time.time()}

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

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