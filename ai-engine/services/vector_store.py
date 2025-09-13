"""
Vector Store Manager - Handles embeddings and vector search for AI applications
"""

import asyncio
import json
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from abc import ABC, abstractmethod

# Vector store implementations
try:
    import pinecone
except ImportError:
    pinecone = None

try:
    import weaviate
except ImportError:
    weaviate = None

try:
    import chromadb
except ImportError:
    chromadb = None

# Embedding providers
try:
    import openai
except ImportError:
    openai = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

from ..core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class Document:
    id: str
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None

@dataclass
class SearchResult:
    document: Document
    score: float
    rank: int

class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers"""
    
    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """Generate embeddings for text"""
        pass
    
    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        pass

class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider"""
    
    def __init__(self, api_key: str, model: str = "text-embedding-ada-002"):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model
    
    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding for single text"""
        response = await self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        response = await self.client.embeddings.create(
            model=self.model,
            input=texts
        )
        return [data.embedding for data in response.data]

class SentenceTransformerProvider(EmbeddingProvider):
    """Local sentence transformer embedding provider"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        if SentenceTransformer is None:
            raise ImportError("sentence-transformers not installed")
        
        self.model = SentenceTransformer(model_name)
    
    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding for single text"""
        # Run in thread pool since sentence-transformers is CPU-bound
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None, 
            lambda: self.model.encode([text])[0]
        )
        return embedding.tolist()
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            lambda: self.model.encode(texts)
        )
        return embeddings.tolist()

class VectorStore(ABC):
    """Abstract base class for vector stores"""
    
    @abstractmethod
    async def add_documents(self, documents: List[Document]) -> None:
        """Add documents to the vector store"""
        pass
    
    @abstractmethod
    async def search(
        self, 
        query_embedding: List[float], 
        limit: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search for similar documents"""
        pass
    
    @abstractmethod
    async def delete_documents(self, document_ids: List[str]) -> None:
        """Delete documents by IDs"""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check vector store health"""
        pass

class PineconeVectorStore(VectorStore):
    """Pinecone vector store implementation"""
    
    def __init__(self, api_key: str, environment: str, index_name: str):
        if pinecone is None:
            raise ImportError("pinecone-client not installed")
        
        pinecone.init(api_key=api_key, environment=environment)
        self.index = pinecone.Index(index_name)
        self.index_name = index_name
    
    async def add_documents(self, documents: List[Document]) -> None:
        """Add documents to Pinecone"""
        vectors = []
        for doc in documents:
            if doc.embedding is None:
                raise ValueError(f"Document {doc.id} has no embedding")
            
            vectors.append((
                doc.id,
                doc.embedding,
                {
                    "content": doc.content,
                    **doc.metadata
                }
            ))
        
        # Pinecone upsert is synchronous, so we run it in a thread
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.index.upsert(vectors)
        )
    
    async def search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search Pinecone for similar vectors"""
        
        query_params = {
            "vector": query_embedding,
            "top_k": limit,
            "include_metadata": True
        }
        
        if filter_metadata:
            query_params["filter"] = filter_metadata
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.index.query(**query_params)
        )
        
        results = []
        for i, match in enumerate(response.matches):
            doc = Document(
                id=match.id,
                content=match.metadata.get("content", ""),
                metadata={k: v for k, v in match.metadata.items() if k != "content"},
                embedding=None  # We don't need to return embeddings in search results
            )
            
            results.append(SearchResult(
                document=doc,
                score=match.score,
                rank=i + 1
            ))
        
        return results
    
    async def delete_documents(self, document_ids: List[str]) -> None:
        """Delete documents from Pinecone"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.index.delete(ids=document_ids)
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Pinecone health"""
        try:
            loop = asyncio.get_event_loop()
            stats = await loop.run_in_executor(
                None,
                lambda: self.index.describe_index_stats()
            )
            
            return {
                "status": "healthy",
                "index_name": self.index_name,
                "total_vector_count": stats.total_vector_count,
                "dimension": stats.dimension
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

class ChromaVectorStore(VectorStore):
    """ChromaDB vector store implementation"""
    
    def __init__(self, persist_directory: str, collection_name: str = "myco_vectors"):
        if chromadb is None:
            raise ImportError("chromadb not installed")
        
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(name=collection_name)
        self.collection_name = collection_name
    
    async def add_documents(self, documents: List[Document]) -> None:
        """Add documents to ChromaDB"""
        ids = [doc.id for doc in documents]
        embeddings = [doc.embedding for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        documents_content = [doc.content for doc in documents]
        
        # ChromaDB operations are synchronous
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.collection.add(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents_content
            )
        )
    
    async def search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search ChromaDB for similar vectors"""
        
        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": limit,
            "include": ["documents", "metadatas", "distances"]
        }
        
        if filter_metadata:
            query_params["where"] = filter_metadata
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.collection.query(**query_params)
        )
        
        results = []
        for i, (doc_id, document, metadata, distance) in enumerate(zip(
            response["ids"][0],
            response["documents"][0],
            response["metadatas"][0],
            response["distances"][0]
        )):
            doc = Document(
                id=doc_id,
                content=document,
                metadata=metadata or {},
                embedding=None
            )
            
            # Convert distance to similarity score (ChromaDB returns distances)
            score = 1.0 / (1.0 + distance)
            
            results.append(SearchResult(
                document=doc,
                score=score,
                rank=i + 1
            ))
        
        return results
    
    async def delete_documents(self, document_ids: List[str]) -> None:
        """Delete documents from ChromaDB"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.collection.delete(ids=document_ids)
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Check ChromaDB health"""
        try:
            loop = asyncio.get_event_loop()
            count = await loop.run_in_executor(
                None,
                lambda: self.collection.count()
            )
            
            return {
                "status": "healthy",
                "collection_name": self.collection_name,
                "document_count": count
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

class VectorStoreManager:
    """Manages vector stores and embeddings"""
    
    def __init__(self):
        self.embedding_provider: Optional[EmbeddingProvider] = None
        self.vector_store: Optional[VectorStore] = None
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize embedding and vector store providers"""
        
        # Initialize embedding provider
        if settings.OPENAI_API_KEY:
            self.embedding_provider = OpenAIEmbeddingProvider(settings.OPENAI_API_KEY)
            logger.info("Initialized OpenAI embedding provider")
        elif SentenceTransformer:
            self.embedding_provider = SentenceTransformerProvider()
            logger.info("Initialized SentenceTransformer embedding provider")
        else:
            logger.warning("No embedding provider available")
        
        # Initialize vector store
        if settings.PINECONE_API_KEY and settings.PINECONE_ENVIRONMENT:
            try:
                self.vector_store = PineconeVectorStore(
                    api_key=settings.PINECONE_API_KEY,
                    environment=settings.PINECONE_ENVIRONMENT,
                    index_name=settings.PINECONE_INDEX_NAME
                )
                logger.info("Initialized Pinecone vector store")
            except Exception as e:
                logger.warning(f"Failed to initialize Pinecone: {e}")
        
        if not self.vector_store and chromadb:
            try:
                self.vector_store = ChromaVectorStore(
                    persist_directory=settings.CHROMA_PERSIST_DIRECTORY
                )
                logger.info("Initialized ChromaDB vector store")
            except Exception as e:
                logger.warning(f"Failed to initialize ChromaDB: {e}")
        
        if not self.vector_store:
            logger.warning("No vector store initialized")
    
    async def initialize(self):
        """Initialize the vector store manager"""
        logger.info("Vector store manager initialized")
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Vector store manager cleaned up")
    
    async def add_documents(
        self,
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        document_ids: Optional[List[str]] = None
    ) -> List[str]:
        """Add documents with automatic embedding generation"""
        
        if not self.embedding_provider:
            raise RuntimeError("No embedding provider available")
        
        if not self.vector_store:
            raise RuntimeError("No vector store available")
        
        # Generate embeddings
        embeddings = await self.embedding_provider.embed_batch(texts)
        
        # Create documents
        documents = []
        for i, (text, metadata, embedding) in enumerate(zip(texts, metadatas, embeddings)):
            doc_id = document_ids[i] if document_ids else f"doc_{i}_{hash(text) % 1000000}"
            
            documents.append(Document(
                id=doc_id,
                content=text,
                metadata=metadata,
                embedding=embedding
            ))
        
        # Add to vector store
        await self.vector_store.add_documents(documents)
        
        return [doc.id for doc in documents]
    
    async def search(
        self,
        query: str,
        limit: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search for similar documents"""
        
        if not self.embedding_provider:
            raise RuntimeError("No embedding provider available")
        
        if not self.vector_store:
            raise RuntimeError("No vector store available")
        
        # Generate query embedding
        query_embedding = await self.embedding_provider.embed_text(query)
        
        # Search vector store
        return await self.vector_store.search(
            query_embedding=query_embedding,
            limit=limit,
            filter_metadata=filter_metadata
        )
    
    async def delete_documents(self, document_ids: List[str]) -> None:
        """Delete documents by IDs"""
        
        if not self.vector_store:
            raise RuntimeError("No vector store available")
        
        await self.vector_store.delete_documents(document_ids)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of vector store components"""
        
        health = {
            "embedding_provider": "none",
            "vector_store": "none"
        }
        
        if self.embedding_provider:
            try:
                # Test embedding generation
                await self.embedding_provider.embed_text("test")
                health["embedding_provider"] = "healthy"
            except Exception as e:
                health["embedding_provider"] = f"unhealthy: {str(e)}"
        
        if self.vector_store:
            store_health = await self.vector_store.health_check()
            health["vector_store"] = store_health
        
        return health

# Global instance
vector_store_manager = VectorStoreManager()