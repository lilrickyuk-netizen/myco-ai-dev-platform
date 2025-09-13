"""
Monitoring and metrics middleware
"""

from fastapi import Request, Response
import time
import logging
from typing import Dict, Any
from prometheus_client import Counter, Histogram, Gauge
import asyncio

from ..core.config import settings

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'http_requests_active',
    'Active HTTP requests'
)

LLM_REQUESTS = Counter(
    'llm_requests_total',
    'Total LLM requests',
    ['provider', 'model']
)

LLM_TOKENS = Counter(
    'llm_tokens_total',
    'Total LLM tokens used',
    ['provider', 'model', 'type']  # type: prompt, completion
)

LLM_DURATION = Histogram(
    'llm_request_duration_seconds',
    'LLM request duration',
    ['provider', 'model']
)

ERROR_COUNT = Counter(
    'errors_total',
    'Total errors',
    ['error_type', 'endpoint']
)

class MonitoringMiddleware:
    """Middleware for monitoring and metrics collection"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    async def __call__(self, request: Request, call_next):
        """Process monitoring for requests"""
        
        start_time = time.time()
        method = request.method
        path = request.url.path
        
        # Normalize path for metrics (remove IDs, etc.)
        normalized_path = self._normalize_path(path)
        
        # Track active requests
        ACTIVE_REQUESTS.inc()
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Record metrics
            REQUEST_COUNT.labels(
                method=method,
                endpoint=normalized_path,
                status_code=response.status_code
            ).inc()
            
            REQUEST_DURATION.labels(
                method=method,
                endpoint=normalized_path
            ).observe(duration)
            
            # Log request
            self._log_request(request, response, duration)
            
            return response
        
        except Exception as e:
            # Record error
            ERROR_COUNT.labels(
                error_type=type(e).__name__,
                endpoint=normalized_path
            ).inc()
            
            # Log error
            self.logger.error(
                f"Request failed: {method} {path}",
                extra={
                    "method": method,
                    "path": path,
                    "error": str(e),
                    "duration": time.time() - start_time
                }
            )
            
            raise
        
        finally:
            # Track active requests
            ACTIVE_REQUESTS.dec()
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path for metrics grouping"""
        
        # Replace UUIDs and IDs with placeholders
        import re
        
        # UUID pattern
        path = re.sub(
            r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            '/{id}',
            path,
            flags=re.IGNORECASE
        )
        
        # Numeric IDs
        path = re.sub(r'/\d+', '/{id}', path)
        
        # Limit path segments for grouping
        segments = path.split('/')[:4]  # Keep first 3 segments
        normalized = '/'.join(segments)
        
        return normalized if normalized else path
    
    def _log_request(self, request: Request, response: Response, duration: float):
        """Log request details"""
        
        log_data = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration": duration,
            "user_agent": request.headers.get("user-agent", ""),
            "ip": self._get_client_ip(request)
        }
        
        # Add user info if available
        auth_header = request.headers.get("authorization", "")
        if auth_header:
            log_data["authenticated"] = True
        
        # Log based on status code
        if response.status_code >= 500:
            self.logger.error("Server error", extra=log_data)
        elif response.status_code >= 400:
            self.logger.warning("Client error", extra=log_data)
        elif settings.DEBUG:
            self.logger.info("Request completed", extra=log_data)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        
        # Check for forwarded headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fall back to client host
        return getattr(request.client, "host", "unknown")

def record_llm_metrics(
    provider: str,
    model: str,
    duration: float,
    prompt_tokens: int,
    completion_tokens: int
):
    """Record LLM-specific metrics"""
    
    LLM_REQUESTS.labels(provider=provider, model=model).inc()
    LLM_DURATION.labels(provider=provider, model=model).observe(duration)
    LLM_TOKENS.labels(provider=provider, model=model, type="prompt").inc(prompt_tokens)
    LLM_TOKENS.labels(provider=provider, model=model, type="completion").inc(completion_tokens)

def record_error(error_type: str, endpoint: str):
    """Record error occurrence"""
    ERROR_COUNT.labels(error_type=error_type, endpoint=endpoint).inc()

class PerformanceMonitor:
    """Performance monitoring utilities"""
    
    def __init__(self):
        self.active_operations: Dict[str, float] = {}
    
    def start_operation(self, operation_id: str):
        """Start monitoring an operation"""
        self.active_operations[operation_id] = time.time()
    
    def end_operation(self, operation_id: str) -> float:
        """End monitoring an operation and return duration"""
        start_time = self.active_operations.pop(operation_id, time.time())
        return time.time() - start_time
    
    def get_active_operations(self) -> Dict[str, float]:
        """Get currently active operations and their durations"""
        current_time = time.time()
        return {
            op_id: current_time - start_time
            for op_id, start_time in self.active_operations.items()
        }

# Global performance monitor
performance_monitor = PerformanceMonitor()