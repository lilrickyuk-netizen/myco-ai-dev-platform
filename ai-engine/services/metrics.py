"""
Prometheus metrics for AI Engine service
"""
from prometheus_client import Counter, Histogram, Gauge, Info, CollectorRegistry, generate_latest
import time
from typing import Dict, Any, Optional
from functools import wraps
import logging

logger = logging.getLogger(__name__)

# Create a custom registry for our metrics
registry = CollectorRegistry()

# Application info
app_info = Info(
    'myco_ai_engine_app_info',
    'Application information',
    registry=registry
)
app_info.info({
    'version': '1.0.0',
    'service': 'ai-engine',
    'environment': 'production'
})

# HTTP request metrics
http_requests_total = Counter(
    'myco_ai_engine_http_requests_total',
    'Total number of HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=registry
)

http_request_duration_seconds = Histogram(
    'myco_ai_engine_http_request_duration_seconds',
    'Duration of HTTP requests in seconds',
    ['method', 'endpoint'],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registry=registry
)

# LLM request metrics
llm_requests_total = Counter(
    'myco_ai_engine_llm_requests_total',
    'Total number of LLM requests',
    ['provider', 'model', 'status'],
    registry=registry
)

llm_request_duration_seconds = Histogram(
    'myco_ai_engine_llm_request_duration_seconds',
    'Duration of LLM requests in seconds',
    ['provider', 'model'],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 20, 30, 60, 120],
    registry=registry
)

llm_tokens_used_total = Counter(
    'myco_ai_engine_llm_tokens_used_total',
    'Total number of tokens used',
    ['provider', 'model', 'type'],  # type: prompt, completion
    registry=registry
)

llm_cost_total = Counter(
    'myco_ai_engine_llm_cost_total',
    'Total cost of LLM usage in USD',
    ['provider', 'model'],
    registry=registry
)

# Agent metrics
agent_sessions_active = Gauge(
    'myco_ai_engine_agent_sessions_active',
    'Number of active agent sessions',
    ['agent_type'],
    registry=registry
)

agent_sessions_total = Counter(
    'myco_ai_engine_agent_sessions_total',
    'Total number of agent sessions created',
    ['agent_type'],
    registry=registry
)

agent_messages_total = Counter(
    'myco_ai_engine_agent_messages_total',
    'Total number of agent messages',
    ['agent_type', 'direction'],  # direction: incoming, outgoing
    registry=registry
)

# Error metrics
errors_total = Counter(
    'myco_ai_engine_errors_total',
    'Total number of errors',
    ['service', 'error_type', 'severity'],
    registry=registry
)

# Cache metrics
cache_operations_total = Counter(
    'myco_ai_engine_cache_operations_total',
    'Total number of cache operations',
    ['operation', 'result'],  # operation: get, set, delete; result: hit, miss, error
    registry=registry
)

cache_size_bytes = Gauge(
    'myco_ai_engine_cache_size_bytes',
    'Current cache size in bytes',
    registry=registry
)

# Provider health metrics
provider_health = Gauge(
    'myco_ai_engine_provider_health',
    'Health status of LLM providers (1 = healthy, 0 = unhealthy)',
    ['provider'],
    registry=registry
)

provider_rate_limit_remaining = Gauge(
    'myco_ai_engine_provider_rate_limit_remaining',
    'Remaining rate limit for LLM providers',
    ['provider'],
    registry=registry
)

# Business metrics
code_generations_total = Counter(
    'myco_ai_engine_code_generations_total',
    'Total number of code generations',
    ['language', 'framework'],
    registry=registry
)

code_lines_generated_total = Counter(
    'myco_ai_engine_code_lines_generated_total',
    'Total lines of code generated',
    ['language', 'framework'],
    registry=registry
)

chat_conversations_total = Counter(
    'myco_ai_engine_chat_conversations_total',
    'Total number of chat conversations',
    registry=registry
)

user_satisfaction_score = Histogram(
    'myco_ai_engine_user_satisfaction_score',
    'User satisfaction scores (1-5)',
    buckets=[1, 2, 3, 4, 5],
    registry=registry
)

# SLO metrics
slo_availability = Gauge(
    'myco_ai_engine_slo_availability',
    'Service availability percentage',
    registry=registry
)

slo_latency_p95_seconds = Gauge(
    'myco_ai_engine_slo_latency_p95_seconds',
    '95th percentile latency in seconds',
    ['endpoint'],
    registry=registry
)

slo_error_rate = Gauge(
    'myco_ai_engine_slo_error_rate',
    'Error rate percentage',
    registry=registry
)

slo_throughput_rps = Gauge(
    'myco_ai_engine_slo_throughput_rps',
    'Throughput in requests per second',
    registry=registry
)

# Resource utilization metrics
memory_usage_bytes = Gauge(
    'myco_ai_engine_memory_usage_bytes',
    'Memory usage in bytes',
    registry=registry
)

cpu_usage_percent = Gauge(
    'myco_ai_engine_cpu_usage_percent',
    'CPU usage percentage',
    registry=registry
)

# Vector store metrics (if using)
vector_store_operations_total = Counter(
    'myco_ai_engine_vector_store_operations_total',
    'Total number of vector store operations',
    ['operation', 'status'],  # operation: search, insert, update, delete
    registry=registry
)

