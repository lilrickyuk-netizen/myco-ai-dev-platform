"""
Monitoring and metrics middleware for AI Engine
"""

import time
import asyncio
import logging
from typing import Dict, Any, Optional
from collections import defaultdict, deque
from dataclasses import dataclass, field
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
except ImportError:
    Counter = Histogram = Gauge = None
    generate_latest = None
    CONTENT_TYPE_LATEST = "text/plain"

from ..core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class RequestMetrics:
    """Request metrics data"""
    timestamp: float
    method: str
    path: str
    status_code: int
    response_time: float
    user_id: Optional[str] = None
    error: Optional[str] = None

@dataclass
class SystemMetrics:
    """System-level metrics"""
    timestamp: float
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    active_requests: int = 0
    total_requests: int = 0
    error_count: int = 0
    avg_response_time: float = 0.0

class MetricsCollector:
    """Collects and stores application metrics"""
    
    def __init__(self):
        self.request_metrics: deque = deque(maxlen=10000)
        self.system_metrics: deque = deque(maxlen=1000)
        self.active_requests = 0
        self.total_requests = 0
        self.error_count = 0
        self.response_times: deque = deque(maxlen=1000)
        
        # Per-endpoint metrics
        self.endpoint_metrics: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "count": 0,
            "errors": 0,
            "total_time": 0.0,
            "min_time": float('inf'),
            "max_time": 0.0
        })
        
        # User metrics
        self.user_metrics: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "requests": 0,
            "errors": 0,
            "total_time": 0.0
        })
        
        # Prometheus metrics (if available)
        if Counter and Histogram and Gauge:
            self.prometheus_metrics = {
                "request_count": Counter(
                    "ai_engine_requests_total",
                    "Total requests",
                    ["method", "endpoint", "status"]
                ),
                "request_duration": Histogram(
                    "ai_engine_request_duration_seconds",
                    "Request duration",
                    ["method", "endpoint"]
                ),
                "active_requests": Gauge(
                    "ai_engine_active_requests",
                    "Active requests"
                ),
                "llm_requests": Counter(
                    "ai_engine_llm_requests_total",
                    "LLM requests",
                    ["provider", "model"]
                ),
                "llm_tokens": Counter(
                    "ai_engine_llm_tokens_total",
                    "LLM tokens used",
                    ["provider", "model", "type"]
                ),
                "agent_sessions": Gauge(
                    "ai_engine_agent_sessions_active",
                    "Active agent sessions"
                ),
                "cache_hits": Counter(
                    "ai_engine_cache_hits_total",
                    "Cache hits",
                    ["cache_type"]
                ),
                "cache_misses": Counter(
                    "ai_engine_cache_misses_total",
                    "Cache misses",
                    ["cache_type"]
                )
            }
        else:
            self.prometheus_metrics = {}
    
    def record_request(self, metrics: RequestMetrics):
        """Record request metrics"""
        self.request_metrics.append(metrics)
        self.total_requests += 1
        self.response_times.append(metrics.response_time)
        
        # Update endpoint metrics
        endpoint_key = f"{metrics.method} {metrics.path}"
        endpoint_stats = self.endpoint_metrics[endpoint_key]
        endpoint_stats["count"] += 1
        endpoint_stats["total_time"] += metrics.response_time
        endpoint_stats["min_time"] = min(endpoint_stats["min_time"], metrics.response_time)
        endpoint_stats["max_time"] = max(endpoint_stats["max_time"], metrics.response_time)
        
        if metrics.status_code >= 400:
            self.error_count += 1
            endpoint_stats["errors"] += 1
        
        # Update user metrics
        if metrics.user_id:
            user_stats = self.user_metrics[metrics.user_id]
            user_stats["requests"] += 1
            user_stats["total_time"] += metrics.response_time
            
            if metrics.status_code >= 400:
                user_stats["errors"] += 1
        
        # Update Prometheus metrics
        if self.prometheus_metrics:
            self.prometheus_metrics["request_count"].labels(
                method=metrics.method,
                endpoint=metrics.path,
                status=str(metrics.status_code)
            ).inc()
            
            self.prometheus_metrics["request_duration"].labels(
                method=metrics.method,
                endpoint=metrics.path
            ).observe(metrics.response_time)
    
    def record_system_metrics(self, cpu_usage: float, memory_usage: float):
        """Record system metrics"""
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        
        system_metrics = SystemMetrics(
            timestamp=time.time(),
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            active_requests=self.active_requests,
            total_requests=self.total_requests,
            error_count=self.error_count,
            avg_response_time=avg_response_time
        )
        
        self.system_metrics.append(system_metrics)
        
        # Update Prometheus metrics
        if self.prometheus_metrics:
            self.prometheus_metrics["active_requests"].set(self.active_requests)
    
    def record_llm_usage(self, provider: str, model: str, tokens: Dict[str, int]):
        """Record LLM usage metrics"""
        if self.prometheus_metrics:
            self.prometheus_metrics["llm_requests"].labels(
                provider=provider,
                model=model
            ).inc()
            
            for token_type, count in tokens.items():
                self.prometheus_metrics["llm_tokens"].labels(
                    provider=provider,
                    model=model,
                    type=token_type
                ).inc(count)
    
    def record_cache_hit(self, cache_type: str):
        """Record cache hit"""
        if self.prometheus_metrics:
            self.prometheus_metrics["cache_hits"].labels(cache_type=cache_type).inc()
    
    def record_cache_miss(self, cache_type: str):
        """Record cache miss"""
        if self.prometheus_metrics:
            self.prometheus_metrics["cache_misses"].labels(cache_type=cache_type).inc()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary"""
        now = time.time()
        recent_requests = [
            m for m in self.request_metrics 
            if now - m.timestamp < 3600  # Last hour
        ]
        
        return {
            "total_requests": self.total_requests,
            "active_requests": self.active_requests,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(self.total_requests, 1),
            "avg_response_time": sum(self.response_times) / len(self.response_times) if self.response_times else 0,
            "requests_last_hour": len(recent_requests),
            "top_endpoints": self._get_top_endpoints(),
            "top_users": self._get_top_users()
        }
    
    def _get_top_endpoints(self, limit: int = 10) -> list:
        """Get top endpoints by request count"""
        sorted_endpoints = sorted(
            self.endpoint_metrics.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )
        
        return [
            {
                "endpoint": endpoint,
                "count": stats["count"],
                "errors": stats["errors"],
                "avg_time": stats["total_time"] / max(stats["count"], 1),
                "error_rate": stats["errors"] / max(stats["count"], 1)
            }
            for endpoint, stats in sorted_endpoints[:limit]
        ]
    
    def _get_top_users(self, limit: int = 10) -> list:
        """Get top users by request count"""
        sorted_users = sorted(
            self.user_metrics.items(),
            key=lambda x: x[1]["requests"],
            reverse=True
        )
        
        return [
            {
                "user_id": user_id,
                "requests": stats["requests"],
                "errors": stats["errors"],
                "avg_time": stats["total_time"] / max(stats["requests"], 1),
                "error_rate": stats["errors"] / max(stats["requests"], 1)
            }
            for user_id, stats in sorted_users[:limit]
        ]
    
    def get_prometheus_metrics(self) -> str:
        """Get Prometheus metrics"""
        if generate_latest:
            return generate_latest()
        else:
            return "# Prometheus client not installed"

class MonitoringMiddleware(BaseHTTPMiddleware):
    """Monitoring middleware to collect request metrics"""
    
    def __init__(self, app):
        super().__init__(app)
        self.metrics_collector = MetricsCollector()
    
    async def dispatch(self, request: Request, call_next):
        """Process request and collect metrics"""
        start_time = time.time()
        
        # Increment active requests
        self.metrics_collector.active_requests += 1
        
        # Extract user ID from request (simplified)
        user_id = self._extract_user_id(request)
        
        try:
            response = await call_next(request)
            status_code = response.status_code
            error = None
        except Exception as e:
            # Handle exceptions
            status_code = 500
            error = str(e)
            response = Response(
                content=f"Internal server error: {error}",
                status_code=500
            )
        
        # Calculate response time
        response_time = time.time() - start_time
        
        # Record metrics
        metrics = RequestMetrics(
            timestamp=time.time(),
            method=request.method,
            path=self._normalize_path(request.url.path),
            status_code=status_code,
            response_time=response_time,
            user_id=user_id,
            error=error
        )
        
        self.metrics_collector.record_request(metrics)
        
        # Decrement active requests
        self.metrics_collector.active_requests -= 1
        
        # Add monitoring headers
        response.headers["X-Response-Time"] = str(response_time)
        response.headers["X-Request-ID"] = str(hash(f"{request.method}{request.url}{start_time}") % 1000000)
        
        return response
    
    def _extract_user_id(self, request: Request) -> Optional[str]:
        """Extract user ID from request"""
        auth_header = request.headers.get("Authorization")
        if auth_header:
            # Simplified user ID extraction
            return f"user_{hash(auth_header) % 10000}"
        return None
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path for metrics (remove IDs)"""
        # Replace UUIDs and numeric IDs with placeholders
        import re
        
        # Replace UUIDs
        path = re.sub(
            r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            '/{id}',
            path
        )
        
        # Replace numeric IDs
        path = re.sub(r'/\d+', '/{id}', path)
        
        return path

