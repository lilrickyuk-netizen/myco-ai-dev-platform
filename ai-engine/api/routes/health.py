"""
Health check routes
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
import time
import psutil
import asyncio

from ...core.config import settings
from ...services.llm_manager import llm_manager

router = APIRouter()

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "AI Engine",
        "version": "1.0.0"
    }

@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check with system metrics"""
    
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # LLM provider health
    llm_health = await llm_manager.health_check()
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "AI Engine",
        "version": "1.0.0",
        "system": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "free": disk.free,
                "percent": (disk.used / disk.total) * 100
            }
        },
        "llm_providers": llm_health,
        "configuration": {
            "debug": settings.DEBUG,
            "max_tokens": settings.MAX_TOKENS,
            "default_model": settings.DEFAULT_MODEL
        }
    }

@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """Kubernetes readiness probe"""
    try:
        # Check if LLM manager is working
        providers = llm_manager.get_available_providers()
        
        if not providers:
            return {"status": "not_ready", "reason": "No LLM providers available"}
        
        return {
            "status": "ready",
            "providers": providers
        }
    except Exception as e:
        return {
            "status": "not_ready",
            "reason": str(e)
        }

@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """Kubernetes liveness probe"""
    return {
        "status": "alive",
        "timestamp": time.time()
    }