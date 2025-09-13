"""
Vector store service for embeddings and semantic search
"""

import asyncio
import logging
import numpy as np
import json
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import hashlib

try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    chromadb = None

try:
    import openai
except ImportError:
    openai = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

logger = logging.getLogger(__name__)

@dataclass
class Document:
    id: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class SearchResult:
    document: Document
    score: float
    rank: int

class EmbeddingProvider:
    """Base class for embedding providers"""
    
    async def get_embedding(self, text: str) -> List[float]:
        raise NotImplementedError
    
    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts"""
        embeddings = []
        for text in texts:
            embedding = await self.get_embedding(text)
            embeddings.append(embedding)
        return embeddings

class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider"""
    
    def __init__(self, api_key: str, model: str = "text-embedding-ada-002"):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text"""
        response = await self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding
    
    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts"""
        response = await self.client.embeddings.create(
            input=texts,
            model=self.model
        )
        return [item.embedding for item in response.data]

class LocalEmbeddingProvider(EmbeddingProvider):
    """Local sentence transformer embedding provider"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        if SentenceTransformer is None:
            raise ImportError("sentence-transformers not installed")
        
        self.model = SentenceTransformer(model_name)
        logger.info(f"Loaded local embedding model: {model_name}")
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text"""
        # Run in thread to avoid blocking
        embedding = await asyncio.to_thread(self.model.encode, text)
        return embedding.tolist()
    
    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts"""
        embeddings = await asyncio.to_thread(self.model.encode, texts)
        return embeddings.tolist()

class InMemoryVectorStore:
    """Simple in-memory vector store implementation"""
    
    def __init__(self):
        self.documents: Dict[str, Document] = {}
        self.embeddings: Dict[str, np.ndarray] = {}
    
    async def add_document(self, document: Document):
        """Add a document to the store"""
        self.documents[document.id] = document
        if document.embedding:
            self.embeddings[document.id] = np.array(document.embedding)
    
    async def add_documents(self, documents: List[Document]):
        """Add multiple documents to the store"""
        for doc in documents:
            await self.add_document(doc)
    
    async def search(self, query_embedding: List[float], limit: int = 10) -> List[SearchResult]:
        """Search for similar documents"""
        if not self.embeddings:
            return []
        
        query_vector = np.array(query_embedding)
        scores = {}
        
        # Calculate cosine similarity
        for doc_id, doc_embedding in self.embeddings.items():
            # Cosine similarity
            similarity = np.dot(query_vector, doc_embedding) / (
                np.linalg.norm(query_vector) * np.linalg.norm(doc_embedding)
            )
            scores[doc_id] = similarity
        
        # Sort by score (descending)
        sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        # Create search results
        results = []
        for rank, (doc_id, score) in enumerate(sorted_results[:limit]):
            if doc_id in self.documents:
                results.append(SearchResult(
                    document=self.documents[doc_id],
                    score=float(score),
                    rank=rank + 1
                ))
        
        return results
    
    async def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID"""
        return self.documents.get(document_id)
    
    async def delete_document(self, document_id: str):
        """Delete a document"""
        if document_id in self.documents:
            del self.documents[document_id]
        if document_id in self.embeddings:
            del self.embeddings[document_id]
    
    async def list_documents(self, limit: int = 100, offset: int = 0) -> List[Document]:
        """List documents with pagination"""
        docs = list(self.documents.values())
        return docs[offset:offset + limit]

