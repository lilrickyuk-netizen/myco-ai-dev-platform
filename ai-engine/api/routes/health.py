"""
Health check routes for the AI Engine
"""

from fastapi import APIRouter
from typing import Dict, Any
import time
import os

from ...services.llm_manager import llm_manager
from ...services.agent_manager import agent_manager
from ...services.cache_manager import cache_manager
from ...services.vector_store import vector_store_manager
from ...core.config import settings

router = APIRouter()

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Main health check endpoint"""
    
    # Check all services
    llm_health = await llm_manager.health_check()
    agent_health = await agent_manager.health_check()
    cache_health = await cache_manager.health_check()
    vector_health = await vector_store_manager.health_check()
    
    # Determine overall health
    all_healthy = all([
        all(service.get("status") == "healthy" for service in llm_health.values()),
        agent_health.get("status") == "healthy",
        cache_health.get("status") == "healthy",
        vector_health.get("embedding_provider") == "healthy"
    ])
    
    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "services": {
            "llm_providers": llm_health,
            "agent_manager": agent_health,
            "cache": cache_health,
            "vector_store": vector_health
        },
        "environment": {
            "debug": settings.DEBUG,
            "workers": settings.WORKERS,
            "max_concurrent": settings.MAX_CONCURRENT_REQUESTS
        }
    }

@router.get("/ping")
async def ping() -> Dict[str, str]:
    """Simple ping endpoint"""
    return {"message": "pong", "timestamp": str(time.time())}

@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """Kubernetes readiness probe"""
    try:
        # Check if essential services are ready
        cache_ready = await cache_manager.health_check()
        
        return {
            "ready": cache_ready.get("status") == "healthy",
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "ready": False,
            "error": str(e),
            "timestamp": time.time()
        }

@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """Kubernetes liveness probe"""
    return {
        "alive": True,
        "uptime": time.time(),
        "process_id": os.getpid()
    }