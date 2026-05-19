"""Services module — бизнес-логика всех блоков."""

# Block 1: Concept Generator (4.B.2 — Этапы 1–3)
from app.services.concept_service import ConceptService

# Block 2: Core Loop Designer (4.B.6 — Этапы 1–3)
from app.services.coreloop_service import CoreLoopService

# Block 4: Balance & Simulation (4.C.1–4.C.3 — Этапы 1–7 + Q-фактор + симуляция)
from app.services.balance_service import BalanceService

# Block 5: Progression (4.C.5 — Этапы 1–4 алгоритма 3.5)
from app.services.progression_service import ProgressionService

# Block 6: GDD Generator (4.D.1 — Этапы 1–3 алгоритма 3.7)
from app.services.gdd_service import GDDService

__all__ = ["ConceptService", "CoreLoopService", "BalanceService", "ProgressionService", "GDDService"]
