"""
Configuration management for the AI Engine
"""

import os
from typing import List, Optional
from pydantic import BaseSettings, Field
from functools import lru_cache

class Settings(BaseSettings):
    """Application settings"""
    
    # Server configuration
    HOST: str = Field(default="0.0.0.0", env="AI_ENGINE_HOST")
    PORT: int = Field(default=8000, env="AI_ENGINE_PORT")
    WORKERS: int = Field(default=4, env="AI_ENGINE_WORKERS")
    DEBUG: bool = Field(default=False, env="AI_ENGINE_DEBUG")
    LOG_LEVEL: str = Field(default="INFO", env="AI_ENGINE_LOG_LEVEL")
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        env="AI_ENGINE_ALLOWED_ORIGINS"
    )
    
    # Database settings
    DATABASE_URL: str = Field(
        default="postgresql://postgres:password@localhost:5432/myco_ai",
        env="DATABASE_URL"
    )
    MONGODB_URL: str = Field(
        default="mongodb://localhost:27017/myco_ai",
        env="MONGODB_URL"
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        env="REDIS_URL"
    )
    
    # LLM Provider API Keys
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    GOOGLE_API_KEY: Optional[str] = Field(default=None, env="GOOGLE_API_KEY")
    COHERE_API_KEY: Optional[str] = Field(default=None, env="COHERE_API_KEY")
    HUGGINGFACE_API_KEY: Optional[str] = Field(default=None, env="HUGGINGFACE_API_KEY")
    
    # Local LLM settings
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434", env="OLLAMA_BASE_URL")
    
    # Vector Store settings
    PINECONE_API_KEY: Optional[str] = Field(default=None, env="PINECONE_API_KEY")
    PINECONE_ENVIRONMENT: Optional[str] = Field(default=None, env="PINECONE_ENVIRONMENT")
    WEAVIATE_URL: str = Field(default="http://localhost:8080", env="WEAVIATE_URL")
    CHROMA_PERSIST_DIRECTORY: str = Field(default="./data/chroma", env="CHROMA_PERSIST_DIRECTORY")
    
    # Cache settings
    CACHE_TTL: int = Field(default=3600, env="CACHE_TTL")  # 1 hour
    CACHE_MAX_SIZE: int = Field(default=1000, env="CACHE_MAX_SIZE")
    
    # Rate limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    RATE_LIMIT_WINDOW: int = Field(default=60, env="RATE_LIMIT_WINDOW")  # seconds
    
    # Authentication
    JWT_SECRET: str = Field(default="your-secret-key", env="JWT_SECRET")
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, env="JWT_EXPIRE_MINUTES")  # 24 hours
    
    # Generation settings
    DEFAULT_MODEL: str = Field(default="gpt-4", env="DEFAULT_MODEL")
    MAX_TOKENS: int = Field(default=4000, env="MAX_TOKENS")
    DEFAULT_TEMPERATURE: float = Field(default=0.7, env="DEFAULT_TEMPERATURE")
    MAX_CONCURRENT_REQUESTS: int = Field(default=10, env="MAX_CONCURRENT_REQUESTS")
    
    # Agent settings
    AGENT_TIMEOUT: int = Field(default=300, env="AGENT_TIMEOUT")  # 5 minutes
    MAX_AGENT_RETRIES: int = Field(default=3, env="MAX_AGENT_RETRIES")
    
    # File storage
    UPLOAD_DIR: str = Field(default="./data/uploads", env="UPLOAD_DIR")
    MAX_FILE_SIZE: int = Field(default=100 * 1024 * 1024, env="MAX_FILE_SIZE")  # 100MB
    
    # Monitoring
    ENABLE_METRICS: bool = Field(default=True, env="ENABLE_METRICS")
    METRICS_PORT: int = Field(default=9090, env="METRICS_PORT")
    
    # Security
    ENABLE_AUTH: bool = Field(default=True, env="ENABLE_AUTH")
    ALLOWED_API_KEYS: List[str] = Field(default=[], env="ALLOWED_API_KEYS")
    
    # Development settings
    ENABLE_MOCK_RESPONSES: bool = Field(default=False, env="ENABLE_MOCK_RESPONSES")
    MOCK_RESPONSE_DELAY: float = Field(default=0.5, env="MOCK_RESPONSE_DELAY")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# LLM Model configurations
LLM_MODELS = {
    "openai": {
        "gpt-4": {
            "max_tokens": 8192,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.03
        },
        "gpt-4-turbo": {
            "max_tokens": 128000,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.01
        },
        "gpt-3.5-turbo": {
            "max_tokens": 4096,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.002
        }
    },
    "anthropic": {
        "claude-3-opus-20240229": {
            "max_tokens": 4096,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.015
        },
        "claude-3-sonnet-20240229": {
            "max_tokens": 4096,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.003
        },
        "claude-3-haiku-20240307": {
            "max_tokens": 4096,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.00025
        }
    },
    "google": {
        "gemini-pro": {
            "max_tokens": 2048,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.0005
        },
        "gemini-pro-vision": {
            "max_tokens": 2048,
            "supports_streaming": False,
            "cost_per_1k_tokens": 0.0005
        }
    },
    "ollama": {
        "llama2": {
            "max_tokens": 4096,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.0
        },
        "codellama": {
            "max_tokens": 4096,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.0
        },
        "mistral": {
            "max_tokens": 8192,
            "supports_streaming": True,
            "cost_per_1k_tokens": 0.0
        }
    }
}

# Agent capabilities mapping
AGENT_CAPABILITIES = {
    "planner": [
        "requirements_analysis",
        "project_planning",
        "task_decomposition",
        "effort_estimation"
    ],
    "architect": [
        "system_design",
        "database_design",
        "api_design",
        "security_architecture"
    ],
    "backend": [
        "api_development",
        "database_implementation",
        "authentication",
        "business_logic"
    ],
    "frontend": [
        "ui_development",
        "component_design",
        "state_management",
        "responsive_design"
    ],
    "devops": [
        "infrastructure_setup",
        "deployment_automation",
        "monitoring_setup",
        "security_hardening"
    ],
    "tester": [
        "test_planning",
        "test_implementation",
        "quality_assurance",
        "performance_testing"
    ]
}

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

# Global settings instance
settings = get_settings()