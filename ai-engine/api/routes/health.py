"""
Health check routes for the AI Engine
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import time
import asyncio

from ...services.llm_manager import llm_manager
from ...services.agent_manager import agent_manager
from ...services.vector_store import vector_store_manager
from ...services.cache_manager import cache_manager
from ...core.config import settings

router = APIRouter()

@router.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {
        "message": "pong", 
        "timestamp": time.time(),
        "service": "ai-engine"
    }

@router.get("/health")
async def health_check():
    """Comprehensive health check"""
    
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "ai-engine",
        "version": "1.0.0",
        "components": {}
    }
    
    # Check LLM Manager
    try:
        llm_health = await llm_manager.health_check()
        health_status["components"]["llm_manager"] = {
            "status": "healthy",
            "providers": llm_health
        }
    except Exception as e:
        health_status["components"]["llm_manager"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "unhealthy"
    
    # Check Agent Manager
    try:
        agent_health = await agent_manager.health_check()
        health_status["components"]["agent_manager"] = {
            "status": "healthy",
            "agents": agent_health
        }
    except Exception as e:
        health_status["components"]["agent_manager"] = {
            "status": "unhealthy", 
            "error": str(e)
        }
        health_status["status"] = "unhealthy"
    
    # Check Vector Store
    try:
        vector_health = await vector_store_manager.health_check()
        health_status["components"]["vector_store"] = {
            "status": "healthy",
            "details": vector_health
        }
    except Exception as e:
        health_status["components"]["vector_store"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "unhealthy"
    
    # Check Cache Manager
    try:
        cache_health = await cache_manager.health_check()
        health_status["components"]["cache_manager"] = {
            "status": "healthy",
            "details": cache_health
        }
    except Exception as e:
        health_status["components"]["cache_manager"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "unhealthy"
    
    return health_status

@router.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes"""
    
    # Check if all critical components are ready
    try:
        # Quick LLM test
        await asyncio.wait_for(
            llm_manager.generate("test", max_tokens=1),
            timeout=10.0
        )
        
        return {
            "status": "ready",
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service not ready: {str(e)}"
        )

@router.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    
    return {
        "timestamp": time.time(),
        "uptime": time.time() - getattr(get_metrics, '_start_time', time.time()),
        "requests_total": getattr(get_metrics, '_requests', 0),
        "errors_total": getattr(get_metrics, '_errors', 0),
        "llm_providers": len(llm_manager.get_available_providers()),
        "active_agents": len(await agent_manager.get_active_sessions()),
    }

# Initialize metrics tracking
get_metrics._start_time = time.time()
get_metrics._requests = 0
get_metrics._errors = 0