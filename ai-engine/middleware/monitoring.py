"""
Monitoring and metrics middleware for the AI Engine
"""

import time
import logging
from typing import Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio
from collections import defaultdict, Counter
import json

try:
    from prometheus_client import Counter as PrometheusCounter, Histogram, Gauge, CollectorRegistry, generate_latest
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

from ..core.config import settings

logger = logging.getLogger(__name__)

class MonitoringMiddleware(BaseHTTPMiddleware):
    """Monitoring middleware that tracks requests, responses, and performance"""
    
    def __init__(self, app):
        super().__init__(app)
        self.request_count = Counter()
        self.response_times = defaultdict(list)
        self.error_count = Counter()
        self.active_requests = 0
        
        # Initialize Prometheus metrics if available
        if PROMETHEUS_AVAILABLE and settings.ENABLE_METRICS:
            self.registry = CollectorRegistry()
            self._init_prometheus_metrics()
        else:
            self.registry = None
    
    def _init_prometheus_metrics(self):
        """Initialize Prometheus metrics"""
        
        self.prom_request_count = PrometheusCounter(
            'ai_engine_requests_total',
            'Total number of requests',
            ['method', 'endpoint', 'status_code'],
            registry=self.registry
        )
        
        self.prom_request_duration = Histogram(
            'ai_engine_request_duration_seconds',
            'Request duration in seconds',
            ['method', 'endpoint'],
            registry=self.registry
        )
        
        self.prom_active_requests = Gauge(
            'ai_engine_active_requests',
            'Number of active requests',
            registry=self.registry
        )
        
        self.prom_llm_requests = PrometheusCounter(
            'ai_engine_llm_requests_total',
            'Total number of LLM requests',
            ['provider', 'model'],
            registry=self.registry
        )
        
        self.prom_llm_tokens = PrometheusCounter(
            'ai_engine_llm_tokens_total',
            'Total number of LLM tokens used',
            ['provider', 'model', 'type'],
            registry=self.registry
        )
        
        self.prom_agent_sessions = PrometheusCounter(
            'ai_engine_agent_sessions_total',
            'Total number of agent sessions',
            ['session_type', 'status'],
            registry=self.registry
        )
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        method = request.method
        path = request.url.path
        
        # Normalize path for metrics (remove IDs)
        normalized_path = self._normalize_path(path)
        
        # Increment active requests
        self.active_requests += 1
        if self.registry:
            self.prom_active_requests.set(self.active_requests)
        
        try:
            response = await call_next(request)
            status_code = response.status_code
            
            # Record successful request
            self._record_request(method, normalized_path, status_code, start_time)
            
            # Add monitoring headers
            response.headers["X-Request-ID"] = getattr(request.state, "request_id", "unknown")
            response.headers["X-Response-Time"] = f"{time.time() - start_time:.3f}s"
            
            return response
            
        except Exception as e:
            # Record error
            self._record_error(method, normalized_path, str(e), start_time)
            raise
        
        finally:
            # Decrement active requests
            self.active_requests -= 1
            if self.registry:
                self.prom_active_requests.set(self.active_requests)
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path for metrics by removing variable components"""
        
        # Common patterns to normalize
        normalizations = [
            (r'/sessions/[^/]+', '/sessions/{id}'),
            (r'/models/[^/]+/[^/]+', '/models/{provider}/{model}'),
            (r'/tasks/[^/]+', '/tasks/{id}'),
            (r'/users/[^/]+', '/users/{id}'),
        ]
        
        import re
        normalized = path
        for pattern, replacement in normalizations:
            normalized = re.sub(pattern, replacement, normalized)
        
        return normalized
    
    def _record_request(self, method: str, path: str, status_code: int, start_time: float):
        """Record request metrics"""
        
        duration = time.time() - start_time
        
        # Update internal counters
        self.request_count[(method, path, status_code)] += 1
        self.response_times[f"{method} {path}"].append(duration)
        
        # Keep only last 1000 response times per endpoint
        if len(self.response_times[f"{method} {path}"]) > 1000:
            self.response_times[f"{method} {path}"] = self.response_times[f"{method} {path}"][-1000:]
        
        # Update Prometheus metrics
        if self.registry:
            self.prom_request_count.labels(
                method=method,
                endpoint=path,
                status_code=str(status_code)
            ).inc()
            
            self.prom_request_duration.labels(
                method=method,
                endpoint=path
            ).observe(duration)
        
        # Log slow requests
        if duration > 5.0:  # 5 seconds
            logger.warning(f"Slow request: {method} {path} took {duration:.3f}s")
    
    def _record_error(self, method: str, path: str, error: str, start_time: float):
        """Record error metrics"""
        
        duration = time.time() - start_time
        
        # Update internal counters
        self.error_count[(method, path, error)] += 1
        
        # Update Prometheus metrics
        if self.registry:
            self.prom_request_count.labels(
                method=method,
                endpoint=path,
                status_code="500"
            ).inc()
        
        # Log error
        logger.error(f"Request error: {method} {path} - {error} (took {duration:.3f}s)")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        
        # Calculate average response times
        avg_response_times = {}
        for endpoint, times in self.response_times.items():
            if times:
                avg_response_times[endpoint] = sum(times) / len(times)
        
        return {
            "request_count": dict(self.request_count),
            "error_count": dict(self.error_count),
            "avg_response_times": avg_response_times,
            "active_requests": self.active_requests,
            "total_requests": sum(self.request_count.values()),
            "total_errors": sum(self.error_count.values())
        }
    
    def get_prometheus_metrics(self) -> str:
        """Get Prometheus formatted metrics"""
        
        if not self.registry:
            return ""
        
        return generate_latest(self.registry).decode("utf-8")

# Global monitoring instance
monitoring = None

def get_monitoring_middleware() -> MonitoringMiddleware:
    """Get or create monitoring middleware instance"""
    global monitoring
    if monitoring is None:
        monitoring = MonitoringMiddleware(None)
    return monitoring

def record_llm_usage(provider: str, model: str, prompt_tokens: int, completion_tokens: int):
    """Record LLM usage metrics"""
    
    if monitoring and monitoring.registry:
        monitoring.prom_llm_requests.labels(provider=provider, model=model).inc()
        monitoring.prom_llm_tokens.labels(provider=provider, model=model, type="prompt").inc(prompt_tokens)
        monitoring.prom_llm_tokens.labels(provider=provider, model=model, type="completion").inc(completion_tokens)

def record_agent_session(session_type: str, status: str):
    """Record agent session metrics"""
    
    if monitoring and monitoring.registry:
        monitoring.prom_agent_sessions.labels(session_type=session_type, status=status).inc()

async def log_structured_event(event_type: str, data: Dict[str, Any], user_id: str = None):
    """Log structured event for monitoring and analytics"""
    
    event = {
        "timestamp": time.time(),
        "event_type": event_type,
        "data": data,
        "user_id": user_id
    }
    
    # Log as JSON for structured logging
    logger.info(json.dumps(event, default=str))

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request IDs for tracing"""
    
    async def dispatch(self, request: Request, call_next):
        import uuid
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response