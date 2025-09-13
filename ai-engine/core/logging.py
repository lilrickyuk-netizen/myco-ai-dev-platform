"""
Structured logging configuration for AI Engine
"""

import logging
import logging.config
import json
import sys
import time
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from .config import settings

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON"""
        
        # Base log structure
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                'filename', 'module', 'lineno', 'funcName', 'created',
                'msecs', 'relativeCreated', 'thread', 'threadName',
                'processName', 'process', 'getMessage', 'exc_info',
                'exc_text', 'stack_info'
            } and not key.startswith('_'):
                log_entry[key] = value
        
        return json.dumps(log_entry, default=str)

class RequestContextFilter(logging.Filter):
    """Filter to add request context to log records"""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add request context to log record"""
        
        # Add request ID if available (would be set by middleware)
        if not hasattr(record, 'request_id'):
            record.request_id = getattr(self, '_current_request_id', None)
        
        # Add user ID if available
        if not hasattr(record, 'user_id'):
            record.user_id = getattr(self, '_current_user_id', None)
        
        # Add correlation ID for distributed tracing
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = getattr(self, '_current_correlation_id', None)
        
        return True
    
    def set_request_context(self, request_id: str, user_id: Optional[str] = None, correlation_id: Optional[str] = None):
        """Set request context for logging"""
        self._current_request_id = request_id
        self._current_user_id = user_id
        self._current_correlation_id = correlation_id
    
    def clear_request_context(self):
        """Clear request context"""
        self._current_request_id = None
        self._current_user_id = None
        self._current_correlation_id = None

class PerformanceFilter(logging.Filter):
    """Filter to add performance metrics to log records"""
    
    def __init__(self):
        super().__init__()
        self.start_times: Dict[str, float] = {}
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add performance metrics to log record"""
        
        # Add timestamp
        record.timestamp_unix = time.time()
        
        # Add memory usage if psutil is available
        try:
            import psutil
            process = psutil.Process()
            record.memory_mb = process.memory_info().rss / 1024 / 1024
            record.cpu_percent = process.cpu_percent()
        except ImportError:
            pass
        
        return True
    
    def start_timer(self, operation: str):
        """Start timing an operation"""
        self.start_times[operation] = time.time()
    
    def end_timer(self, operation: str) -> float:
        """End timing an operation and return duration"""
        if operation in self.start_times:
            duration = time.time() - self.start_times[operation]
            del self.start_times[operation]
            return duration
        return 0.0

class SecurityFilter(logging.Filter):
    """Filter to sanitize sensitive information from logs"""
    
    SENSITIVE_KEYS = {
        'password', 'token', 'api_key', 'secret', 'private_key',
        'authorization', 'cookie', 'session_id', 'credit_card',
        'ssn', 'social_security'
    }
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Sanitize sensitive information from log record"""
        
        # Sanitize message
        record.msg = self._sanitize_text(str(record.msg))
        
        # Sanitize args
        if record.args:
            record.args = tuple(
                self._sanitize_value(arg) for arg in record.args
            )
        
        # Sanitize extra fields
        for key, value in list(record.__dict__.items()):
            if self._is_sensitive_key(key):
                record.__dict__[key] = "[REDACTED]"
            elif isinstance(value, (str, dict, list)):
                record.__dict__[key] = self._sanitize_value(value)
        
        return True
    
    def _sanitize_text(self, text: str) -> str:
        """Sanitize sensitive information from text"""
        # Simple pattern matching for common sensitive data
        import re
        
        # Credit card numbers
        text = re.sub(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', '[CREDIT_CARD]', text)
        
        # Email addresses (partial masking)
        text = re.sub(r'\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b', r'\1***@\2', text)
        
        # API keys (pattern: starts with specific prefixes)
        text = re.sub(r'\b(sk-|pk-|rk-)[a-zA-Z0-9]{20,}\b', r'\1[REDACTED]', text)
        
        return text
    
    def _sanitize_value(self, value: Any) -> Any:
        """Sanitize a value recursively"""
        if isinstance(value, str):
            return self._sanitize_text(value)
        elif isinstance(value, dict):
            return {
                k: "[REDACTED]" if self._is_sensitive_key(k) else self._sanitize_value(v)
                for k, v in value.items()
            }
        elif isinstance(value, list):
            return [self._sanitize_value(item) for item in value]
        else:
            return value
    
    def _is_sensitive_key(self, key: str) -> bool:
        """Check if a key contains sensitive information"""
        key_lower = key.lower()
        return any(sensitive in key_lower for sensitive in self.SENSITIVE_KEYS)

class MetricsHandler(logging.Handler):
    """Custom handler to send metrics to monitoring system"""
    
    def __init__(self):
        super().__init__()
        self.error_count = 0
        self.warning_count = 0
        self.info_count = 0
    
    def emit(self, record: logging.LogRecord):
        """Emit log record and update metrics"""
        
        # Count by level
        if record.levelno >= logging.ERROR:
            self.error_count += 1
        elif record.levelno >= logging.WARNING:
            self.warning_count += 1
        elif record.levelno >= logging.INFO:
            self.info_count += 1
        
        # Send to metrics system (e.g., Prometheus, StatsD)
        # This would integrate with your monitoring infrastructure
    
    def get_metrics(self) -> Dict[str, int]:
        """Get current metrics"""
        return {
            "errors": self.error_count,
            "warnings": self.warning_count,
            "info": self.info_count
        }

def setup_logging():
    """Setup structured logging configuration"""
    
    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Custom filters
    request_context_filter = RequestContextFilter()
    performance_filter = PerformanceFilter()
    security_filter = SecurityFilter()
    
    # Logging configuration
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "structured": {
                "()": StructuredFormatter,
            },
            "simple": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            }
        },
        "filters": {
            "request_context": {
                "()": lambda: request_context_filter
            },
            "performance": {
                "()": lambda: performance_filter
            },
            "security": {
                "()": lambda: security_filter
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "structured" if not settings.DEBUG else "simple",
                "filters": ["security", "request_context", "performance"]
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": log_dir / "ai-engine.log",
                "maxBytes": 10 * 1024 * 1024,  # 10MB
                "backupCount": 5,
                "formatter": "structured",
                "filters": ["security", "request_context", "performance"]
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": log_dir / "errors.log",
                "maxBytes": 10 * 1024 * 1024,  # 10MB
                "backupCount": 5,
                "formatter": "structured",
                "level": "ERROR",
                "filters": ["security", "request_context", "performance"]
            }
        },
        "loggers": {
            "": {  # Root logger
                "level": settings.LOG_LEVEL,
                "handlers": ["console", "file", "error_file"],
                "propagate": False
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False
            },
            "fastapi": {
                "level": "INFO",
                "handlers": ["console", "file"],
                "propagate": False
            },
            "ai_engine": {
                "level": settings.LOG_LEVEL,
                "handlers": ["console", "file", "error_file"],
                "propagate": False
            }
        }
    }
    
    # Apply configuration
    logging.config.dictConfig(config)
    
    # Store filters for later use
    setup_logging.request_context_filter = request_context_filter
    setup_logging.performance_filter = performance_filter
    setup_logging.security_filter = security_filter
    
    # Log startup message
    logger = logging.getLogger("ai_engine.startup")
    logger.info("Structured logging initialized", extra={
        "log_level": settings.LOG_LEVEL,
        "debug_mode": settings.DEBUG,
        "log_directory": str(log_dir.absolute())
    })

