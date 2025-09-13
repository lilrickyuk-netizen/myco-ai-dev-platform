"""
Vector Store Manager - Handles vector embeddings and semantic search
"""

import asyncio
import logging
import os
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import hashlib
import json

try:
    import weaviate
    from weaviate.client import Client as WeaviateClient
    WEAVIATE_AVAILABLE = True
except ImportError:
    weaviate = None
    WeaviateClient = None
    WEAVIATE_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    openai = None
    OPENAI_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    np = None
    NUMPY_AVAILABLE = False

from .cache_manager import cache_manager

logger = logging.getLogger(__name__)

class VectorStoreManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.weaviate_client: Optional[WeaviateClient] = None
        self.embedding_client = None
        self.schema_created = False
        self.embedding_cache = {}
        self.default_class_name = "CodeDocument"
        
        # Fallback in-memory vector store for when Weaviate is not available
        self.memory_store: Dict[str, Dict[str, Any]] = {}
        self.memory_embeddings: Dict[str, List[float]] = {}
    
    async def initialize(self):
        """Initialize the vector store manager"""
        self.logger.info("Initializing Vector Store Manager...")
        
        # Initialize embedding provider
        await self._initialize_embedding_provider()
        
        # Try to connect to Weaviate
        if WEAVIATE_AVAILABLE:
            weaviate_url = os.getenv("WEAVIATE_URL", "http://localhost:8080")
            try:
                self.weaviate_client = weaviate.Client(url=weaviate_url)
                
                # Test connection
                result = self.weaviate_client.schema.get()
                self.logger.info(f"Connected to Weaviate at {weaviate_url}")
                
                # Create schema if needed
                await self._ensure_schema()
                
            except Exception as e:
                self.logger.warning(f"Could not connect to Weaviate: {e}. Using memory store.")
                self.weaviate_client = None
        else:
            self.logger.warning("Weaviate not available. Using memory store only.")
        
        self.logger.info("Vector Store Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.logger.info("Cleaning up Vector Store Manager...")
        
        # Clear memory stores
        self.memory_store.clear()
        self.memory_embeddings.clear()
        self.embedding_cache.clear()
        
        self.logger.info("Vector Store Manager cleanup complete")
    
    async def _initialize_embedding_provider(self):
        """Initialize the embedding provider"""
        # Try OpenAI first
        if OPENAI_AVAILABLE and os.getenv("OPENAI_API_KEY"):
            self.embedding_client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            self.embedding_model = "text-embedding-3-small"
            self.embedding_dimension = 1536
            self.logger.info("Using OpenAI embeddings")
        else:
            # Fallback to simple TF-IDF-like embeddings
            self.embedding_client = None
            self.embedding_model = "simple_tfidf"
            self.embedding_dimension = 384
            self.logger.warning("No embedding provider available. Using simple embeddings.")
    
    async def _ensure_schema(self):
        """Ensure the Weaviate schema exists"""
        if not self.weaviate_client or self.schema_created:
            return
        
        try:
            # Check if class already exists
            schema = self.weaviate_client.schema.get()
            existing_classes = [cls["class"] for cls in schema.get("classes", [])]
            
            if self.default_class_name not in existing_classes:
                # Create the schema
                class_obj = {
                    "class": self.default_class_name,
                    "description": "Code documents and text for semantic search",
                    "vectorizer": "none",  # We'll provide our own vectors
                    "properties": [
                        {
                            "name": "content",
                            "dataType": ["text"],
                            "description": "The document content"
                        },
                        {
                            "name": "document_type",
                            "dataType": ["string"],
                            "description": "Type of document (code, documentation, etc.)"
                        },
                        {
                            "name": "language",
                            "dataType": ["string"],
                            "description": "Programming language or content language"
                        },
                        {
                            "name": "file_path",
                            "dataType": ["string"],
                            "description": "File path or identifier"
                        },
                        {
                            "name": "project_id",
                            "dataType": ["string"],
                            "description": "Project identifier"
                        },
                        {
                            "name": "metadata",
                            "dataType": ["object"],
                            "description": "Additional metadata"
                        },
                        {
                            "name": "timestamp",
                            "dataType": ["date"],
                            "description": "Creation timestamp"
                        }
                    ]
                }
                
                self.weaviate_client.schema.create_class(class_obj)
                self.logger.info(f"Created Weaviate class: {self.default_class_name}")
            
            self.schema_created = True
        
        except Exception as e:
            self.logger.error(f"Error creating Weaviate schema: {e}")
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        # Check cache first
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if text_hash in self.embedding_cache:
            return self.embedding_cache[text_hash]
        
        try:
            if self.embedding_client:
                # Use OpenAI embeddings
                response = await self.embedding_client.embeddings.create(
                    model=self.embedding_model,
                    input=text
                )
                embedding = response.data[0].embedding
            else:
                # Fallback to simple embeddings
                embedding = self._simple_embedding(text)
            
            # Cache the embedding
            self.embedding_cache[text_hash] = embedding
            
            return embedding
        
        except Exception as e:
            self.logger.error(f"Error generating embedding: {e}")
            # Return a zero vector as fallback
            return [0.0] * self.embedding_dimension
    
    def _simple_embedding(self, text: str) -> List[float]:
        """Generate a simple TF-IDF-like embedding"""
        # This is a very basic implementation for fallback
        words = text.lower().split()
        
        # Create a simple vocabulary-based embedding
        vocab_size = 1000
        embedding = [0.0] * self.embedding_dimension
        
        for i, word in enumerate(words):
            if i >= len(embedding):
                break
            
            # Simple hash-based position
            word_hash = hash(word) % len(embedding)
            embedding[word_hash] += 1.0 / len(words)
        
        # Normalize
        norm = sum(x * x for x in embedding) ** 0.5
        if norm > 0:
            embedding = [x / norm for x in embedding]
        
        return embedding
    
    async def add_document(
        self,
        content: str,
        document_type: str = "code",
        language: str = "unknown",
        file_path: str = "",
        project_id: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Add a document to the vector store"""
        try:
            # Generate embedding
            embedding = await self._generate_embedding(content)
            
            # Create document data
            doc_data = {
                "content": content,
                "document_type": document_type,
                "language": language,
                "file_path": file_path,
                "project_id": project_id,
                "metadata": metadata or {},
                "timestamp": datetime.now().isoformat()
            }
            
            document_id = hashlib.md5(f"{content}{file_path}{project_id}".encode()).hexdigest()
            
            # Store in Weaviate if available
            if self.weaviate_client:
                try:
                    result = self.weaviate_client.data_object.create(
                        data_object=doc_data,
                        class_name=self.default_class_name,
                        uuid=document_id,
                        vector=embedding
                    )
                    self.logger.debug(f"Added document to Weaviate: {document_id}")
                except Exception as e:
                    self.logger.warning(f"Error adding to Weaviate: {e}")
                    # Fall back to memory store
                    self.memory_store[document_id] = doc_data
                    self.memory_embeddings[document_id] = embedding
            else:
                # Use memory store
                self.memory_store[document_id] = doc_data
                self.memory_embeddings[document_id] = embedding
            
            return document_id
        
        except Exception as e:
            self.logger.error(f"Error adding document: {e}")
            raise
    
    async def search_documents(
        self,
        query: str,
        limit: int = 10,
        filter_conditions: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar documents"""
        try:
            # Generate query embedding
            query_embedding = await self._generate_embedding(query)
            
            # Search in Weaviate if available
            if self.weaviate_client:
                try:
                    return await self._search_weaviate(
                        query_embedding, query, limit, filter_conditions, project_id
                    )
                except Exception as e:
                    self.logger.warning(f"Weaviate search error: {e}")
            
            # Fallback to memory search
            return await self._search_memory(
                query_embedding, query, limit, filter_conditions, project_id
            )
        
        except Exception as e:
            self.logger.error(f"Error searching documents: {e}")
            return []
    
    async def _search_weaviate(
        self,
        query_embedding: List[float],
        query_text: str,
        limit: int,
        filter_conditions: Optional[Dict[str, Any]],
        project_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Search using Weaviate"""
        where_filter = {}
        
        # Build filter
        if project_id:
            where_filter["path"] = ["project_id"]
            where_filter["operator"] = "Equal"
            where_filter["valueString"] = project_id
        
        if filter_conditions:
            # Add additional filters (simplified implementation)
            for key, value in filter_conditions.items():
                if isinstance(value, str):
                    where_filter = {
                        "operator": "And",
                        "operands": [
                            where_filter,
                            {
                                "path": [key],
                                "operator": "Equal",
                                "valueString": value
                            }
                        ]
                    }
        
        # Perform search
        result = (
            self.weaviate_client.query
            .get(self.default_class_name, [
                "content", "document_type", "language", 
                "file_path", "project_id", "metadata", "timestamp"
            ])
            .with_near_vector({"vector": query_embedding})
            .with_limit(limit)
            .with_additional(["certainty", "distance"])
        )
        
        if where_filter:
            result = result.with_where(where_filter)
        
        response = result.do()
        
        # Parse results
        documents = []
        if "data" in response and "Get" in response["data"]:
            for item in response["data"]["Get"][self.default_class_name]:
                documents.append({
                    "content": item["content"],
                    "document_type": item["document_type"],
                    "language": item["language"],
                    "file_path": item["file_path"],
                    "project_id": item["project_id"],
                    "metadata": item["metadata"],
                    "timestamp": item["timestamp"],
                    "score": item["_additional"]["certainty"],
                    "distance": item["_additional"]["distance"]
                })
        
        return documents
    
    async def _search_memory(
        self,
        query_embedding: List[float],
        query_text: str,
        limit: int,
        filter_conditions: Optional[Dict[str, Any]],
        project_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Search using in-memory store"""
        if not NUMPY_AVAILABLE:
            # Fallback to text search
            return self._text_search_memory(query_text, limit, filter_conditions, project_id)
        
        results = []
        
        for doc_id, doc_data in self.memory_store.items():
            # Apply filters
            if project_id and doc_data.get("project_id") != project_id:
                continue
            
            if filter_conditions:
                skip = False
                for key, value in filter_conditions.items():
                    if doc_data.get(key) != value:
                        skip = True
                        break
                if skip:
                    continue
            
            # Calculate similarity
            doc_embedding = self.memory_embeddings.get(doc_id, [])
            if doc_embedding:
                similarity = self._cosine_similarity(query_embedding, doc_embedding)
                
                result = doc_data.copy()
                result["score"] = similarity
                result["distance"] = 1.0 - similarity
                results.append(result)
        
        # Sort by similarity and limit
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _text_search_memory(
        self,
        query_text: str,
        limit: int,
        filter_conditions: Optional[Dict[str, Any]],
        project_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Fallback text search for memory store"""
        results = []
        query_words = set(query_text.lower().split())
        
        for doc_id, doc_data in self.memory_store.items():
            # Apply filters
            if project_id and doc_data.get("project_id") != project_id:
                continue
            
            if filter_conditions:
                skip = False
                for key, value in filter_conditions.items():
                    if doc_data.get(key) != value:
                        skip = True
                        break
                if skip:
                    continue
            
            # Simple text matching
            content_words = set(doc_data["content"].lower().split())
            common_words = query_words.intersection(content_words)
            
            if common_words:
                score = len(common_words) / len(query_words.union(content_words))
                
                result = doc_data.copy()
                result["score"] = score
                result["distance"] = 1.0 - score
                results.append(result)
        
        # Sort by similarity and limit
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        if not NUMPY_AVAILABLE:
            # Manual calculation
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            magnitude1 = sum(a * a for a in vec1) ** 0.5
            magnitude2 = sum(b * b for b in vec2) ** 0.5
            
            if magnitude1 == 0 or magnitude2 == 0:
                return 0.0
            
            return dot_product / (magnitude1 * magnitude2)
        else:
            # Use numpy
            vec1_np = np.array(vec1)
            vec2_np = np.array(vec2)
            
            dot_product = np.dot(vec1_np, vec2_np)
            norms = np.linalg.norm(vec1_np) * np.linalg.norm(vec2_np)
            
            if norms == 0:
                return 0.0
            
            return dot_product / norms
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete a document from the vector store"""
        try:
            deleted = False
            
            # Delete from Weaviate if available
            if self.weaviate_client:
                try:
                    self.weaviate_client.data_object.delete(
                        uuid=document_id,
                        class_name=self.default_class_name
                    )
                    deleted = True
                except Exception as e:
                    self.logger.warning(f"Error deleting from Weaviate: {e}")
            
            # Delete from memory store
            if document_id in self.memory_store:
                del self.memory_store[document_id]
                deleted = True
            
            if document_id in self.memory_embeddings:
                del self.memory_embeddings[document_id]
            
            return deleted
        
        except Exception as e:
            self.logger.error(f"Error deleting document {document_id}: {e}")
            return False
    
    async def get_document_count(self, project_id: Optional[str] = None) -> int:
        """Get count of documents in the store"""
        try:
            # Count in Weaviate if available
            if self.weaviate_client:
                try:
                    query = self.weaviate_client.query.aggregate(self.default_class_name)
                    
                    if project_id:
                        query = query.with_where({
                            "path": ["project_id"],
                            "operator": "Equal",
                            "valueString": project_id
                        })
                    
                    result = query.with_meta_count().do()
                    
                    if "data" in result and "Aggregate" in result["data"]:
                        return result["data"]["Aggregate"][self.default_class_name][0]["meta"]["count"]
                except Exception as e:
                    self.logger.warning(f"Error counting Weaviate documents: {e}")
            
            # Count in memory store
            if project_id:
                return sum(
                    1 for doc in self.memory_store.values()
                    if doc.get("project_id") == project_id
                )
            else:
                return len(self.memory_store)
        
        except Exception as e:
            self.logger.error(f"Error counting documents: {e}")
            return 0
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of the vector store manager"""
        try:
            # Test basic operations
            test_content = f"Health check test document {time.time()}"
            
            # Test add
            doc_id = await self.add_document(
                content=test_content,
                document_type="test",
                project_id="health_check"
            )
            
            # Test search
            search_results = await self.search_documents(
                query="health check test",
                limit=1,
                project_id="health_check"
            )
            
            # Test delete
            delete_success = await self.delete_document(doc_id)
            
            weaviate_status = "healthy" if self.weaviate_client else "not_available"
            embedding_provider = "openai" if self.embedding_client else "simple_tfidf"
            
            return {
                "status": "healthy",
                "weaviate_status": weaviate_status,
                "embedding_provider": embedding_provider,
                "memory_store_size": len(self.memory_store),
                "cache_size": len(self.embedding_cache),
                "operations": {
                    "add": bool(doc_id),
                    "search": len(search_results) > 0,
                    "delete": delete_success
                },
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Global instance
vector_store_manager = VectorStoreManager()