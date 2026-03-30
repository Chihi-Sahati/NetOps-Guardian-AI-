import json
import logging
import os
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger("MemoryAgent")

class MemoryAgent:
    """
    Semantic Caching Agent for Intent-Based Remediation
    Learns from past successful remediations and suggests solutions for similar events
    without requiring a full LLM inference cycle.
    """
    def __init__(self, persistence_file: str = "memory_cache.json"):
        self.persistence_file = persistence_file
        self.memories: List[Dict] = []
        self.vectorizer = TfidfVectorizer(stop_words='english') if SKLEARN_AVAILABLE else None
        self.tfidf_matrix = None
        self._load_memory()

    def _load_memory(self):
        """Load experiences from local persistence"""
        if os.path.exists(self.persistence_file):
            try:
                with open(self.persistence_file, 'r', encoding='utf-8') as f:
                    self.memories = json.load(f)
                self._update_vectors()
                logger.info(f"Loaded {len(self.memories)} semantic memories.")
            except Exception as e:
                logger.error(f"Failed to load memory cache: {e}")

    def _save_memory(self):
        """Save experiences to local persistence"""
        try:
            with open(self.persistence_file, 'w', encoding='utf-8') as f:
                json.dump(self.memories, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save memory cache: {e}")

    def _update_vectors(self):
        """Recompute the TF-IDF matrix for all stored memories"""
        if not SKLEARN_AVAILABLE or not self.memories:
            self.tfidf_matrix = None
            return
            
        contexts = [m['context'] for m in self.memories]
        self.tfidf_matrix = self.vectorizer.fit_transform(contexts)

    def add_experience(self, context: str, remediation: str, root_cause: str) -> None:
        """
        Store a successful remediation into memory.
        """
        # Avoid exact duplicates
        for mem in self.memories:
            if mem['context'] == context:
                mem['hits'] = mem.get('hits', 0) + 1
                mem['last_used'] = datetime.utcnow().isoformat()
                self._save_memory()
                return

        new_memory = {
            "id": f"mem_{int(time.time() * 1000)}",
            "context": context,
            "remediation": remediation,
            "root_cause": root_cause,
            "timestamp": datetime.utcnow().isoformat(),
            "hits": 1,
            "last_used": datetime.utcnow().isoformat()
        }
        self.memories.append(new_memory)
        self._update_vectors()
        self._save_memory()
        logger.info(f"Added new memory semantic pattern for root cause: {root_cause}")

    def retrieve_experience(self, context: str, threshold: float = 0.45) -> Optional[Dict]:
        """
        Search for a similar past event using Cosine Similarity.
        Returns the closest matching remediation if similarity >= threshold.
        """
        if not SKLEARN_AVAILABLE:
            logger.warning("scikit-learn not installed. Semantic search disabled.")
            return None

        if not self.memories or self.tfidf_matrix is None:
            return None

        try:
            # Vectorize the incoming context
            query_vector = self.vectorizer.transform([context])
            
            # Calculate similarities
            similarities = cosine_similarity(query_vector, self.tfidf_matrix)[0]
            
            # Find the best match
            best_match_idx = similarities.argmax()
            best_score = similarities[best_match_idx]

            if best_score >= threshold:
                match = self.memories[best_match_idx]
                match['hits'] = match.get('hits', 0) + 1
                match['last_used'] = datetime.utcnow().isoformat()
                self._save_memory()
                
                logger.info(f"Memory Cache HIT! Similarity: {best_score:.2f} for root cause: {match['root_cause']}")
                return {
                    "similarity": float(best_score),
                    "remediation": match['remediation'],
                    "root_cause": match['root_cause'],
                    "memory_id": match['id']
                }
            
            logger.debug(f"Memory Cache MISS. Best similarity was {best_score:.2f} (< {threshold})")
            return None
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return None
