"""
Health and monitoring routes for AI engine
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import time
import os
import logging
import asyncio

from ...services.provider_selector import provider_selector
from ...services.llm_manager import llm_manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/healthz")
async def kubernetes_health():
    """Kubernetes health check endpoint"""
    try:
        # Basic service checks
        health_data = {
            "status": "healthy",
            "service": "ai-engine",
            "version": "1.0.0",
            "timestamp": time.time(),
            "checks": {}
        }
        
        # Check LLM manager
        try:
            if hasattr(llm_manager, 'health_check'):
                health_data["checks"]["llm_manager"] = await llm_manager.health_check()
            else:
                health_data["checks"]["llm_manager"] = "available"
        except Exception as e:
            health_data["checks"]["llm_manager"] = f"error: {str(e)}"
            health_data["status"] = "degraded"
        
        # Check provider selector
        try:
            await provider_selector._update_health_status()
            provider_status = provider_selector.get_provider_status()
            health_data["checks"]["providers"] = {
                name: status.health.value 
                for name, status in provider_status.items()
            }
        except Exception as e:
            health_data["checks"]["providers"] = f"error: {str(e)}"
            health_data["status"] = "degraded"
            
        return health_data
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@router.get("/ready")
async def readiness_check():
    """Readiness check - can the service handle requests?"""
    try:
        readiness_data = {
            "status": "ready",
            "timestamp": time.time(),
            "providers": {},
            "environment": {}
        }
        
        # Check environment configuration
        readiness_data["environment"] = {
            "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
            "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
            "google_configured": bool(os.getenv("GOOGLE_API_KEY")),
        }
        
        # Test provider availability
        try:
            best_provider = await provider_selector.get_best_provider()
            if not best_provider:
                readiness_data["status"] = "degraded"
                readiness_data["reason"] = "No available providers"
            else:
                readiness_data["best_provider"] = best_provider
                
        except Exception as e:
            readiness_data["status"] = "degraded"
            readiness_data["reason"] = f"Provider selection failed: {str(e)}"
        
        # Get detailed provider status
        provider_status = provider_selector.get_provider_status()
        readiness_data["providers"] = {
            name: {
                "health": status.health.value,
                "response_time": status.response_time,
                "error_rate": status.error_rate,
                "models": status.available_models
            }
            for name, status in provider_status.items()
        }
        
        return readiness_data
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")

@router.get("/metrics")
async def metrics_endpoint():
    """Basic metrics endpoint"""
    try:
        metrics_data = {
            "timestamp": time.time(),
            "providers": {},
            "system": {
                "uptime": time.time(),  # Simplified uptime
                "memory_usage": "unknown",  # Would need psutil
                "cpu_usage": "unknown"
            }
        }
        
        # Provider metrics
        provider_status = provider_selector.get_provider_status()
        for name, status in provider_status.items():
            metrics_data["providers"][name] = {
                "health": status.health.value,
                "response_time_ms": status.response_time * 1000,
                "error_rate": status.error_rate,
                "last_check": status.last_check,
                "available_models_count": len(status.available_models)
            }
            
        return metrics_data
        
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        return {"error": "Metrics unavailable", "timestamp": time.time()}

@router.get("/status")
async def detailed_status():
    """Detailed status information for debugging"""
    try:
        status_data = {
            "timestamp": time.time(),
            "service": "ai-engine",
            "version": "1.0.0",
            "environment": {
                "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
                "environment_variables": {
                    "OPENAI_API_KEY": "configured" if os.getenv("OPENAI_API_KEY") else "missing",
                    "ANTHROPIC_API_KEY": "configured" if os.getenv("ANTHROPIC_API_KEY") else "missing",
                    "GOOGLE_API_KEY": "configured" if os.getenv("GOOGLE_API_KEY") else "missing",
                    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
                    "AI_PROVIDER": os.getenv("AI_PROVIDER", "auto")
                }
            },
            "providers": {},
            "capabilities": [
                "text generation",
                "chat completion", 
                "code generation",
                "provider selection",
                "health monitoring"
            ]
        }
        
        # Detailed provider information
        await provider_selector._update_health_status()
        provider_status = provider_selector.get_provider_status()
        
        for name, status in provider_status.items():
            status_data["providers"][name] = {
                "health": status.health.value,
                "response_time": status.response_time,
                "error_rate": status.error_rate,
                "last_check": status.last_check,
                "available_models": status.available_models,
                "api_key_configured": provider_selector._has_api_key(name)
            }
            
        return status_data
        
    except Exception as e:
        logger.error(f"Status collection failed: {e}")
        return {
            "error": "Status collection failed",
            "detail": str(e),
            "timestamp": time.time()
        }