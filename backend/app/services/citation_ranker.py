"""Service for ranking and tiering RAG citations."""

from enum import Enum
from typing import List, Dict, Any

from app.domain.schemas import VectorSearchResult, Citation


class CitationTier(str, Enum):
    PRIMARY = "primary"        # High relevance
    SECONDARY = "secondary"    # Good supporting context
    TERTIARY = "tertiary"      # Reference only


class CitationRanker:
    """Ranks and tiers citations for optimal UX.
    
    Primary: Top 1-2 citations.
    Secondary: Next 2-3 citations.
    Tertiary: The rest (hidden by default in UI).
    """
    
    def __init__(self, primary_count: int = 2, secondary_count: int = 3):
        self.primary_count = primary_count
        self.secondary_count = secondary_count
    
    def rank_citations(self, results: List[VectorSearchResult]) -> Dict[str, Any]:
        """Tier citations by relevance and deduplicate by page_id."""
        # Deduplicate, keeping highest score per page
        unique_pages: Dict[str, VectorSearchResult] = {}
        for r in results:
            key = r.document_uid or str(r.page_id)
            if key not in unique_pages or r.score > unique_pages[key].score:
                unique_pages[key] = r
                
        # Sort by score descending
        sorted_results = sorted(unique_pages.values(), key=lambda x: x.score, reverse=True)
        
        primary = sorted_results[:self.primary_count]
        secondary = sorted_results[self.primary_count:self.primary_count + self.secondary_count]
        
        primary_citations = [self._to_citation(r, CitationTier.PRIMARY) for r in primary]
        secondary_citations = [self._to_citation(r, CitationTier.SECONDARY) for r in secondary]
        all_citations = [self._to_citation(r, 
                CitationTier.PRIMARY if r in primary else 
                CitationTier.SECONDARY if r in secondary else 
                CitationTier.TERTIARY) 
            for r in sorted_results]
        
        return {
            "primary": primary_citations,
            "secondary": secondary_citations,
            "all_sources": all_citations,
            "total_sources": len(unique_pages),
            "hidden_count": max(0, len(unique_pages) - self.primary_count - self.secondary_count),
        }
        
    def _to_citation(self, r: VectorSearchResult, tier: CitationTier) -> Citation:
        return Citation(
            page_id=r.page_id,
            page_title=r.page_title,
            source_url=r.source_url or r.bookstack_url,
            source_type=r.source_type,
            source_name=r.source_name,
            source_key=r.source_key,
            document_uid=r.document_uid,
            external_document_id=r.external_document_id,
            document_id=r.document_id,
            file_name=r.file_name,
            user_id=r.user_id,
            blob_url=r.blob_url,
            page_number=r.page_number,
            chunk_text=r.text[:200] + "..." if len(r.text) > 200 else r.text,
            score=round(r.score, 3),
            tier=tier.value
        )

# Singleton instance
citation_ranker = CitationRanker()
