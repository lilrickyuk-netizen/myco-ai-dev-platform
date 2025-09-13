"""
Custom exceptions for the AI Engine
"""

class AIEngineError(Exception):
    """Base exception for AI Engine"""
    pass

class LLMError(AIEngineError):
    """LLM-related errors"""
    pass

class ModelNotFoundError(LLMError):
    """Model not found error"""
    pass

class RateLimitError(LLMError):
    """Rate limit exceeded error"""
    pass

class AgentError(AIEngineError):
    """Agent-related errors"""
    pass

class VectorStoreError(AIEngineError):
    """Vector store related errors"""
    pass

class AuthenticationError(AIEngineError):
    """Authentication errors"""
    pass

class ValidationError(AIEngineError):
    """Validation errors"""
    pass