"""
AI Engine - FastAPI-based service for LLM orchestration and AI capabilities
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
import asyncio
from typing import Dict, List, Any, Optional
import json
import time

from .core.config import settings
from .core.logging import setup_logging
from .api.routes import generation, models, agents, health
from .services.llm_manager import LLMManager
from .services.agent_manager import AgentManager
from .services.vector_store import VectorStoreManager
from .services.cache_manager import CacheManager
from .middleware.auth import AuthMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.monitoring import MonitoringMiddleware

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global managers
llm_manager = LLMManager()
agent_manager = AgentManager()
vector_store_manager = VectorStoreManager()
cache_manager = CacheManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("Starting AI Engine...")
    
    # Initialize services
    await llm_manager.initialize()
    await agent_manager.initialize()
    await vector_store_manager.initialize()
    await cache_manager.initialize()
    
    logger.info("AI Engine started successfully")
    yield
    
    # Cleanup
    logger.info("Shutting down AI Engine...")
    await llm_manager.cleanup()
    await agent_manager.cleanup()
    await vector_store_manager.cleanup()
    await cache_manager.cleanup()
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
app.add_middleware(MonitoringMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)

# Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(models.router, prefix="/models", tags=["models"])
app.include_router(generation.router, prefix="/generation", tags=["generation"])
app.include_router(agents.router, prefix="/agents", tags=["agents"])

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
            "agent orchestration",
            "vector embeddings",
            "code generation",
            "project scaffolding",
            "quality verification"
        ]
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