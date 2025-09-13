"""
Model management routes
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

from ...services.llm_manager import llm_manager
from ...core.config import LLM_MODELS
from ...middleware.auth import get_current_user

router = APIRouter()

class ModelInfo(BaseModel):
    name: str
    provider: str
    max_tokens: int
    supports_streaming: bool
    cost_per_1k_tokens: float

class ModelListResponse(BaseModel):
    models: List[ModelInfo]
    total: int

@router.get("/", response_model=ModelListResponse)
async def list_models(
    provider: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> ModelListResponse:
    """List available LLM models"""
    
    available_providers = llm_manager.get_available_providers()
    models = []
    
    for provider_name in available_providers:
        if provider and provider != provider_name:
            continue
            
        provider_models = llm_manager.get_provider_models(provider_name)
        
        for model_name in provider_models:
            model_config = LLM_MODELS.get(provider_name, {}).get(model_name, {})
            
            models.append(ModelInfo(
                name=model_name,
                provider=provider_name,
                max_tokens=model_config.get("max_tokens", 4096),
                supports_streaming=model_config.get("supports_streaming", False),
                cost_per_1k_tokens=model_config.get("cost_per_1k_tokens", 0.0)
            ))
    
    return ModelListResponse(
        models=models,
        total=len(models)
    )

@router.get("/{provider}/{model_name}")
async def get_model_info(
    provider: str,
    model_name: str,
    current_user: dict = Depends(get_current_user)
) -> ModelInfo:
    """Get detailed information about a specific model"""
    
    available_providers = llm_manager.get_available_providers()
    if provider not in available_providers:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not available")
    
    provider_models = llm_manager.get_provider_models(provider)
    if model_name not in provider_models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found for provider {provider}")
    
    model_config = LLM_MODELS.get(provider, {}).get(model_name, {})
    
    return ModelInfo(
        name=model_name,
        provider=provider,
        max_tokens=model_config.get("max_tokens", 4096),
        supports_streaming=model_config.get("supports_streaming", False),
        cost_per_1k_tokens=model_config.get("cost_per_1k_tokens", 0.0)
    )

@router.post("/{provider}/{model_name}/test")
async def test_model(
    provider: str,
    model_name: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Test a specific model with a simple prompt"""
    
    try:
        response = await llm_manager.generate(
            prompt="Say 'Hello, I am working correctly!'",
            provider=provider,
            model=model_name,
            max_tokens=50
        )
        
        return {
            "status": "success",
            "response": response.content,
            "usage": response.usage,
            "model": response.model
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model test failed: {str(e)}")

@router.get("/providers")
async def list_providers(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, List[str]]:
    """List available LLM providers and their models"""
    
    available_providers = llm_manager.get_available_providers()
    provider_info = {}
    
    for provider in available_providers:
        provider_info[provider] = llm_manager.get_provider_models(provider)
    
    return provider_info