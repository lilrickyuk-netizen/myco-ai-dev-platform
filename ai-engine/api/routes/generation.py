"""
Text and code generation routes with hardening: validation, timeouts, retries, provider failover
"""

import asyncio
import time
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from typing import Dict, List, Any, Optional, AsyncGenerator
from pydantic import BaseModel, Field, validator
import json

from ...services.llm_manager import llm_manager, LLMProvider
from ...middleware.auth import get_current_user
from ...core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Request validation models
class GenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=50000, description="The prompt to generate from")
    context: Optional[str] = Field(None, max_length=20000, description="Additional context")
    provider: Optional[str] = Field(None, description="LLM provider to use")
    model: Optional[str] = Field(None, description="Specific model to use")
    max_tokens: Optional[int] = Field(None, ge=1, le=8192, description="Maximum tokens to generate")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Sampling temperature")
    stream: bool = Field(False, description="Stream the response")
    
    @validator('prompt')
    def validate_prompt(cls, v):
        if not v or not v.strip():
            raise ValueError('Prompt cannot be empty or whitespace only')
        return v.strip()

class CodeGenerationRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=10000, description="Description of the code to generate")
    language: str = Field(..., min_length=1, max_length=50, description="Programming language")
    framework: Optional[str] = Field(None, max_length=100, description="Framework to use")
    features: Optional[List[str]] = Field(None, description="Features to include")
    style_guide: Optional[str] = Field(None, max_length=1000, description="Code style guide to follow")
    
    @validator('features')
    def validate_features(cls, v):
        if v and len(v) > 20:
            raise ValueError('Too many features specified (max 20)')
        return v

class CodeExplanationRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50000, description="Code to explain")
    language: str = Field(..., min_length=1, max_length=50, description="Programming language")
    focus: Optional[str] = Field(None, max_length=500, description="Specific aspect to focus on")

class DebugRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50000, description="Code to debug")
    error: Optional[str] = Field(None, max_length=10000, description="Error message")
    language: str = Field("javascript", min_length=1, max_length=50, description="Programming language")
    context: Optional[str] = Field(None, max_length=5000, description="Additional context")

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., description="Chat messages")
    model: Optional[str] = Field(None, description="Model to use")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="Temperature")
    
    @validator('messages')
    def validate_messages(cls, v):
        if not v:
            raise ValueError('Messages cannot be empty')
        if len(v) > 100:
            raise ValueError('Too many messages in conversation (max 100)')
        
        for msg in v:
            if not isinstance(msg, dict) or 'role' not in msg or 'content' not in msg:
                raise ValueError('Each message must have role and content')
            if msg['role'] not in ['user', 'assistant', 'system']:
                raise ValueError('Invalid message role')
            if not msg['content'] or len(msg['content']) > 20000:
                raise ValueError('Message content invalid or too long')
        
        return v

# Response models
class GenerationResponse(BaseModel):
    content: str
    usage: Dict[str, int]
    model: str
    provider: str
    timestamp: float

class ErrorResponse(BaseModel):
    error: str
    code: str
    timestamp: float

# Hardened generation with retries and failover
async def hardened_generate(
    prompt: str,
    context: Optional[str] = None,
    provider: Optional[LLMProvider] = None,
    **kwargs
) -> GenerationResponse:
    """Generate with retries and provider failover"""
    
    # Default retry configuration
    max_retries = 3
    base_delay = 1.0
    timeout_seconds = 30.0
    
    providers_to_try = [provider] if provider else [
        LLMProvider.OPENAI,
        LLMProvider.ANTHROPIC, 
        LLMProvider.GOOGLE,
        LLMProvider.LOCAL  # Fallback
    ]
    
    last_error = None
    
    for provider_attempt in providers_to_try:
        if provider_attempt not in llm_manager.providers:
            continue
            
        for retry in range(max_retries):
            try:
                # Apply timeout
                response = await asyncio.wait_for(
                    llm_manager.generate(
                        prompt=prompt,
                        context=context,
                        provider=provider_attempt,
                        **kwargs
                    ),
                    timeout=timeout_seconds
                )
                
                return GenerationResponse(
                    content=response.content,
                    usage=response.usage,
                    model=response.model,
                    provider=response.metadata.get("provider", "unknown"),
                    timestamp=time.time()
                )
                
            except asyncio.TimeoutError as e:
                last_error = f"Timeout after {timeout_seconds}s with {provider_attempt.value}"
                logger.warning(f"Generation timeout (attempt {retry + 1}): {last_error}")
                
            except Exception as e:
                last_error = f"Error with {provider_attempt.value}: {str(e)}"
                logger.warning(f"Generation error (attempt {retry + 1}): {last_error}")
                
                # Don't retry on certain errors
                if "rate limit" in str(e).lower() or "quota" in str(e).lower():
                    break
            
            # Exponential backoff
            if retry < max_retries - 1:
                await asyncio.sleep(base_delay * (2 ** retry))
    
    # All providers and retries failed
    raise HTTPException(
        status_code=503,
        detail=f"All generation attempts failed. Last error: {last_error}"
    )