class HealthChecker:
    """System health checker"""
    
    def __init__(self):
        self.start_time = time.time()
        self.health_checks = {}
    
    async def check_system_health(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        
        health = {
            "status": "healthy",
            "timestamp": time.time(),
            "uptime": time.time() - self.start_time,
            "checks": {}
        }
        
        # Check memory usage
        try:
            import psutil
            memory = psutil.virtual_memory()
            health["checks"]["memory"] = {
                "status": "healthy" if memory.percent < 90 else "warning",
                "usage_percent": memory.percent,
                "available_gb": memory.available / (1024**3)
            }
        except ImportError:
            health["checks"]["memory"] = {"status": "unknown", "error": "psutil not available"}
        
        # Check CPU usage
        try:
            import psutil
            cpu_percent = psutil.cpu_percent(interval=1)
            health["checks"]["cpu"] = {
                "status": "healthy" if cpu_percent < 80 else "warning",
                "usage_percent": cpu_percent
            }
        except ImportError:
            health["checks"]["cpu"] = {"status": "unknown", "error": "psutil not available"}
        
        # Check disk space
        try:
            import psutil
            disk = psutil.disk_usage('/')
            health["checks"]["disk"] = {
                "status": "healthy" if disk.percent < 90 else "warning",
                "usage_percent": disk.percent,
                "free_gb": disk.free / (1024**3)
            }
        except ImportError:
            health["checks"]["disk"] = {"status": "unknown", "error": "psutil not available"}
        
        # Determine overall status
        check_statuses = [check.get("status", "unknown") for check in health["checks"].values()]
        if "error" in check_statuses:
            health["status"] = "unhealthy"
        elif "warning" in check_statuses:
            health["status"] = "warning"
        
        return health

# Global instances
metrics_collector = MetricsCollector()
health_checker = HealthChecker()

async def periodic_system_monitoring():
    """Periodic system monitoring task"""
    
    while True:
        try:
            # Get system metrics
            try:
                import psutil
                cpu_usage = psutil.cpu_percent()
                memory_usage = psutil.virtual_memory().percent
                
                metrics_collector.record_system_metrics(cpu_usage, memory_usage)
            except ImportError:
                pass
            
            # Wait 30 seconds before next check
            await asyncio.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in periodic monitoring: {e}")
            await asyncio.sleep(30)

# Start monitoring task
if settings.ENABLE_METRICS:
    asyncio.create_task(periodic_system_monitoring())