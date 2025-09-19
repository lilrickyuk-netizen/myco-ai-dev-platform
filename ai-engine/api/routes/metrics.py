"""
Metrics endpoint for Prometheus scraping
"""
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from services.metrics import metrics_collector

router = APIRouter()

@router.get("/metrics", response_class=PlainTextResponse)
async def get_metrics():
    """
    Prometheus metrics endpoint
    Returns metrics in Prometheus exposition format
    """
    return metrics_collector.get_metrics()