@router.post("/generation", response_model=GenerationResponse)
async def generate_text(
    request: GenerationRequest,
    req: Request,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Generate text with full hardening"""
    
    logger.info(f"Generation request from user {current_user.get('id', 'unknown')}")
    
    try:
        provider_enum = None
        if request.provider:
            try:
                provider_enum = LLMProvider(request.provider)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid provider: {request.provider}")
        
        return await hardened_generate(
            prompt=request.prompt,
            context=request.context,
            provider=provider_enum,
            model=request.model,
            max_tokens=request.max_tokens or settings.MAX_TOKENS,
            temperature=request.temperature or settings.DEFAULT_TEMPERATURE
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected generation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal generation error")

@router.post("/chat")
async def chat_completion(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """OpenAI-compatible chat completion with hardening"""
    
    try:
        # Build prompt from messages
        prompt_parts = []
        for msg in request.messages:
            role = msg['role'].title()
            content = msg['content']
            prompt_parts.append(f"{role}: {content}")
        
        full_prompt = "\n\n".join(prompt_parts) + "\n\nAssistant:"
        
        response = await hardened_generate(
            prompt=full_prompt,
            model=request.model,
            temperature=request.temperature
        )
        
        # Return in OpenAI format
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": response.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response.content
                },
                "finish_reason": "stop"
            }],
            "usage": response.usage
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat completion error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Chat completion failed")

@router.post("/generation/stream")
async def stream_text_generation(
    request: GenerationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Stream text generation with hardening"""
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            provider_enum = None
            if request.provider:
                try:
                    provider_enum = LLMProvider(request.provider)
                except ValueError:
                    yield f"data: {json.dumps({'error': f'Invalid provider: {request.provider}'})}\n\n"
                    return
            
            # Apply timeout to streaming
            try:
                stream_gen = llm_manager.generate_stream(
                    prompt=request.prompt,
                    context=request.context,
                    provider=provider_enum,
                    max_tokens=request.max_tokens or settings.MAX_TOKENS,
                    temperature=request.temperature or settings.DEFAULT_TEMPERATURE
                )
                
                async for chunk in asyncio.wait_for(stream_gen, timeout=60.0):
                    yield f"data: {json.dumps({'content': chunk, 'timestamp': time.time()})}\n\n"
                
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'error': 'Stream timeout'})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'error': 'Streaming failed'})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )

@router.post("/code/generate", response_model=GenerationResponse)
async def generate_code(
    request: CodeGenerationRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Generate code with hardening"""
    
    try:
        response = await asyncio.wait_for(
            llm_manager.code_generation(
                description=request.description,
                language=request.language,
                framework=request.framework,
                features=request.features,
                style_guide=request.style_guide
            ),
            timeout=45.0
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Code generation timeout")
    except Exception as e:
        logger.error(f"Code generation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Code generation failed")

@router.post("/code/explain", response_model=GenerationResponse)
async def explain_code(
    request: CodeExplanationRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Explain code with hardening"""
    
    try:
        response = await asyncio.wait_for(
            llm_manager.code_explanation(
                code=request.code,
                language=request.language,
                focus=request.focus
            ),
            timeout=30.0
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Code explanation timeout")
    except Exception as e:
        logger.error(f"Code explanation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Code explanation failed")

@router.post("/code/debug", response_model=GenerationResponse)
async def debug_code(
    request: DebugRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Debug code with hardening"""
    
    try:
        response = await asyncio.wait_for(
            llm_manager.debug_assistance(
                code=request.code,
                error=request.error,
                language=request.language,
                context=request.context
            ),
            timeout=45.0
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Code debugging timeout")
    except Exception as e:
        logger.error(f"Code debugging error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Code debugging failed")

@router.post("/code/optimize", response_model=GenerationResponse)
async def optimize_code(
    request: CodeExplanationRequest,
    current_user: dict = Depends(get_current_user)
) -> GenerationResponse:
    """Optimize code with hardening"""
    
    try:
        response = await asyncio.wait_for(
            llm_manager.performance_optimization(
                code=request.code,
                language=request.language,
                metrics={}
            ),
            timeout=45.0
        )
        
        return GenerationResponse(
            content=response.content,
            usage=response.usage,
            model=response.model,
            provider=response.metadata.get("provider", "unknown"),
            timestamp=time.time()
        )
        
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Code optimization timeout")
    except Exception as e:
        logger.error(f"Code optimization error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Code optimization failed")