"""
Model management and information routes
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

from ...services.llm_manager import llm_manager, LLMProvider
from ...middleware.auth import get_current_user
from ...core.config import settings, LLM_MODELS

router = APIRouter()

class ModelInfo(BaseModel):
    provider: str
    model: str
    max_tokens: int
    supports_streaming: bool
    cost_per_1k_tokens: float
    description: Optional[str] = None

class ProviderInfo(BaseModel):
    provider: str
    available: bool
    models: List[ModelInfo]
    status: str
    error: Optional[str] = None

@router.get("/available", response_model=List[ProviderInfo])
async def get_available_providers(
    current_user: dict = Depends(get_current_user)
) -> List[ProviderInfo]:
    """Get list of available LLM providers and their models"""
    
    available_providers = llm_manager.get_available_providers()
    providers_info = []
    
    for provider_name in LLM_MODELS.keys():
        provider_available = provider_name in available_providers
        models = []
        
        if provider_available:
            try:
                provider_enum = LLMProvider(provider_name)
                available_models = llm_manager.get_provider_models(provider_enum)
                
                for model_name in available_models:
                    model_config = LLM_MODELS[provider_name].get(model_name, {})
                    models.append(ModelInfo(
                        provider=provider_name,
                        model=model_name,
                        max_tokens=model_config.get("max_tokens", 4096),
                        supports_streaming=model_config.get("supports_streaming", False),
                        cost_per_1k_tokens=model_config.get("cost_per_1k_tokens", 0.0),
                        description=f"{provider_name.title()} {model_name}"
                    ))
                
                providers_info.append(ProviderInfo(
                    provider=provider_name,
                    available=True,
                    models=models,
                    status="healthy"
                ))
            except Exception as e:
                providers_info.append(ProviderInfo(
                    provider=provider_name,
                    available=False,
                    models=[],
                    status="error",
                    error=str(e)
                ))
        else:
            providers_info.append(ProviderInfo(
                provider=provider_name,
                available=False,
                models=[],
                status="unavailable",
                error="Provider not initialized or API key missing"
            ))
    
    return providers_info

@router.get("/models/{provider}", response_model=List[ModelInfo])
async def get_provider_models(
    provider: str,
    current_user: dict = Depends(get_current_user)
) -> List[ModelInfo]:
    """Get models for a specific provider"""
    
    try:
        provider_enum = LLMProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    if provider not in llm_manager.get_available_providers():
        raise HTTPException(status_code=404, detail=f"Provider {provider} not available")
    
    models = []
    available_models = llm_manager.get_provider_models(provider_enum)
    
    for model_name in available_models:
        model_config = LLM_MODELS[provider].get(model_name, {})
        models.append(ModelInfo(
            provider=provider,
            model=model_name,
            max_tokens=model_config.get("max_tokens", 4096),
            supports_streaming=model_config.get("supports_streaming", False),
            cost_per_1k_tokens=model_config.get("cost_per_1k_tokens", 0.0),
            description=f"{provider.title()} {model_name}"
        ))
    
    return models

@router.get("/models/{provider}/{model}")
async def get_model_info(
    provider: str,
    model: str,
    current_user: dict = Depends(get_current_user)
) -> ModelInfo:
    """Get detailed information about a specific model"""
    
    try:
        provider_enum = LLMProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    if provider not in llm_manager.get_available_providers():
        raise HTTPException(status_code=404, detail=f"Provider {provider} not available")
    
    if provider not in LLM_MODELS or model not in LLM_MODELS[provider]:
        raise HTTPException(status_code=404, detail=f"Model {model} not found for provider {provider}")
    
    model_config = LLM_MODELS[provider][model]
    
    return ModelInfo(
        provider=provider,
        model=model,
        max_tokens=model_config.get("max_tokens", 4096),
        supports_streaming=model_config.get("supports_streaming", False),
        cost_per_1k_tokens=model_config.get("cost_per_1k_tokens", 0.0),
        description=f"{provider.title()} {model} - Advanced language model"
    )

@router.post("/models/{provider}/{model}/test")
async def test_model(
    provider: str,
    model: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Test a specific model with a simple generation"""
    
    try:
        provider_enum = LLMProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    if provider not in llm_manager.get_available_providers():
        raise HTTPException(status_code=404, detail=f"Provider {provider} not available")
    
    try:
        # Simple test generation
        response = await llm_manager.generate(
            prompt="Say 'Hello, this is a test response.' and nothing else.",
            provider=provider_enum,
            model=model,
            max_tokens=50,
            temperature=0.1
        )
        
        return {
            "status": "success",
            "provider": provider,
            "model": model,
            "response": response.content,
            "usage": response.usage,
            "response_time": "< 1s"  # Simplified
        }
    except Exception as e:
        return {
            "status": "error",
            "provider": provider,
            "model": model,
            "error": str(e)
        }

@router.get("/health")
async def models_health_check(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check health of all model providers"""
    
    health_results = await llm_manager.health_check()
    
    return {
        "status": "healthy" if all(
            result.get("status") == "healthy" 
            for result in health_results.values()
        ) else "degraded",
        "providers": health_results,
        "total_providers": len(health_results),
        "healthy_providers": len([
            r for r in health_results.values() 
            if r.get("status") == "healthy"
        ])
    }

@router.get("/usage")
async def get_usage_stats(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get usage statistics for models"""
    
    # This would typically come from a database or metrics system
    # For now, return mock data
    return {
        "total_requests": 1500,
        "successful_requests": 1485,
        "failed_requests": 15,
        "average_response_time": "2.3s",
        "popular_models": [
            {"model": "gpt-4", "provider": "openai", "requests": 800},
            {"model": "claude-3-sonnet", "provider": "anthropic", "requests": 500},
            {"model": "gpt-3.5-turbo", "provider": "openai", "requests": 200}
        ],
        "cost_estimate": {
            "total_tokens": 2500000,
            "estimated_cost": "$45.50"
        }
    }