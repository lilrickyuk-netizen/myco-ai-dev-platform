#!/usr/bin/env python3
"""
AI Engine entrypoint with uvicorn support
"""

import uvicorn
import logging
import sys
from pathlib import Path

# Add the ai-engine directory to Python path
ai_engine_dir = Path(__file__).parent
sys.path.insert(0, str(ai_engine_dir))

from main import app
from core.config import settings

def main():
    """Main entrypoint for the AI Engine"""
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('ai-engine.log') if not settings.DEBUG else logging.NullHandler()
        ]
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"Starting AI Engine on {settings.HOST}:{settings.PORT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Workers: {settings.WORKERS}")
    
    # Run the server
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS if not settings.DEBUG else 1,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
        reload_dirs=[str(ai_engine_dir)] if settings.DEBUG else None
    )

if __name__ == "__main__":
    main()