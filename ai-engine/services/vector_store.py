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

# Vector store provider imports
try:
    import pinecone
except ImportError:
    pinecone = None

try:
    import openai
except ImportError:
    openai = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

@dataclass
class VectorDocument:
    """Represents a document in the vector store"""
    id: str
    content: str
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow()

@dataclass
class SearchResult:
    """Represents a search result from the vector store"""
    document: VectorDocument
    score: float
    distance: float

class VectorStoreManager:
    """
    Manages vector embeddings and semantic search capabilities
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.embedding_model = None
        self.embedding_dimension = None
        self.embedding_provider = None
        self.vector_provider = None
        self.storage = {}
        self.metadata_index = {}
        
        # Provider clients
        self.openai_client = None
        self.pinecone_index = None
        self.sentence_model = None
        self.memory_vectors = {}
    
    async def initialize(self):
        """Initialize the vector store"""
        self.logger.info("Initializing Vector Store Manager...")
        
        try:
            # Initialize real embedding model
            await self._initialize_embedding_model()
            
            # Initialize vector database
            await self._initialize_vector_database()
            
            # Load existing documents if any
            await self._load_existing_documents()
            
            self.logger.info("Vector Store Manager initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize Vector Store Manager: {e}")
            raise VectorStoreError(f"Initialization failed: {e}")
    
    async def _initialize_embedding_model(self):
        """Initialize the embedding model"""
        if settings.OPENAI_API_KEY:
            # Use OpenAI embeddings
            self.openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.embedding_model = "text-embedding-ada-002"
            self.embedding_dimension = 1536
            self.embedding_provider = "openai"
        elif SentenceTransformer:
            # Use local sentence transformers
            self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
            self.embedding_model = "all-MiniLM-L6-v2"
            self.embedding_dimension = 384
            self.embedding_provider = "sentence_transformers"
        else:
            raise VectorStoreError("No embedding model available. Install openai or sentence-transformers.")
    
    async def _initialize_vector_database(self):
        """Initialize vector database connection"""
        if settings.PINECONE_API_KEY and pinecone:
            # Initialize Pinecone
            pinecone.init(
                api_key=settings.PINECONE_API_KEY,
                environment=settings.PINECONE_ENVIRONMENT
            )
            
            # Create or connect to index
            index_name = settings.PINECONE_INDEX_NAME
            if index_name not in pinecone.list_indexes():
                pinecone.create_index(
                    name=index_name,
                    dimension=self.embedding_dimension,
                    metric="cosine"
                )
            
            self.pinecone_index = pinecone.Index(index_name)
            self.vector_provider = "pinecone"
        else:
            # Use in-memory vector store as fallback
            self.memory_vectors: Dict[str, Dict] = {}
            self.vector_provider = "memory"
    
    async def cleanup(self):
        """Cleanup the vector store"""
        self.logger.info("Shutting down Vector Store Manager...")
        # Cleanup any resources if needed
    
    async def add_document(
        self, 
        content: str, 
        metadata: Optional[Dict[str, Any]] = None,
        document_id: Optional[str] = None
    ) -> str:
        """Add a document to the vector store"""
        
        if document_id is None:
            document_id = self._generate_document_id(content)
        
        if metadata is None:
            metadata = {}
        
        try:
            # Generate embedding for the content
            embedding = await self._generate_embedding(content)
            
            # Create document
            document = VectorDocument(
                id=document_id,
                content=content,
                embedding=embedding,
                metadata=metadata
            )
            
            # Store the vector
            await self._store_vector(document_id, embedding, {
                **metadata,
                "content": content,
                "created_at": document.created_at.isoformat()
            })
            
            # Store document in local storage for quick access
            self.storage[document_id] = document
            
            # Update metadata index
            self._update_metadata_index(document_id, metadata)
            
            self.logger.info(f"Added document {document_id} to vector store")
            return document_id
            
        except Exception as e:
            self.logger.error(f"Failed to add document: {e}")
            raise VectorStoreError(f"Failed to add document: {e}")
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        try:
            if self.embedding_provider == "openai":
                response = await self.openai_client.embeddings.create(
                    model=self.embedding_model,
                    input=text
                )
                return response.data[0].embedding
            
            elif self.embedding_provider == "sentence_transformers":
                embedding = self.sentence_model.encode(text)
                return embedding.tolist()
            
            else:
                raise VectorStoreError(f"Unknown embedding provider: {self.embedding_provider}")
                
        except Exception as e:
            raise VectorStoreError(f"Failed to generate embedding: {e}")
    
    async def _store_vector(self, document_id: str, vector: List[float], metadata: Dict[str, Any]):
        """Store vector in the vector database"""
        try:
            if self.vector_provider == "pinecone":
                # Store in Pinecone
                self.pinecone_index.upsert(
                    vectors=[
                        {
                            "id": document_id,
                            "values": vector,
                            "metadata": metadata
                        }
                    ]
                )
            
            elif self.vector_provider == "memory":
                # Store in memory
                self.memory_vectors[document_id] = {
                    "vector": vector,
                    "metadata": metadata,
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            self.logger.info(f"Stored vector for document {document_id}")
            
        except Exception as e:
            raise VectorStoreError(f"Failed to store vector: {e}")
    
    async def search(
        self, 
        query: str, 
        limit: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        """Search for similar documents"""
        
        try:
            # Generate embedding for the query
            query_embedding = await self._generate_embedding(query)
            
            # Search for similar vectors
            raw_results = await self._search_vectors(query_embedding, limit, filter_metadata)
            
            # Convert to SearchResult objects
            results = []
            for result in raw_results:
                if result["score"] >= min_score:
                    # Get document from storage or reconstruct from metadata
                    document_id = result["id"]
                    if document_id in self.storage:
                        document = self.storage[document_id]
                    else:
                        # Reconstruct document from metadata
                        document = VectorDocument(
                            id=document_id,
                            content=result["metadata"].get("content", ""),
                            metadata=result["metadata"]
                        )
                    
                    search_result = SearchResult(
                        document=document,
                        score=result["score"],
                        distance=1.0 - result["score"]  # Convert similarity to distance
                    )
                    results.append(search_result)
            
            self.logger.info(f"Found {len(results)} results for query: {query[:50]}...")
            return results
            
        except Exception as e:
            self.logger.error(f"Search failed: {e}")
            raise VectorStoreError(f"Search failed: {e}")
    
    async def _search_vectors(self, query_vector: List[float], limit: int = 10, filter_metadata: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Search for similar vectors"""
        try:
            if self.vector_provider == "pinecone":
                # Search in Pinecone
                search_results = self.pinecone_index.query(
                    vector=query_vector,
                    top_k=limit,
                    include_metadata=True,
                    filter=filter_metadata
                )
                
                results = []
                for match in search_results.matches:
                    results.append({
                        "id": match.id,
                        "score": match.score,
                        "metadata": match.metadata
                    })
                
                return results
            
            elif self.vector_provider == "memory":
                # Search in memory using cosine similarity
                results = []
                
                for doc_id, doc_data in self.memory_vectors.items():
                    if filter_metadata:
                        # Apply metadata filtering
                        if not all(doc_data["metadata"].get(k) == v for k, v in filter_metadata.items()):
                            continue
                    
                    # Calculate cosine similarity
                    doc_vector = np.array(doc_data["vector"])
                    query_array = np.array(query_vector)
                    
                    similarity = np.dot(doc_vector, query_array) / (np.linalg.norm(doc_vector) * np.linalg.norm(query_array))
                    
                    results.append({
                        "id": doc_id,
                        "score": float(similarity),
                        "metadata": doc_data["metadata"]
                    })
                
                # Sort by similarity score (descending)
                results.sort(key=lambda x: x["score"], reverse=True)
                
                return results[:limit]
            
        except Exception as e:
            raise VectorStoreError(f"Failed to search vectors: {e}")
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete a document from the vector store"""
        try:
            if self.vector_provider == "pinecone":
                self.pinecone_index.delete(ids=[document_id])
            elif self.vector_provider == "memory":
                if document_id in self.memory_vectors:
                    del self.memory_vectors[document_id]
            
            # Remove from local storage
            if document_id in self.storage:
                del self.storage[document_id]
            
            # Update metadata index
            self._remove_from_metadata_index(document_id)
            
            self.logger.info(f"Deleted document {document_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to delete document {document_id}: {e}")
            return False
    
    async def get_document(self, document_id: str) -> Optional[VectorDocument]:
        """Get a document by ID"""
        return self.storage.get(document_id)
    
    async def list_documents(
        self, 
        filter_metadata: Optional[Dict[str, Any]] = None,
        limit: int = 100
    ) -> List[VectorDocument]:
        """List documents with optional filtering"""
        documents = []
        count = 0
        
        for doc_id, document in self.storage.items():
            if count >= limit:
                break
                
            if filter_metadata:
                if not all(document.metadata.get(k) == v for k, v in filter_metadata.items()):
                    continue
            
            documents.append(document)
            count += 1
        
        return documents
    
    def _generate_document_id(self, content: str) -> str:
        """Generate a unique document ID"""
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        return f"doc_{timestamp}_{content_hash}"
    
    def _update_metadata_index(self, document_id: str, metadata: Dict[str, Any]):
        """Update metadata index for fast filtering"""
        for key, value in metadata.items():
            if key not in self.metadata_index:
                self.metadata_index[key] = {}
            if value not in self.metadata_index[key]:
                self.metadata_index[key][value] = set()
            self.metadata_index[key][value].add(document_id)
    
    def _remove_from_metadata_index(self, document_id: str):
        """Remove document from metadata index"""
        for key_dict in self.metadata_index.values():
            for doc_set in key_dict.values():
                doc_set.discard(document_id)
    
    async def _load_existing_documents(self):
        """Load existing documents from persistent storage"""
        # In a real implementation, this would load documents from a persistent store
        # For now, we start with an empty store
        pass
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics"""
        return {
            "total_documents": len(self.storage),
            "embedding_model": self.embedding_model,
            "embedding_dimension": self.embedding_dimension,
            "vector_provider": self.vector_provider,
            "embedding_provider": self.embedding_provider
        }

# Global vector store manager instance
vector_store_manager = VectorStoreManager()