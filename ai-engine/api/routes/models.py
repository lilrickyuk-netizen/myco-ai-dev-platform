"""
Model management and information routes
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any
from pydantic import BaseModel

from ...services.llm_manager import llm_manager, LLMProvider
from ...middleware.auth import get_current_user
from ...core.config import LLM_MODELS, settings

router = APIRouter()

class ModelInfo(BaseModel):
    name: str
    provider: str
    max_tokens: int
    supports_streaming: bool
    cost_per_1k_tokens: float
    available: bool

class ProviderInfo(BaseModel):
    name: str
    models: List[ModelInfo]
    available: bool
    api_key_configured: bool

@router.get("/", response_model=List[ProviderInfo])
async def list_providers() -> List[ProviderInfo]:
    """List all available LLM providers and their models"""
    
    providers = []
    available_providers = llm_manager.get_available_providers()
    
    for provider_name, models in LLM_MODELS.items():
        is_available = provider_name in available_providers
        
        # Check if API key is configured
        api_key_configured = False
        if provider_name == "openai":
            api_key_configured = bool(settings.OPENAI_API_KEY)
        elif provider_name == "anthropic":
            api_key_configured = bool(settings.ANTHROPIC_API_KEY)
        elif provider_name == "google":
            api_key_configured = bool(settings.GOOGLE_API_KEY)
        elif provider_name == "cohere":
            api_key_configured = bool(settings.COHERE_API_KEY)
        elif provider_name == "ollama":
            api_key_configured = True  # Local models don't need API keys
        
        model_infos = []
        for model_name, model_config in models.items():
            model_infos.append(ModelInfo(
                name=model_name,
                provider=provider_name,
                max_tokens=model_config["max_tokens"],
                supports_streaming=model_config["supports_streaming"],
                cost_per_1k_tokens=model_config["cost_per_1k_tokens"],
                available=is_available and api_key_configured
            ))
        
        providers.append(ProviderInfo(
            name=provider_name,
            models=model_infos,
            available=is_available,
            api_key_configured=api_key_configured
        ))
    
    return providers

@router.get("/{provider}")
async def get_provider_models(provider: str) -> ProviderInfo:
    """Get information about a specific provider"""
    
    if provider not in LLM_MODELS:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
    
    available_providers = llm_manager.get_available_providers()
    is_available = provider in available_providers
    
    # Check if API key is configured
    api_key_configured = False
    if provider == "openai":
        api_key_configured = bool(settings.OPENAI_API_KEY)
    elif provider == "anthropic":
        api_key_configured = bool(settings.ANTHROPIC_API_KEY)
    elif provider == "google":
        api_key_configured = bool(settings.GOOGLE_API_KEY)
    elif provider == "cohere":
        api_key_configured = bool(settings.COHERE_API_KEY)
    elif provider == "ollama":
        api_key_configured = True
    
    models = LLM_MODELS[provider]
    model_infos = []
    
    for model_name, model_config in models.items():
        model_infos.append(ModelInfo(
            name=model_name,
            provider=provider,
            max_tokens=model_config["max_tokens"],
            supports_streaming=model_config["supports_streaming"],
            cost_per_1k_tokens=model_config["cost_per_1k_tokens"],
            available=is_available and api_key_configured
        ))
    
    return ProviderInfo(
        name=provider,
        models=model_infos,
        available=is_available,
        api_key_configured=api_key_configured
    )

@router.get("/{provider}/{model}")
async def get_model_info(provider: str, model: str) -> ModelInfo:
    """Get information about a specific model"""
    
    if provider not in LLM_MODELS:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
    
    if model not in LLM_MODELS[provider]:
        raise HTTPException(status_code=404, detail=f"Model {model} not found for provider {provider}")
    
    available_providers = llm_manager.get_available_providers()
    is_available = provider in available_providers
    
    model_config = LLM_MODELS[provider][model]
    
    return ModelInfo(
        name=model,
        provider=provider,
        max_tokens=model_config["max_tokens"],
        supports_streaming=model_config["supports_streaming"],
        cost_per_1k_tokens=model_config["cost_per_1k_tokens"],
        available=is_available
    )

@router.post("/{provider}/{model}/test")
async def test_model(
    provider: str,
    model: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Test a specific model with a simple generation"""
    
    if provider not in LLM_MODELS:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
    
    if model not in LLM_MODELS[provider]:
        raise HTTPException(status_code=404, detail=f"Model {model} not found for provider {provider}")
    
    try:
        provider_enum = LLMProvider(provider)
        
        response = await llm_manager.generate(
            prompt="Say 'Hello, I am working correctly!' in a friendly way.",
            provider=provider_enum,
            model=model,
            max_tokens=50
        )
        
        return {
            "success": True,
            "response": response.content,
            "usage": response.usage,
            "model": response.model,
            "provider": provider
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "provider": provider,
            "model": model
        }