"""Services module — бизнес-логика всех блоков."""

# Block 1: Concept Generator (4.B.2 — Этапы 1–3)
from app.services.concept_service import ConceptService

# Block 2: Core Loop Designer (4.B.6 — Этапы 1–3)
from app.services.coreloop_service import CoreLoopService

__all__ = ["ConceptService", "CoreLoopService"]
