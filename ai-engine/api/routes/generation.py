"""
Text and code generation routes
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, List, Any, Optional, AsyncGenerator
from pydantic import BaseModel, Field
import json
import time

from ...services.llm_manager import llm_manager, LLMProvider
from ...middleware.auth import get_current_user
from ...core.config import settings

router = APIRouter()

class GenerationRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to generate from")
    context: Optional[str] = Field(None, description="Additional context")
    provider: Optional[str] = Field(None, description="LLM provider to use")
    model: Optional[str] = Field(None, description="Specific model to use")
    max_tokens: Optional[int] = Field(None, description="Maximum tokens to generate")
    temperature: Optional[float] = Field(None, description="Sampling temperature")
    stream: bool = Field(False, description="Stream the response")

class CodeGenerationRequest(BaseModel):
    description: str = Field(..., description="Description of the code to generate")
    language: str = Field(..., description="Programming language")
    framework: Optional[str] = Field(None, description="Framework to use")
    features: Optional[List[str]] = Field(None, description="Features to include")
    style_guide: Optional[str] = Field(None, description="Code style guide to follow")

class CodeExplanationRequest(BaseModel):
    code: str = Field(..., description="Code to explain")
    language: str = Field(..., description="Programming language")
    focus: Optional[str] = Field(None, description="Specific aspect to focus on")

class DebugRequest(BaseModel):
    code: str = Field(..., description="Code to debug")
    error: Optional[str] = Field(None, description="Error message")
    language: str = Field("javascript", description="Programming language")
    context: Optional[str] = Field(None, description="Additional context")

class GenerationResponse(BaseModel):
    content: str
    usage: Dict[str, int]
    model: str
    provider: str
    timestamp: float

@router.post("/text", response_model=GenerationResponse)
async def generate_text(
    request: GenerationRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Generate text based on prompt"""
    
    try:
        provider_enum = None
        if request.provider:
            try:
                provider_enum = LLMProvider(request.provider)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid provider: {request.provider}")
        
        response = await llm_manager.generate(
            prompt=request.prompt,
            context=request.context,
            provider=provider_enum,
            model=request.model,
            max_tokens=request.max_tokens or settings.MAX_TOKENS,
            temperature=request.temperature or settings.DEFAULT_TEMPERATURE
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@router.post("/text/stream")
async def stream_text_generation(
    request: GenerationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Stream text generation"""
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            provider_enum = None
            if request.provider:
                try:
                    provider_enum = LLMProvider(request.provider)
                except ValueError:
                    yield f"data: {json.dumps({'error': f'Invalid provider: {request.provider}'})}\n\n"
                    return
            
            async for chunk in llm_manager.generate_stream(
                prompt=request.prompt,
                context=request.context,
                provider=provider_enum,
                max_tokens=request.max_tokens or settings.MAX_TOKENS,
                temperature=request.temperature or settings.DEFAULT_TEMPERATURE
            ):
                yield f"data: {json.dumps({'content': chunk, 'timestamp': time.time()})}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@router.post("/code", response_model=GenerationResponse)
async def generate_code(
    request: CodeGenerationRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Generate code based on description"""
    
    try:
        response = await llm_manager.code_generation(
            description=request.description,
            language=request.language,
            framework=request.framework,
            features=request.features,
            style_guide=request.style_guide
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

@router.post("/code/explain", response_model=GenerationResponse)
async def explain_code(
    request: CodeExplanationRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Explain code functionality"""
    
    try:
        response = await llm_manager.code_explanation(
            code=request.code,
            language=request.language,
            focus=request.focus
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code explanation failed: {str(e)}")

@router.post("/code/debug", response_model=GenerationResponse)
async def debug_code(
    request: DebugRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Debug code and suggest fixes"""
    
    try:
        response = await llm_manager.debug_assistance(
            code=request.code,
            error=request.error,
            language=request.language,
            context=request.context
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code debugging failed: {str(e)}")

@router.post("/code/optimize", response_model=GenerationResponse)
async def optimize_code(
    request: CodeExplanationRequest,  # Reuse this model
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Optimize code for performance"""
    
    try:
        response = await llm_manager.performance_optimization(
            code=request.code,
            language=request.language,
            metrics={}  # Could be extended to accept performance metrics
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code optimization failed: {str(e)}")