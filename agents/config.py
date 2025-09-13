import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import json

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"
    OLLAMA = "ollama"

@dataclass
class LLMConfig:
    provider: LLMProvider
    model_name: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    max_tokens: int = 4000
    temperature: float = 0.7
    timeout: int = 60

@dataclass
class AgentConfig:
    max_concurrent_tasks: int = 5
    task_timeout: int = 300
    retry_attempts: int = 3
    performance_tracking: bool = True
    log_level: str = "INFO"

@dataclass
class SystemConfig:
    workspace_path: str = "/tmp/myco_workspace"
    control_plane_path: str = ".myco"
    max_project_size_mb: int = 1000
    enable_telemetry: bool = True
    enable_caching: bool = True
    cache_ttl: int = 3600

class Config:
    def __init__(self):
        self.llm_configs = self._load_llm_configs()
        self.agent_config = self._load_agent_config()
        self.system_config = self._load_system_config()
        self.database_config = self._load_database_config()
        
    def _load_llm_configs(self) -> Dict[str, LLMConfig]:
        return {
            "primary": LLMConfig(
                provider=LLMProvider.ANTHROPIC,
                model_name="claude-3-sonnet-20240229",
                api_key=os.getenv("ANTHROPIC_API_KEY"),
                max_tokens=4000,
                temperature=0.7
            ),
            "secondary": LLMConfig(
                provider=LLMProvider.OPENAI,
                model_name="gpt-4-turbo-preview",
                api_key=os.getenv("OPENAI_API_KEY"),
                max_tokens=4000,
                temperature=0.7
            ),
            "fast": LLMConfig(
                provider=LLMProvider.OPENAI,
                model_name="gpt-3.5-turbo",
                api_key=os.getenv("OPENAI_API_KEY"),
                max_tokens=2000,
                temperature=0.5
            ),
            "local": LLMConfig(
                provider=LLMProvider.OLLAMA,
                model_name="llama2",
                base_url="http://localhost:11434",
                max_tokens=2000,
                temperature=0.6
            )
        }
    
    def _load_agent_config(self) -> AgentConfig:
        return AgentConfig(
            max_concurrent_tasks=int(os.getenv("MAX_CONCURRENT_TASKS", "5")),
            task_timeout=int(os.getenv("TASK_TIMEOUT", "300")),
            retry_attempts=int(os.getenv("RETRY_ATTEMPTS", "3")),
            performance_tracking=os.getenv("PERFORMANCE_TRACKING", "true").lower() == "true",
            log_level=os.getenv("LOG_LEVEL", "INFO")
        )
    
    def _load_system_config(self) -> SystemConfig:
        return SystemConfig(
            workspace_path=os.getenv("WORKSPACE_PATH", "/tmp/myco_workspace"),
            control_plane_path=os.getenv("CONTROL_PLANE_PATH", ".myco"),
            max_project_size_mb=int(os.getenv("MAX_PROJECT_SIZE_MB", "1000")),
            enable_telemetry=os.getenv("ENABLE_TELEMETRY", "true").lower() == "true",
            enable_caching=os.getenv("ENABLE_CACHING", "true").lower() == "true",
            cache_ttl=int(os.getenv("CACHE_TTL", "3600"))
        )
    
    def _load_database_config(self) -> Dict[str, Any]:
        return {
            "postgresql": {
                "host": os.getenv("POSTGRES_HOST", "localhost"),
                "port": int(os.getenv("POSTGRES_PORT", "5432")),
                "database": os.getenv("POSTGRES_DB", "myco_platform"),
                "username": os.getenv("POSTGRES_USER", "postgres"),
                "password": os.getenv("POSTGRES_PASSWORD", ""),
                "pool_size": int(os.getenv("POSTGRES_POOL_SIZE", "10"))
            },
            "mongodb": {
                "host": os.getenv("MONGO_HOST", "localhost"),
                "port": int(os.getenv("MONGO_PORT", "27017")),
                "database": os.getenv("MONGO_DB", "myco_platform"),
                "username": os.getenv("MONGO_USER", ""),
                "password": os.getenv("MONGO_PASSWORD", "")
            },
            "redis": {
                "host": os.getenv("REDIS_HOST", "localhost"),
                "port": int(os.getenv("REDIS_PORT", "6379")),
                "password": os.getenv("REDIS_PASSWORD", ""),
                "db": int(os.getenv("REDIS_DB", "0"))
            }
        }
    
    def get_llm_config(self, name: str = "primary") -> LLMConfig:
        return self.llm_configs.get(name, self.llm_configs["primary"])
    
    def get_best_available_llm(self) -> LLMConfig:
        """Get the best available LLM config based on API key availability"""
        for name in ["primary", "secondary", "fast", "local"]:
            config = self.llm_configs[name]
            if config.provider in [LLMProvider.OLLAMA] or config.api_key:
                return config
        
        raise RuntimeError("No LLM configuration available with valid API key")

# Global config instance
config = Config()