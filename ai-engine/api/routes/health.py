"""
Health check and readiness endpoints with comprehensive monitoring
"""

import time
import asyncio
import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from ...services.llm_manager import llm_manager
from ...services.vector_store import vector_store_manager
from ...core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/healthz")
async def health_check() -> Dict[str, Any]:
    """
    Kubernetes-style health check endpoint.
    Returns 200 if service is healthy, 503 if not.
    """
    try:
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "version": settings.VERSION if hasattr(settings, 'VERSION') else "1.0.0",
            "checks": {}
        }
        
        # Basic service health
        health_status["checks"]["service"] = {
            "status": "healthy",
            "message": "AI Engine service is running"
        }
        
        # Check LLM manager
        try:
            llm_health = await asyncio.wait_for(llm_manager.health_check(), timeout=5.0)
            health_status["checks"]["llm_manager"] = {
                "status": "healthy",
                "providers": llm_health,
                "default_provider": llm_manager.default_provider.value
            }
        except asyncio.TimeoutError:
            health_status["checks"]["llm_manager"] = {
                "status": "timeout",
                "message": "LLM health check timed out"
            }
            health_status["status"] = "degraded"
        except Exception as e:
            health_status["checks"]["llm_manager"] = {
                "status": "error",
                "message": str(e)
            }
            health_status["status"] = "degraded"
        
        # Check vector store manager
        try:
            vector_health = await asyncio.wait_for(vector_store_manager.health_check(), timeout=3.0)
            health_status["checks"]["vector_store"] = {
                "status": "healthy" if vector_health["initialized"] else "degraded",
                "details": vector_health
            }
        except asyncio.TimeoutError:
            health_status["checks"]["vector_store"] = {
                "status": "timeout",
                "message": "Vector store health check timed out"
            }
            health_status["status"] = "degraded"
        except Exception as e:
            health_status["checks"]["vector_store"] = {
                "status": "error",
                "message": str(e)
            }
        
        # Return appropriate status code
        if health_status["status"] == "healthy":
            return health_status
        else:
            raise HTTPException(status_code=503, detail=health_status)
            
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        error_response = {
            "status": "error",
            "timestamp": time.time(),
            "message": "Health check failed",
            "error": str(e)
        }
        raise HTTPException(status_code=503, detail=error_response)

@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """
    Kubernetes-style readiness check endpoint.
    Returns 200 if service is ready to accept traffic, 503 if not.
    """
    try:
        readiness_status = {
            "status": "ready",
            "timestamp": time.time(),
            "checks": {}
        }
        
        # Check if LLM manager is initialized and has working providers
        if not llm_manager.providers:
            readiness_status["status"] = "not_ready"
            readiness_status["checks"]["llm_providers"] = {
                "status": "missing",
                "message": "No LLM providers available"
            }
        else:
            # Test at least one provider
            working_providers = 0
            for provider in llm_manager.providers:
                try:
                    await asyncio.wait_for(
                        llm_manager.generate("test", provider=provider, max_tokens=5),
                        timeout=10.0
                    )
                    working_providers += 1
                    break  # At least one working provider is enough
                except:
                    continue
            
            if working_providers > 0:
                readiness_status["checks"]["llm_providers"] = {
                    "status": "ready",
                    "working_providers": working_providers,
                    "total_providers": len(llm_manager.providers)
                }
            else:
                readiness_status["status"] = "not_ready"
                readiness_status["checks"]["llm_providers"] = {
                    "status": "error",
                    "message": "No working LLM providers"
                }
        
        # Check vector store readiness
        if vector_store_manager.initialized:
            readiness_status["checks"]["vector_store"] = {
                "status": "ready",
                "message": "Vector store is initialized"
            }
        else:
            readiness_status["checks"]["vector_store"] = {
                "status": "not_ready",
                "message": "Vector store not initialized"
            }
        
        # Return appropriate status code
        if readiness_status["status"] == "ready":
            return readiness_status
        else:
            raise HTTPException(status_code=503, detail=readiness_status)
            
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}", exc_info=True)
        error_response = {
            "status": "error",
            "timestamp": time.time(),
            "message": "Readiness check failed",
            "error": str(e)
        }
        raise HTTPException(status_code=503, detail=error_response)

@router.get("/metrics")
async def metrics() -> Dict[str, Any]:
    """
    Basic metrics endpoint for monitoring
    """
    try:
        metrics_data = {
            "timestamp": time.time(),
            "llm_manager": {
                "available_providers": llm_manager.get_available_providers(),
                "default_provider": llm_manager.default_provider.value
            },
            "vector_store": {
                "initialized": vector_store_manager.initialized,
                "embedding_provider": type(vector_store_manager.embedding_provider).__name__ if vector_store_manager.embedding_provider else None,
                "store_type": type(vector_store_manager.vector_store).__name__ if vector_store_manager.vector_store else None
            }
        }
        
        # Add provider-specific metrics
        for provider in llm_manager.providers:
            try:
                models = llm_manager.get_provider_models(provider)
                metrics_data["llm_manager"][f"{provider.value}_models"] = models
            except:
                pass
        
        return metrics_data
        
    except Exception as e:
        logger.error(f"Metrics collection failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Metrics collection failed: {str(e)}")

@router.get("/status")
async def service_status() -> Dict[str, Any]:
    """
    Comprehensive service status endpoint
    """
    try:
        # Get health and readiness
        health = await health_check()
        readiness = await readiness_check()
        metrics = await metrics()
        
        return {
            "service": "AI Engine",
            "timestamp": time.time(),
            "health": health,
            "readiness": readiness,
            "metrics": metrics
        }
        
    except HTTPException as e:
        # Return partial status even if some checks fail
        return {
            "service": "AI Engine",
            "timestamp": time.time(),
            "status": "partial",
            "error": e.detail
        }
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")