class LogContextManager:
    """Context manager for adding context to logs"""
    
    def __init__(self, **context):
        self.context = context
        self.old_context = {}
    
    def __enter__(self):
        """Add context to current logger"""
        # This would typically integrate with threading.local or contextvars
        # For now, just store in class
        self.old_context = getattr(LogContextManager, '_current_context', {})
        LogContextManager._current_context = {**self.old_context, **self.context}
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Remove context from current logger"""
        LogContextManager._current_context = self.old_context

def get_logger(name: str) -> logging.Logger:
    """Get a logger with current context"""
    logger = logging.getLogger(name)
    
    # Add current context if available
    current_context = getattr(LogContextManager, '_current_context', {})
    if current_context:
        logger = logging.LoggerAdapter(logger, current_context)
    
    return logger

def log_function_call(func):
    """Decorator to log function calls"""
    def wrapper(*args, **kwargs):
        logger = get_logger(f"{func.__module__}.{func.__name__}")
        
        # Log function entry
        logger.debug(f"Entering {func.__name__}", extra={
            "function": func.__name__,
            "args": len(args),
            "kwargs": list(kwargs.keys())
        })
        
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Log successful completion
            logger.debug(f"Completed {func.__name__}", extra={
                "function": func.__name__,
                "duration": duration,
                "success": True
            })
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Log exception
            logger.error(f"Error in {func.__name__}: {str(e)}", extra={
                "function": func.__name__,
                "duration": duration,
                "success": False,
                "error": str(e)
            }, exc_info=True)
            
            raise
    
    return wrapper

async def log_async_function_call(func):
    """Decorator to log async function calls"""
    async def wrapper(*args, **kwargs):
        logger = get_logger(f"{func.__module__}.{func.__name__}")
        
        # Log function entry
        logger.debug(f"Entering async {func.__name__}", extra={
            "function": func.__name__,
            "args": len(args),
            "kwargs": list(kwargs.keys()),
            "async": True
        })
        
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Log successful completion
            logger.debug(f"Completed async {func.__name__}", extra={
                "function": func.__name__,
                "duration": duration,
                "success": True,
                "async": True
            })
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Log exception
            logger.error(f"Error in async {func.__name__}: {str(e)}", extra={
                "function": func.__name__,
                "duration": duration,
                "success": False,
                "error": str(e),
                "async": True
            }, exc_info=True)
            
            raise
    
    return wrapper