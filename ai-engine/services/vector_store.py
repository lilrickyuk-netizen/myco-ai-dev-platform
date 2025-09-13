"""
Vector store service for embeddings and semantic search
"""

import logging
import asyncio
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import json
import hashlib
from dataclasses import dataclass
from datetime import datetime

from ..core.config import settings
from ..core.exceptions import VectorStoreError

@dataclass
class Document:
    """Document with metadata"""
    id: str
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None
    created_at: Optional[datetime] = None

@dataclass
class SearchResult:
    """Search result with similarity score"""
    document: Document
    score: float

class VectorStoreManager:
    """Manages vector embeddings and semantic search"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.documents: Dict[str, Document] = {}
        self.index_built = False
        self.embedding_model = None
        
    async def initialize(self):
        """Initialize the vector store"""
        self.logger.info("Initializing Vector Store Manager...")
        
        try:
            # Initialize embedding model (mock for now)
            await self._initialize_embedding_model()
            
            # Load existing documents if any
            await self._load_existing_documents()
            
            self.logger.info("Vector Store Manager initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize Vector Store Manager: {e}")
            raise VectorStoreError(f"Initialization failed: {e}")
    
    async def cleanup(self):
        """Cleanup the vector store"""
        self.logger.info("Shutting down Vector Store Manager...")
        
        # Save documents if needed
        await self._save_documents()
        
        self.logger.info("Vector Store Manager shutdown complete")
    
    async def _initialize_embedding_model(self):
        """Initialize the embedding model"""
        
        # For now, use a mock embedding model
        # In production, this would initialize sentence-transformers, OpenAI embeddings, etc.
        self.embedding_model = MockEmbeddingModel()
        self.logger.info("Mock embedding model initialized")
    
    async def _load_existing_documents(self):
        """Load existing documents from storage"""
        
        # Mock implementation - in production this would load from a database
        # or vector database like Pinecone, Weaviate, Chroma, etc.
        pass
    
    async def _save_documents(self):
        """Save documents to persistent storage"""
        
        # Mock implementation - in production this would save to a database
        pass
    
    async def add_document(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None
    ) -> str:
        """Add a document to the vector store"""
        
        if not doc_id:
            # Generate document ID based on content hash
            doc_id = hashlib.sha256(content.encode()).hexdigest()[:16]
        
        if not metadata:
            metadata = {}
        
        # Generate embedding
        try:
            embedding = await self._generate_embedding(content)
        except Exception as e:
            raise VectorStoreError(f"Failed to generate embedding: {e}")
        
        # Create document
        document = Document(
            id=doc_id,
            content=content,
            metadata=metadata,
            embedding=embedding,
            created_at=datetime.utcnow()
        )
        
        # Store document
        self.documents[doc_id] = document
        
        # Mark index as needing rebuild
        self.index_built = False
        
        self.logger.info(f"Added document {doc_id} to vector store")
        return doc_id
    
    async def add_documents(
        self,
        documents: List[Dict[str, Any]]
    ) -> List[str]:
        """Add multiple documents to the vector store"""
        
        doc_ids = []
        
        for doc_data in documents:
            content = doc_data.get("content", "")
            metadata = doc_data.get("metadata", {})
            doc_id = doc_data.get("id")
            
            if content:
                doc_id = await self.add_document(content, metadata, doc_id)
                doc_ids.append(doc_id)
        
        return doc_ids
    
    async def search(
        self,
        query: str,
        limit: int = 10,
        metadata_filter: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        """Search for similar documents"""
        
        try:
            # Generate query embedding
            query_embedding = await self._generate_embedding(query)
            
            # Calculate similarities
            results = []
            
            for doc in self.documents.values():
                # Apply metadata filter if specified
                if metadata_filter and not self._matches_filter(doc.metadata, metadata_filter):
                    continue
                
                # Calculate similarity
                if doc.embedding:
                    similarity = self._calculate_similarity(query_embedding, doc.embedding)
                    
                    if similarity >= min_score:
                        results.append(SearchResult(
                            document=doc,
                            score=similarity
                        ))
            
            # Sort by similarity score (descending)
            results.sort(key=lambda x: x.score, reverse=True)
            
            # Return top results
            return results[:limit]
            
        except Exception as e:
            raise VectorStoreError(f"Search failed: {e}")
    
    async def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID"""
        return self.documents.get(doc_id)
    
    async def delete_document(self, doc_id: str) -> bool:
        """Delete a document"""
        
        if doc_id in self.documents:
            del self.documents[doc_id]
            self.index_built = False
            self.logger.info(f"Deleted document {doc_id}")
            return True
        
        return False
    
    async def update_document(
        self,
        doc_id: str,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update a document"""
        
        if doc_id not in self.documents:
            return False
        
        document = self.documents[doc_id]
        
        # Update content and regenerate embedding if needed
        if content is not None:
            document.content = content
            document.embedding = await self._generate_embedding(content)
        
        # Update metadata
        if metadata is not None:
            document.metadata.update(metadata)
        
        self.index_built = False
        self.logger.info(f"Updated document {doc_id}")
        return True
    
    async def list_documents(
        self,
        metadata_filter: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Document]:
        """List documents with optional filtering"""
        
        documents = list(self.documents.values())
        
        # Apply metadata filter
        if metadata_filter:
            documents = [
                doc for doc in documents 
                if self._matches_filter(doc.metadata, metadata_filter)
            ]
        
        # Apply pagination
        start = offset
        end = offset + limit
        
        return documents[start:end]
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics"""
        
        return {\n            \"total_documents\": len(self.documents),\n            \"index_built\": self.index_built,\n            \"embedding_model\": type(self.embedding_model).__name__ if self.embedding_model else None,\n            \"storage_type\": \"in_memory\",\n            \"created_at\": datetime.utcnow().isoformat()\n        }\n    \n    async def _generate_embedding(self, text: str) -> List[float]:\n        \"\"\"Generate embedding for text\"\"\"\n        \n        if not self.embedding_model:\n            raise VectorStoreError(\"Embedding model not initialized\")\n        \n        return await self.embedding_model.encode(text)\n    \n    def _calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:\n        \"\"\"Calculate cosine similarity between two embeddings\"\"\"\n        \n        # Convert to numpy arrays\n        vec1 = np.array(embedding1)\n        vec2 = np.array(embedding2)\n        \n        # Calculate cosine similarity\n        dot_product = np.dot(vec1, vec2)\n        norm1 = np.linalg.norm(vec1)\n        norm2 = np.linalg.norm(vec2)\n        \n        if norm1 == 0 or norm2 == 0:\n            return 0.0\n        \n        return dot_product / (norm1 * norm2)\n    \n    def _matches_filter(self, metadata: Dict[str, Any], filter_dict: Dict[str, Any]) -> bool:\n        \"\"\"Check if document metadata matches filter\"\"\"\n        \n        for key, value in filter_dict.items():\n            if key not in metadata or metadata[key] != value:\n                return False\n        \n        return True\n\nclass MockEmbeddingModel:\n    \"\"\"Mock embedding model for testing\"\"\"\n    \n    def __init__(self, dimension: int = 384):\n        self.dimension = dimension\n    \n    async def encode(self, text: str) -> List[float]:\n        \"\"\"Generate mock embedding for text\"\"\"\n        \n        # Generate deterministic \"embedding\" based on text hash\n        hash_value = hashlib.sha256(text.encode()).hexdigest()\n        \n        # Convert hash to numbers and normalize\n        embedding = []\n        for i in range(0, min(len(hash_value), self.dimension * 2), 2):\n            hex_pair = hash_value[i:i+2]\n            value = int(hex_pair, 16) / 255.0  # Normalize to 0-1\n            embedding.append(value)\n        \n        # Pad or truncate to desired dimension\n        while len(embedding) < self.dimension:\n            embedding.append(0.0)\n        \n        embedding = embedding[:self.dimension]\n        \n        # Normalize to unit vector\n        norm = np.linalg.norm(embedding)\n        if norm > 0:\n            embedding = (np.array(embedding) / norm).tolist()\n        \n        return embedding\n\n# Global vector store manager instance\nvector_store_manager = VectorStoreManager()