class ChromaVectorStore:
    """ChromaDB vector store implementation"""
    
    def __init__(self, collection_name: str = "myco_documents", persist_directory: str = "./chroma_db"):
        if chromadb is None:
            raise ImportError("chromadb not installed")
        
        self.collection_name = collection_name
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"Initialized ChromaDB collection: {collection_name}")
    
    async def add_document(self, document: Document):
        """Add a document to the store"""
        if not document.embedding:
            raise ValueError("Document must have embeddings for ChromaDB")
        
        self.collection.add(
            ids=[document.id],
            embeddings=[document.embedding],
            documents=[document.content],
            metadatas=[{
                **document.metadata,
                "created_at": document.created_at.isoformat()
            }]
        )
    
    async def add_documents(self, documents: List[Document]):
        """Add multiple documents to the store"""
        if not documents:
            return
        
        ids = []
        embeddings = []
        contents = []
        metadatas = []
        
        for doc in documents:
            if not doc.embedding:
                raise ValueError("All documents must have embeddings for ChromaDB")
            
            ids.append(doc.id)
            embeddings.append(doc.embedding)
            contents.append(doc.content)
            metadatas.append({
                **doc.metadata,
                "created_at": doc.created_at.isoformat()
            })
        
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=contents,
            metadatas=metadatas
        )
    
    async def search(self, query_embedding: List[float], limit: int = 10) -> List[SearchResult]:
        """Search for similar documents"""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            include=["documents", "metadatas", "distances"]
        )
        
        search_results = []
        for i, (doc_id, document, metadata, distance) in enumerate(zip(
            results["ids"][0],
            results["documents"][0], 
            results["metadatas"][0],
            results["distances"][0]
        )):
            # Convert distance to similarity score (ChromaDB returns distances)
            score = 1.0 - distance
            
            # Reconstruct document
            doc = Document(
                id=doc_id,
                content=document,
                metadata={k: v for k, v in metadata.items() if k != "created_at"},
                created_at=datetime.fromisoformat(metadata.get("created_at", datetime.now().isoformat()))
            )
            
            search_results.append(SearchResult(
                document=doc,
                score=score,
                rank=i + 1
            ))
        
        return search_results
    
    async def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID"""
        try:
            result = self.collection.get(
                ids=[document_id],
                include=["documents", "metadatas"]
            )
            
            if not result["ids"]:
                return None
            
            metadata = result["metadatas"][0]
            return Document(
                id=document_id,
                content=result["documents"][0],
                metadata={k: v for k, v in metadata.items() if k != "created_at"},
                created_at=datetime.fromisoformat(metadata.get("created_at", datetime.now().isoformat()))
            )
        except Exception:
            return None
    
    async def delete_document(self, document_id: str):
        """Delete a document"""
        self.collection.delete(ids=[document_id])

class VectorStoreManager:
    """Main vector store manager"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.embedding_provider: Optional[EmbeddingProvider] = None
        self.vector_store = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize the vector store manager"""
        self.logger.info("Initializing Vector Store Manager...")
        
        # Initialize embedding provider
        await self._initialize_embedding_provider()
        
        # Initialize vector store
        await self._initialize_vector_store()
        
        self.initialized = True
        self.logger.info("Vector Store Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup vector store manager"""
        self.logger.info("Shutting down Vector Store Manager...")
        self.initialized = False
        self.logger.info("Vector Store Manager shutdown complete")
    
    async def _initialize_embedding_provider(self):
        """Initialize the embedding provider"""
        # Try OpenAI first
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai and openai_key:
            try:
                self.embedding_provider = OpenAIEmbeddingProvider(openai_key)
                self.logger.info("Using OpenAI embedding provider")
                return
            except Exception as e:
                self.logger.warning(f"Failed to initialize OpenAI embeddings: {e}")
        
        # Fallback to local model
        if SentenceTransformer:
            try:
                self.embedding_provider = LocalEmbeddingProvider()
                self.logger.info("Using local sentence transformer embedding provider")
                return
            except Exception as e:
                self.logger.warning(f"Failed to initialize local embeddings: {e}")
        
        self.logger.warning("No embedding provider available")
    
    async def _initialize_vector_store(self):
        """Initialize the vector store"""
        # Try ChromaDB first
        if chromadb:
            try:
                self.vector_store = ChromaVectorStore()
                self.logger.info("Using ChromaDB vector store")
                return
            except Exception as e:
                self.logger.warning(f"Failed to initialize ChromaDB: {e}")
        
        # Fallback to in-memory store
        self.vector_store = InMemoryVectorStore()
        self.logger.info("Using in-memory vector store")
    
    async def add_document(self, content: str, metadata: Dict[str, Any] = None) -> str:
        """Add a document to the vector store"""
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")
        
        # Generate document ID
        doc_id = hashlib.sha256(content.encode()).hexdigest()[:16]
        
        # Get embedding
        embedding = None
        if self.embedding_provider:
            try:
                embedding = await self.embedding_provider.get_embedding(content)
            except Exception as e:
                self.logger.error(f"Failed to get embedding: {e}")
        
        # Create document
        document = Document(
            id=doc_id,
            content=content,
            metadata=metadata or {},
            embedding=embedding
        )
        
        # Add to store
        await self.vector_store.add_document(document)
        
        self.logger.info(f"Added document {doc_id} to vector store")
        return doc_id
    
    async def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Add multiple documents to the vector store"""
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")
        
        doc_objects = []
        doc_ids = []
        
        # Get embeddings for all documents
        contents = [doc["content"] for doc in documents]
        embeddings = []
        
        if self.embedding_provider:
            try:
                embeddings = await self.embedding_provider.get_embeddings(contents)
            except Exception as e:
                self.logger.error(f"Failed to get embeddings: {e}")
                embeddings = [None] * len(contents)
        else:
            embeddings = [None] * len(contents)
        
        # Create document objects
        for i, doc_data in enumerate(documents):
            doc_id = hashlib.sha256(doc_data["content"].encode()).hexdigest()[:16]
            doc_ids.append(doc_id)
            
            document = Document(
                id=doc_id,
                content=doc_data["content"],
                metadata=doc_data.get("metadata", {}),
                embedding=embeddings[i]
            )
            doc_objects.append(document)
        
        # Add to store
        await self.vector_store.add_documents(doc_objects)
        
        self.logger.info(f"Added {len(doc_objects)} documents to vector store")
        return doc_ids
    
    async def search(self, query: str, limit: int = 10) -> List[SearchResult]:
        """Search for similar documents"""
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")
        
        if not self.embedding_provider:
            self.logger.warning("No embedding provider available for search")
            return []
        
        # Get query embedding
        try:
            query_embedding = await self.embedding_provider.get_embedding(query)
        except Exception as e:
            self.logger.error(f"Failed to get query embedding: {e}")
            return []
        
        # Search vector store
        results = await self.vector_store.search(query_embedding, limit)
        
        self.logger.info(f"Found {len(results)} results for query")
        return results
    
    async def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID"""
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")
        
        return await self.vector_store.get_document(document_id)
    
    async def delete_document(self, document_id: str):
        """Delete a document"""
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")
        
        await self.vector_store.delete_document(document_id)
        self.logger.info(f"Deleted document {document_id}")
    
    async def list_documents(self, limit: int = 100, offset: int = 0) -> List[Document]:
        """List documents with pagination"""
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")
        
        return await self.vector_store.list_documents(limit, offset)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of vector store"""
        status = {
            "initialized": self.initialized,
            "embedding_provider": type(self.embedding_provider).__name__ if self.embedding_provider else None,
            "vector_store": type(self.vector_store).__name__ if self.vector_store else None
        }
        
        if self.initialized and self.embedding_provider:
            try:
                # Test embedding generation
                test_embedding = await self.embedding_provider.get_embedding("test")
                status["embedding_test"] = {
                    "success": True,
                    "embedding_size": len(test_embedding)
                }
            except Exception as e:
                status["embedding_test"] = {
                    "success": False,
                    "error": str(e)
                }
        
        return status

# Global instance
vector_store_manager = VectorStoreManager()