vector_store_query_duration_seconds = Histogram(
    'myco_ai_engine_vector_store_query_duration_seconds',
    'Duration of vector store queries in seconds',
    ['operation'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registry=registry
)


class MetricsCollector:
    """Main metrics collector class"""
    
    def __init__(self):
        self.registry = registry
        # Initialize provider health as unknown
        self._init_provider_health()
    
    def _init_provider_health(self):
        """Initialize provider health metrics"""
        providers = ['openai', 'anthropic', 'google', 'cohere']
        for provider in providers:
            provider_health.labels(provider=provider).set(0)
    
    def record_http_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """Record HTTP request metrics"""
        try:
            http_requests_total.labels(
                method=method.upper(),
                endpoint=endpoint,
                status_code=str(status_code)
            ).inc()
            
            http_request_duration_seconds.labels(
                method=method.upper(),
                endpoint=endpoint
            ).observe(duration)
        except Exception as e:
            logger.error(f"Failed to record HTTP request metrics: {e}")
    
    def record_llm_request(self, provider: str, model: str, duration: float, 
                          prompt_tokens: int = 0, completion_tokens: int = 0, 
                          cost: float = 0, success: bool = True):
        """Record LLM request metrics"""
        try:
            status = 'success' if success else 'error'
            
            llm_requests_total.labels(
                provider=provider,
                model=model,
                status=status
            ).inc()
            
            llm_request_duration_seconds.labels(
                provider=provider,
                model=model
            ).observe(duration)
            
            if prompt_tokens > 0:
                llm_tokens_used_total.labels(
                    provider=provider,
                    model=model,
                    type='prompt'
                ).inc(prompt_tokens)
            
            if completion_tokens > 0:
                llm_tokens_used_total.labels(
                    provider=provider,
                    model=model,
                    type='completion'
                ).inc(completion_tokens)
            
            if cost > 0:
                llm_cost_total.labels(
                    provider=provider,
                    model=model
                ).inc(cost)
                
        except Exception as e:
            logger.error(f"Failed to record LLM request metrics: {e}")
    
    def record_agent_session(self, agent_type: str, created: bool = False):
        """Record agent session metrics"""
        try:
            if created:
                agent_sessions_total.labels(agent_type=agent_type).inc()
            
            # This would typically be called from the agent manager
            # to update active session count
        except Exception as e:
            logger.error(f"Failed to record agent session metrics: {e}")
    
    def record_agent_message(self, agent_type: str, direction: str):
        """Record agent message metrics"""
        try:
            agent_messages_total.labels(
                agent_type=agent_type,
                direction=direction
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record agent message metrics: {e}")
    
    def record_error(self, service: str, error_type: str, severity: str = 'medium'):
        """Record error metrics"""
        try:
            errors_total.labels(
                service=service,
                error_type=error_type,
                severity=severity
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record error metrics: {e}")
    
    def record_cache_operation(self, operation: str, result: str):
        """Record cache operation metrics"""
        try:
            cache_operations_total.labels(
                operation=operation,
                result=result
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record cache operation metrics: {e}")
    
    def update_provider_health(self, provider: str, is_healthy: bool):
        """Update provider health status"""
        try:
            provider_health.labels(provider=provider).set(1 if is_healthy else 0)
        except Exception as e:
            logger.error(f"Failed to update provider health metrics: {e}")
    
    def update_provider_rate_limit(self, provider: str, remaining: int):
        """Update provider rate limit remaining"""
        try:
            provider_rate_limit_remaining.labels(provider=provider).set(remaining)
        except Exception as e:
            logger.error(f"Failed to update provider rate limit metrics: {e}")
    
    def record_code_generation(self, language: str, framework: str, lines: int = 1):
        """Record code generation metrics"""
        try:
            code_generations_total.labels(
                language=language,
                framework=framework
            ).inc()
            
            code_lines_generated_total.labels(
                language=language,
                framework=framework
            ).inc(lines)
        except Exception as e:
            logger.error(f"Failed to record code generation metrics: {e}")
    
    def record_user_satisfaction(self, score: float):
        """Record user satisfaction score"""
        try:
            user_satisfaction_score.observe(score)
        except Exception as e:
            logger.error(f"Failed to record user satisfaction metrics: {e}")
    
    def update_slo_metrics(self, availability: float, latency_p95: float, 
                          error_rate: float, throughput: float):
        """Update SLO metrics"""
        try:
            slo_availability.set(availability)
            slo_error_rate.set(error_rate)
            slo_throughput_rps.set(throughput)
        except Exception as e:
            logger.error(f"Failed to update SLO metrics: {e}")
    
    def get_metrics(self) -> str:
        """Get all metrics in Prometheus format"""
        return generate_latest(self.registry)


# Global metrics collector instance
metrics_collector = MetricsCollector()


def track_http_request(func):
    """Decorator to track HTTP request metrics"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        status_code = 200
        
        try:
            result = await func(*args, **kwargs)
            return result
        except Exception as e:
            status_code = getattr(e, 'status_code', 500)
            raise
        finally:
            duration = time.time() - start_time
            # Extract endpoint from function name or args
            endpoint = getattr(func, '__name__', 'unknown')
            method = 'POST'  # Default for FastAPI endpoints
            
            metrics_collector.record_http_request(method, endpoint, status_code, duration)
    
    return wrapper


def track_llm_request(provider: str, model: str):
    """Decorator to track LLM request metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            
            try:
                result = await func(*args, **kwargs)
                
                # Extract token usage from result if available
                prompt_tokens = getattr(result, 'prompt_tokens', 0)
                completion_tokens = getattr(result, 'completion_tokens', 0)
                cost = getattr(result, 'cost', 0)
                
                return result
            except Exception:
                success = False
                prompt_tokens = completion_tokens = cost = 0
                raise
            finally:
                duration = time.time() - start_time
                metrics_collector.record_llm_request(
                    provider, model, duration, prompt_tokens, completion_tokens, cost, success
                )
        
        return wrapper
    return decorator


# Export the main functions and collector
__all__ = [
    'metrics_collector',
    'track_http_request',
    'track_llm_request',
    'registry'
]