"""
Gidede — Checklist Service
Фаза 4.D.4: Реализация алгоритма 3.8 — Чек-листы валидации геймдизайна

7 этапов:
- Этап 1: Определение области валидации → ValidationScope (3.8.3)
- Этап 2: MDA-чек → MDACheckResult (3.8.4)
- Этап 3: Баланс-чек → BalanceCheckResult (3.8.5)
- Этап 4: Нарратив-чек → NarrativeCheckResult (3.8.6)
- Этап 5: Экономика-чек → EconomyCheckResult (3.8.7)
- Этап 6: Линзы Шелла → LensCheckResult (3.8.8)
- Этап 7: Агрегация, приоритизация, план ремедиации → ValidationResult (3.8.9)

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry)
"""

import logging
import time
from typing import Any, Optional

from app.ai.executor import PromptExecutor
from app.schemas.checklist import (
    ChecklistInput,
    ChecklistType,
    CheckDepth,
    FocusArea,
    ProjectStage,
    IssueSeverity,
    ReadinessLevel,
    EffortLevel,
    ValidationScope,
    ValidationIssue,
    MDACheckResult,
    BalanceScores,
    BalanceCheckResult,
    NarrativeCheckResult,
    QFactorInfo,
    EconomyCheckResult,
    LensResult,
    LensCheckResult,
    RemediationItem,
    ValidationSummary,
    ValidationProfile,
)

logger = logging.getLogger(__name__)


# ============================================================
# КОНСТАНТЫ — маппинги из спецификации 3.8
# ============================================================

# Этап 1.1: Стадия проекта → чек-листы
STAGE_CHECKLIST_MAP: dict[str, list[ChecklistType]] = {
    "concept":       ["mda", "lenses"],
    "prototype":     ["mda", "balance", "lenses"],
    "preproduction": ["mda", "balance", "narrative", "economy", "lenses"],
    "production":    ["mda", "balance", "narrative", "economy", "lenses"],
    "live_ops":      ["balance", "economy"],
}

# Этап 1.2: Жанр → специфичные проверки баланса и линз
GENRE_BALANCE_CHECKS: dict[str, list[str]] = {
    "shooter":    ["transitive", "intransitive", "difficulty"],
    "rpg":        ["transitive", "progression", "difficulty"],
    "strategy":   ["intransitive", "economy", "asymmetry"],
    "casual":     ["difficulty", "pacing"],
    "mmorpg":     ["transitive", "progression", "economy", "meta_game"],
    "survival":   ["economy", "progression", "difficulty"],
    "action":     ["transitive", "difficulty"],
    "horror":     ["difficulty", "pacing", "emotional"],
    "roguelike":  ["intransitive", "progression", "difficulty"],
}

GENRE_LENS_MAP: dict[str, list[int]] = {
    "shooter":    [40, 41, 69, 96, 97],
    "rpg":        [68, 83, 84, 85, 86, 87],
    "strategy":   [30, 31, 40, 41, 102],
    "casual":     [1, 4, 59, 60, 69],
    "survival":   [30, 31, 68, 83, 92, 93],
    "mmorpg":     [96, 97, 98, 99, 100, 101],
    "horror":     [68, 74, 75, 76],
    "roguelike":  [30, 31, 40, 54, 55],
}

# Базовые линзы — всегда применяются
BASE_LENSES = [1, 9, 11, 12]

# Проблема → линзы для дополнительной проверки
PROBLEM_LENS_MAP: dict[str, list[int]] = {
    "runaway_risk":              [37, 38, 39],
    "ludonarrative_dissonance":  [68, 69, 75],
    "grind":                     [69, 74],
    "empty_levels":              [4, 69],
    "weak_synergies":            [9, 11, 12],
    "dominant_strategy":         [40, 41],
}

# Стадия проекта → глубина проверок
STAGE_DEPTH_MAP: dict[str, CheckDepth] = {
    "concept":       "surface",
    "prototype":     "standard",
    "preproduction": "deep",
    "production":    "exhaustive",
    "live_ops":      "targeted",
}

# Нарративные жанры — для пропуска/запуска нарратив-чека
NARRATIVE_GENRES = {
    "rpg", "adventure", "survival", "horror", "visual_novel",
    "interactive_movie", "walking_simulator", "narrative",
}

# 12 типов баланса и глубина, на которой они активируются
BALANCE_TYPE_DEPTH: dict[str, CheckDepth] = {
    "transitive":   "surface",
    "intransitive": "surface",
    "difficulty":   "surface",
    "progression":  "standard",
    "economy":      "standard",
    "time":         "deep",
    "emotional":    "deep",
    "information":  "deep",
    "risk_reward":  "deep",
    "build":        "exhaustive",
    "faction":      "exhaustive",
    "meta_game":    "exhaustive",
}

DEPTH_ORDER = {"surface": 0, "standard": 1, "deep": 2, "exhaustive": 3, "targeted": 1}


# ============================================================
# СЕРВИС ЧЕК-ЛИСТОВ
# ============================================================

class ChecklistService:
    """
    Сервис чек-листов валидации геймдизайна — реализация алгоритма 3.8.

    Вызывает PromptExecutor для AI-проверок (линзы, нарратив, ремедиация).
    Эвристические проверки (MDA, баланс, экономика) выполняются детерминистически.
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ================================================================
    # ГЛАВНЫЙ МЕТОД — ПОЛНЫЙ ПАЙПЛАЙН 1→7
    # ================================================================

    async def run_validation(
        self,
        input_data: ChecklistInput,
    ) -> ValidationProfile:
        """Запустить полную валидацию геймдизайна (алгоритм 3.8, этапы 1–7)."""
        start = time.time()
        profile = ValidationProfile()
        models_used: list[str] = []

        # Этап 1: Определение области валидации
        scope = self._define_scope(input_data)
        profile.scope = scope
        profile.stages_completed.append(1)

        # Этап 2: MDA-чек
        if "mda" in scope.active_checklists:
            mda_result = await self._run_mda_check(input_data, scope)
            profile.mda_check = mda_result
            profile.stages_completed.append(2)

        # Этап 3: Баланс-чек
        if "balance" in scope.active_checklists:
            balance_result = await self._run_balance_check(input_data, scope)
            profile.balance_check = balance_result
            profile.stages_completed.append(3)

        # Этап 4: Нарратив-чек
        if "narrative" in scope.active_checklists:
            narrative_result = await self._run_narrative_check(input_data, scope)
            profile.narrative_check = narrative_result
            profile.stages_completed.append(4)

        # Этап 5: Экономика-чек
        if "economy" in scope.active_checklists:
            economy_result = await self._run_economy_check(input_data, scope)
            profile.economy_check = economy_result
            profile.stages_completed.append(5)

        # Этап 6: Линзы Шелла
        if "lenses" in scope.active_checklists:
            lens_result = await self._run_lens_check(input_data, scope, profile)
            profile.lens_check = lens_result
            profile.stages_completed.append(6)

        # Этап 7: Агрегация и ремедиация
        self._aggregate_results(profile)
        profile.stages_completed.append(7)

        # Метаданные
        profile.latency_ms = int((time.time() - start) * 1000)
        profile.models_used = list(set(models_used))

        return profile

    # ================================================================
    # ЭТАП 1: ОПРЕДЕЛЕНИЕ ОБЛАСТИ ВАЛИДАЦИИ (3.8.3)
    # ================================================================

    def _define_scope(self, input_data: ChecklistInput) -> ValidationScope:
        """Определить область валидации на основе входных данных."""
        # Шаг 1.1: Определить чек-листы
        if input_data.checklist_types:
            active_checklists = list(input_data.checklist_types)
        else:
            stage = input_data.project_stage or "preproduction"
            active_checklists = STAGE_CHECKLIST_MAP.get(stage, ["mda", "balance", "lenses"])

        # Шаг 1.2: Жанр-специфичные проверки
        genre = ""
        if input_data.concept and isinstance(input_data.concept, dict):
            genre = input_data.concept.get("genre", "").lower()

        genre_checks: dict[str, Any] = {}
        if genre in GENRE_BALANCE_CHECKS:
            genre_checks["balance_types"] = GENRE_BALANCE_CHECKS[genre]
        if genre in GENRE_LENS_MAP:
            genre_checks["lens_ids"] = GENRE_LENS_MAP[genre]

        # Шаг 1.3: Глубина проверок
        stage = input_data.project_stage or "preproduction"
        depth = STAGE_DEPTH_MAP.get(stage, "standard")

        # Шаг 1.4: Оценка количества проверок
        estimated_checks = 0
        if "mda" in active_checklists:
            estimated_checks += 5
        if "balance" in active_checklists:
            depth_level = DEPTH_ORDER.get(depth, 1)
            estimated_checks += sum(
                1 for d in BALANCE_TYPE_DEPTH.values()
                if DEPTH_ORDER.get(d, 0) <= depth_level
            )
        if "narrative" in active_checklists:
            estimated_checks += 4
        if "economy" in active_checklists:
            estimated_checks += 5
        if "lenses" in active_checklists:
            base = len(BASE_LENSES)
            genre_lens = len(genre_checks.get("lens_ids", []))
            estimated_checks += base + genre_lens

        return ValidationScope(
            active_checklists=active_checklists,
            genre_checks=genre_checks,
            depth=depth,
            focus_areas=input_data.focus_areas or [],
            estimated_checks=estimated_checks,
        )

    # ================================================================
    # ЭТАП 2: MDA-ЧЕК (3.8.4)
    # ================================================================

    async def _run_mda_check(
        self,
        input_data: ChecklistInput,
        scope: ValidationScope,
    ) -> MDACheckResult:
        """Проверка MDA: механика→динамика→эстетика полнота."""
        mda = input_data.mda_profile
        if not mda or not isinstance(mda, dict):
            return MDACheckResult(
                skipped=True,
                skip_reason="Нет данных MDA-профиля (Блок 3 не заполнен)",
            )

        issues: list[ValidationIssue] = []
        suggestions: list[str] = []

        # Проверка 1: Покрытие эстетик динамиками
        aesthetic_profile = mda.get("aesthetic_profile", {})
        target_aesthetics = aesthetic_profile.get("primary_aesthetics", [])
        if not target_aesthetics:
            # Попробуем alternative field names
            target_aesthetics = (
                aesthetic_profile.get("aesthetics", [])
                or [aesthetic_profile.get("primary_aesthetic", "")]
            )
            target_aesthetics = [a for a in target_aesthetics if a]

        dynamics = mda.get("dynamics", [])
        mechanics = mda.get("mechanic_set", {})
        mechanic_list = (
            mechanics.get("mechanics", [])
            if isinstance(mechanics, dict)
            else mechanics if isinstance(mechanics, list) else []
        )

        aesthetic_coverage = 1.0
        if target_aesthetics:
            covered = sum(1 for a in target_aesthetics if dynamics)
            aesthetic_coverage = covered / len(target_aesthetics) if target_aesthetics else 0.0

            if not dynamics:
                issues.append(ValidationIssue(
                    severity="critical",
                    issue_type="aesthetic_orphan",
                    area="mechanics",
                    description="Нет динамик, обслуживающих целевые эстетики",
                    suggestion="Определите динамики для каждой целевой эстетики через Reverse MDA",
                    detected_by=["mda"],
                    affected_algorithms=["3.3"],
                ))
                aesthetic_coverage = 0.0

        # Проверка 2: Покрытие динамики механиками
        if dynamics and not mechanic_list:
            issues.append(ValidationIssue(
                severity="critical",
                issue_type="dynamic_orphan",
                area="mechanics",
                description="Динамики определены, но нет поддерживающих механик",
                suggestion="Добавьте механики, реализующие динамики",
                detected_by=["mda"],
                affected_algorithms=["3.3"],
            ))

        # Проверка 3: Общая полнота MDA-цепочки
        completeness = 0.0
        has_mechanics = bool(mechanic_list)
        has_dynamics = bool(dynamics)
        has_aesthetics = bool(target_aesthetics)

        if has_mechanics:
            completeness += 0.33
        if has_dynamics:
            completeness += 0.33
        if has_aesthetics:
            completeness += 0.34

        if has_mechanics and not has_dynamics:
            issues.append(ValidationIssue(
                severity="warning",
                issue_type="mda_gap",
                area="mechanics",
                description="Механики определены, но динамики не выведены — обрыв MDA-цепочки",
                suggestion="Пройдите Reverse MDA для вывода динамики из механик",
                detected_by=["mda"],
                affected_algorithms=["3.3"],
            ))
            suggestions.append("Заполните блок динамики в MDA-профиле")

        if has_dynamics and not has_aesthetics:
            issues.append(ValidationIssue(
                severity="warning",
                issue_type="mda_gap",
                area="mechanics",
                description="Динамики определены, но целевые эстетики не заданы",
                suggestion="Определите целевые эстетики для контроля MDA-полноты",
                detected_by=["mda"],
                affected_algorithms=["3.3"],
            ))
            suggestions.append("Определите целевые эстетики в MDA-профиле")

        # Проверка 5: Матрица Бонда (упрощённая эвристика)
        bond_score = 1.0
        if has_mechanics and has_aesthetics:
            # Простая эвристика: если механик < 3 при > 2 эстетиках — слабая связность
            if len(mechanic_list) < 3 and len(target_aesthetics) > 2:
                bond_score = 0.5
                issues.append(ValidationIssue(
                    severity="warning",
                    issue_type="bond_dissonance",
                    area="mechanics",
                    description="Мало механик для покрытия целевых эстетик — слабая матрица Бонда",
                    suggestion="Добавьте механики для каждого столбца матрицы Бонда (Mechanics/Story/Aesthetics/Technology)",
                    detected_by=["mda"],
                    affected_algorithms=["3.3"],
                ))

        # Общая оценка MDA
        overall = (
            aesthetic_coverage * 0.3
            + completeness * 0.4
            + bond_score * 0.3
        )

        return MDACheckResult(
            issues=issues,
            suggestions=suggestions,
            aesthetic_coverage=round(aesthetic_coverage, 2),
            completeness_score=round(completeness, 2),
            bond_consistency_score=round(bond_score, 2),
            overall_mda_score=round(overall, 2),
        )

    # ================================================================
    # ЭТАП 3: БАЛАНС-ЧЕК (3.8.5)
    # ================================================================

    async def _run_balance_check(
        self,
        input_data: ChecklistInput,
        scope: ValidationScope,
    ) -> BalanceCheckResult:
        """Проверка баланса: 12 типов."""
        balance = input_data.balance_result
        if not balance or not isinstance(balance, dict):
            return BalanceCheckResult(
                skipped=True,
                skip_reason="Нет данных балансировки (Блок 4 не заполнен)",
            )

        issues: list[ValidationIssue] = []
        suggestions: list[str] = []
        scores = BalanceScores()
        checks_run: list[str] = []

        depth_level = DEPTH_ORDER.get(scope.depth, 1)

        # 1. Transitive-баланс
        if DEPTH_ORDER.get(BALANCE_TYPE_DEPTH["transitive"], 0) <= depth_level:
            checks_run.append("transitive")
            elements = balance.get("elements", [])
            if elements:
                overpowered = [e for e in elements if e.get("status") == "overpowered"]
                underpowered = [e for e in elements if e.get("status") == "underpowered"]
                total = len(elements)
                balanced = total - len(overpowered) - len(underpowered)
                scores.transitive = round(balanced / max(total, 1), 2)

                if overpowered:
                    issues.append(ValidationIssue(
                        severity="warning",
                        issue_type="overpowered_elements",
                        area="balance",
                        description=f"Переоценённые элементы: {len(overpowered)} из {total} (cost/power < 0.7)",
                        suggestion="Снизить power или увеличить cost для переоценённых элементов",
                        detected_by=["balance"],
                        affected_algorithms=["3.4"],
                    ))
                if underpowered:
                    issues.append(ValidationIssue(
                        severity="info",
                        issue_type="underpowered_elements",
                        area="balance",
                        description=f"Недооценённые элементы: {len(underpowered)} из {total}",
                        suggestion="Увеличить power или снизить cost для недооценённых элементов",
                        detected_by=["balance"],
                        affected_algorithms=["3.4"],
                    ))

        # 2. Intransitive-баланс
        if DEPTH_ORDER.get(BALANCE_TYPE_DEPTH["intransitive"], 0) <= depth_level:
            checks_run.append("intransitive")
            intransitive = balance.get("intransitive_result", {})
            if intransitive:
                has_dominant = intransitive.get("has_dominant_strategy", False)
                rps_cycles = intransitive.get("rps_cycles", [])
                if has_dominant:
                    scores.intransitive = 0.2
                    issues.append(ValidationIssue(
                        severity="critical",
                        issue_type="dominant_strategy",
                        area="balance",
                        description="Обнаружена доминантная стратегия — нет контр-элемента",
                        suggestion="Добавить контр-элемент или ослабить доминантную стратегию",
                        detected_by=["balance"],
                        affected_algorithms=["3.4"],
                    ))
                elif rps_cycles:
                    scores.intransitive = round(min(1.0, len(rps_cycles) / 2), 2)
                else:
                    scores.intransitive = 0.5

        # 3. Баланс сложности
        if DEPTH_ORDER.get(BALANCE_TYPE_DEPTH["difficulty"], 0) <= depth_level:
            checks_run.append("difficulty")
            progression = input_data.progression_profile
            if progression and isinstance(progression, dict):
                validation = progression.get("validation", {})
                if validation:
                    grind_detected = validation.get("grind_detected", False)
                    walls_detected = validation.get("walls_detected", False)
                    if grind_detected:
                        scores.difficulty = 0.3
                        issues.append(ValidationIssue(
                            severity="critical" if validation.get("grind_severity") == "high" else "warning",
                            issue_type="grind",
                            area="progression",
                            description="Обнаружен гринд — циклы на уровне превышают толерантность",
                            suggestion="Сократить количество повторений или добавить вариативность",
                            detected_by=["balance"],
                            affected_algorithms=["3.5"],
                        ))
                    elif walls_detected:
                        scores.difficulty = 0.5
                        issues.append(ValidationIssue(
                            severity="warning",
                            issue_type="difficulty_wall",
                            area="progression",
                            description="Обнаружены стены сложности — резкие скачки",
                            suggestion="Сгладить кривую сложности между уровнями",
                            detected_by=["balance"],
                            affected_algorithms=["3.5"],
                        ))
                    else:
                        scores.difficulty = 0.8

        # 4. Прогрессия (для standard+ depth)
        if DEPTH_ORDER.get(BALANCE_TYPE_DEPTH["progression"], 0) <= depth_level:
            checks_run.append("progression")
            progression = input_data.progression_profile
            if progression and isinstance(progression, dict):
                curves = progression.get("curves", {})
                if curves:
                    scores.progression = 0.7  # baseline if curves exist
                    empty_levels = progression.get("validation", {}).get("empty_levels", 0)
                    if empty_levels > 0:
                        scores.progression = max(0.3, scores.progression - 0.1 * empty_levels)
                        issues.append(ValidationIssue(
                            severity="warning",
                            issue_type="empty_levels",
                            area="progression",
                            description=f"Обнаружено {empty_levels} пустых уровней в прогрессии",
                            suggestion="Добавить контент или убрать пустые уровни",
                            detected_by=["balance"],
                            affected_algorithms=["3.5"],
                        ))

        # 5. Баланс экономики
        if DEPTH_ORDER.get(BALANCE_TYPE_DEPTH["economy"], 0) <= depth_level:
            checks_run.append("economy")
            economy = input_data.economy_profile
            if economy and isinstance(economy, dict):
                pathologies = economy.get("pathologies", [])
                if pathologies:
                    critical_path = [p for p in pathologies if p.get("severity") == "critical"]
                    if critical_path:
                        scores.economy = 0.2
                    else:
                        scores.economy = 0.5
                else:
                    scores.economy = 0.8

        # Общая оценка
        active_scores = [
            s for s in [scores.transitive, scores.intransitive, scores.difficulty,
                        scores.progression, scores.economy]
            if s > 0
        ]
        overall = round(sum(active_scores) / max(len(active_scores), 1), 2) if active_scores else 0.0

        return BalanceCheckResult(
            issues=issues,
            suggestions=suggestions,
            balance_scores=scores,
            overall_balance_score=overall,
            checks_run=checks_run,
        )

    # ================================================================
    # ЭТАП 4: НАРРАТИВ-ЧЕК (3.8.6)
    # ================================================================

    async def _run_narrative_check(
        self,
        input_data: ChecklistInput,
        scope: ValidationScope,
    ) -> NarrativeCheckResult:
        """Проверка нарратива: диссонанс, агентивность, структура."""
        # Пропуск для ненарративных жанров
        genre = ""
        if input_data.concept and isinstance(input_data.concept, dict):
            genre = input_data.concept.get("genre", "").lower()

        has_narrative = bool(input_data.concept and isinstance(input_data.concept, dict)
                            and input_data.concept.get("narrative"))

        if genre not in NARRATIVE_GENRES and not has_narrative:
            return NarrativeCheckResult(
                skipped=True,
                skip_reason=f"Жанр '{genre}' не является нарративным, нарратив не определён",
            )

        issues: list[ValidationIssue] = []
        ludonarrative_result = None
        ludonarrative_details = None
        agency_score = 0.5
        agency_gaps: list[str] = []
        structure_score = 0.5
        quest_variety_score = 0.5

        # Проверка 1: Лудонарративный диссонанс (AI)
        try:
            ludo_response = await self.executor.execute(
                "CHECK_LUDONARRATIVE_VAL",
                inputs={
                    "narrative_themes": (
                        input_data.concept.get("narrative", {}) if input_data.concept else {}
                    ),
                    "player_actions": (
                        [s.get("action", "") for s in (input_data.core_loop or {}).get("steps", [])]
                        if input_data.core_loop and isinstance(input_data.core_loop, dict)
                        else []
                    ),
                    "mechanics": (
                        list(input_data.mda_profile.get("mechanic_set", {}).get("mechanics", []))
                        if input_data.mda_profile and isinstance(input_data.mda_profile, dict)
                        else []
                    ),
                    "genre": genre,
                },
            )
            if ludo_response and isinstance(ludo_response, dict):
                ludonarrative_result = ludo_response.get("result")
                ludonarrative_details = ludo_response.get("details")
                dissonances = ludo_response.get("dissonances", [])

                if ludonarrative_result == "dissonance":
                    issues.append(ValidationIssue(
                        severity="critical",
                        issue_type="ludonarrative_dissonance",
                        area="narrative",
                        description=f"Лудонарративный диссонанс: {'; '.join(dissonances[:3])}",
                        suggestion="Выровнять механики и нарратив — убедиться, что действия игрока соответствуют заявленной теме",
                        detected_by=["narrative"],
                        affected_algorithms=["3.3", "3.1"],
                    ))
                elif ludonarrative_result == "irony":
                    issues.append(ValidationIssue(
                        severity="info",
                        issue_type="ludonarrative_irony",
                        area="narrative",
                        description="Лудонарративная ирония — механики намеренно контрастируют с нарративом",
                        suggestion="Убедиться, что ирония намеренная, а не случайная",
                        detected_by=["narrative"],
                        affected_algorithms=["3.3"],
                    ))
        except Exception as e:
            logger.warning(f"CHECK_LUDONARRATIVE_VAL failed: {e}")
            ludonarrative_result = None

        # Проверка 2: Агентивность игрока (AI)
        try:
            agency_response = await self.executor.execute(
                "CHECK_PLAYER_AGENCY",
                inputs={
                    "choices": (
                        input_data.concept.get("narrative", {}).get("choices", [])
                        if input_data.concept and isinstance(input_data.concept, dict) else []
                    ),
                    "genre": genre,
                    "core_loop_steps": (
                        input_data.core_loop.get("steps", [])
                        if input_data.core_loop and isinstance(input_data.core_loop, dict) else []
                    ),
                },
            )
            if agency_response and isinstance(agency_response, dict):
                agency_score = agency_response.get("score", 0.5)
                agency_gaps = agency_response.get("gaps", [])
                if agency_gaps:
                    issues.append(ValidationIssue(
                        severity="warning",
                        issue_type="agency_gap",
                        area="narrative",
                        description=f"Пробелы в агентивности: {'; '.join(str(g) for g in agency_gaps[:3])}",
                        suggestion="Добавить осмысленные выборы с видимыми последствиями",
                        detected_by=["narrative"],
                        affected_algorithms=["3.1"],
                    ))
        except Exception as e:
            logger.warning(f"CHECK_PLAYER_AGENCY failed: {e}")

        # Проверка 3: Нарративная структура (эвристика)
        if has_narrative:
            narrative = input_data.concept.get("narrative", {}) if input_data.concept else {}
            has_story = bool(narrative.get("story") or narrative.get("synopsis"))
            has_characters = bool(narrative.get("characters"))
            has_quests = bool(narrative.get("quests"))

            if has_story and has_characters:
                structure_score = 0.8
            elif has_story or has_characters:
                structure_score = 0.5
                issues.append(ValidationIssue(
                    severity="warning",
                    issue_type="narrative_structure",
                    area="narrative",
                    description="Нарративная структура неполная — отсутствуют персонажи или сюжет",
                    suggestion="Добавьте описание персонажей и/или 3-актную структуру сюжета",
                    detected_by=["narrative"],
                    affected_algorithms=["3.1"],
                ))
            else:
                structure_score = 0.2
                issues.append(ValidationIssue(
                    severity="warning",
                    issue_type="narrative_structure",
                    area="narrative",
                    description="Нарративная структура отсутствует — нет ни сюжета, ни персонажей",
                    suggestion="Определите 3-актную структуру и ключевых персонажей",
                    detected_by=["narrative"],
                    affected_algorithms=["3.1"],
                ))

            # Проверка 4: Разнообразие квестов
            if has_quests:
                quest_types = set()
                quests = narrative.get("quests", [])
                if isinstance(quests, list):
                    for q in quests:
                        if isinstance(q, dict):
                            quest_types.add(q.get("type", "unknown"))
                        else:
                            quest_types.add("unknown")
                if len(quest_types) >= 3:
                    quest_variety_score = 0.8
                elif len(quest_types) >= 1:
                    quest_variety_score = 0.4
                    issues.append(ValidationIssue(
                        severity="info",
                        issue_type="quest_monotony",
                        area="narrative",
                        description=f"Мало типов квестов ({len(quest_types)}), рекомендуется ≥3",
                        suggestion="Добавить разнообразие: fetch/escort/defend/puzzle/boss/social",
                        detected_by=["narrative"],
                        affected_algorithms=["3.1"],
                    ))

        # Общая оценка
        scores_list = [agency_score, structure_score, quest_variety_score]
        if ludonarrative_result == "harmony":
            scores_list.append(1.0)
        elif ludonarrative_result == "irony":
            scores_list.append(0.7)
        elif ludonarrative_result == "dissonance":
            scores_list.append(0.1)
        overall = round(sum(scores_list) / max(len(scores_list), 1), 2)

        return NarrativeCheckResult(
            issues=issues,
            ludonarrative_result=ludonarrative_result,
            ludonarrative_details=ludonarrative_details,
            agency_score=round(agency_score, 2),
            agency_gaps=agency_gaps,
            structure_score=round(structure_score, 2),
            quest_variety_score=round(quest_variety_score, 2),
            overall_narrative_score=overall,
        )

    # ================================================================
    # ЭТАП 5: ЭКОНОМИКА-ЧЕК (3.8.7)
    # ================================================================

    async def _run_economy_check(
        self,
        input_data: ChecklistInput,
        scope: ValidationScope,
    ) -> EconomyCheckResult:
        """Проверка экономики: патологии, faucet/drain, стабильность."""
        economy = input_data.economy_profile
        if not economy or not isinstance(economy, dict):
            return EconomyCheckResult(
                skipped=True,
                skip_reason="Нет данных экономики (Блок 5 не заполнен)",
            )

        issues: list[ValidationIssue] = []
        suggestions: list[str] = []
        runaway_detected = False
        deadlock_detected = False
        q_factors: list[QFactorInfo] = []
        stability_passed = True

        # Проверка 1: Runaway
        pathologies = economy.get("pathologies", [])
        pathology_types = [p.get("type", "") for p in pathologies if isinstance(p, dict)]

        if "runaway" in pathology_types:
            runaway_detected = True
            issues.append(ValidationIssue(
                severity="critical",
                issue_type="economic_runaway",
                area="economy",
                description="Обнаружен runaway — неограниченный рост ресурсов",
                suggestion="Добавить Dynamic Friction, Stopping Mechanism или Attrition (Адамс/Дорманс)",
                detected_by=["economy"],
                affected_algorithms=["3.6", "3.2"],
            ))
        elif economy.get("runaway_risk"):
            runaway_detected = True
            issues.append(ValidationIssue(
                severity="critical",
                issue_type="runaway_risk",
                area="economy",
                description="Высокий риск runaway — Core Loop без тормозящих механизмов",
                suggestion="Добавить тормозящий механизм в Core Loop или ограничить рост ресурсов",
                detected_by=["economy"],
                affected_algorithms=["3.6", "3.2"],
            ))

        # Проверка 2: Deadlock
        if "deadlock" in pathology_types:
            deadlock_detected = True
            issues.append(ValidationIssue(
                severity="critical",
                issue_type="economic_deadlock",
                area="economy",
                description="Обнаружен deadlock — тупик с истощением ресурсов",
                suggestion="Добавить альтернативные источники ресурсов или emergency faucet",
                detected_by=["economy"],
                affected_algorithms=["3.6"],
            ))

        # Проверка 3: Q-фактор (faucet/drain)
        resource_model = economy.get("resource_model", {})
        core_resources = resource_model.get("core_resources", [])
        if isinstance(core_resources, list):
            for res in core_resources:
                if not isinstance(res, dict):
                    continue
                faucet = res.get("faucet_rate", 0) or res.get("faucet", 0)
                drain = res.get("drain_rate", 0) or res.get("drain", 0)
                if drain > 0:
                    q = faucet / drain
                elif faucet > 0:
                    q = 10.0  # no drain = infinite accumulation
                else:
                    q = 1.0

                if q > 1.5:
                    status = "inflation"
                    issues.append(ValidationIssue(
                        severity="warning",
                        issue_type="resource_inflation",
                        area="economy",
                        description=f"Ресурс '{res.get('name', 'unknown')}' — инфляция (Q={q:.1f})",
                        suggestion="Увеличить drain или уменьшить faucet",
                        detected_by=["economy"],
                        affected_algorithms=["3.6"],
                    ))
                elif q < 0.7:
                    status = "scarcity"
                    issues.append(ValidationIssue(
                        severity="warning",
                        issue_type="resource_scarcity",
                        area="economy",
                        description=f"Ресурс '{res.get('name', 'unknown')}' — дефицит (Q={q:.1f})",
                        suggestion="Увеличить faucet или уменьшить drain",
                        detected_by=["economy"],
                        affected_algorithms=["3.6"],
                    ))
                else:
                    status = "balanced"

                q_factors.append(QFactorInfo(
                    resource_name=res.get("name", "unknown"),
                    q_factor=round(q, 2),
                    status=status,
                ))

        # Проверка 5: Циклы конверсии (упрощённая)
        conversion_chains = economy.get("conversion_chains", [])
        if isinstance(conversion_chains, list):
            for chain in conversion_chains:
                if not isinstance(chain, dict):
                    continue
                profitability = chain.get("profitability", 1.0)
                if profitability > 2.0:
                    stability_passed = False
                    issues.append(ValidationIssue(
                        severity="warning",
                        issue_type="excessive_profitability",
                        area="economy",
                        description=f"Цепочка конверсии '{chain.get('name', '')}' — чрезмерная прибыльность ({profitability:.1f}x)",
                        suggestion="Снизить прибыльность цепочки для предотвращения доминантной стратегии",
                        detected_by=["economy"],
                        affected_algorithms=["3.6"],
                    ))
                elif profitability < 0.8 and profitability > 0:
                    issues.append(ValidationIssue(
                        severity="warning",
                        issue_type="unprofitable_cycle",
                        area="economy",
                        description=f"Цепочка конверсии '{chain.get('name', '')}' — убыточна ({profitability:.1f}x)",
                        suggestion="Увеличить прибыльность или убрать цепочку",
                        detected_by=["economy"],
                        affected_algorithms=["3.6"],
                    ))

        # Общая оценка
        score_parts = []
        if not runaway_detected:
            score_parts.append(0.3)
        if not deadlock_detected:
            score_parts.append(0.3)
        if q_factors:
            balanced_q = sum(1 for q in q_factors if q.status == "balanced") / len(q_factors)
            score_parts.append(balanced_q * 0.3)
        if stability_passed:
            score_parts.append(0.1)
        overall = round(sum(score_parts), 2)

        return EconomyCheckResult(
            issues=issues,
            suggestions=suggestions,
            runaway_detected=runaway_detected,
            deadlock_detected=deadlock_detected,
            q_factors=q_factors,
            stability_test_passed=stability_passed,
            overall_economy_score=overall,
        )

    # ================================================================
    # ЭТАП 6: ЛИНЗЫ ШЕЛЛА (3.8.8)
    # ================================================================

    async def _run_lens_check(
        self,
        input_data: ChecklistInput,
        scope: ValidationScope,
        profile: ValidationProfile,
    ) -> LensCheckResult:
        """Проверка линзами Шелла — адаптивная выборка."""
        # Шаг 6.1: Выбор релевантных линз
        lens_ids = list(BASE_LENSES)

        # Жанр-специфичные линзы
        genre = ""
        if input_data.concept and isinstance(input_data.concept, dict):
            genre = input_data.concept.get("genre", "").lower()
        genre_lenses = GENRE_LENS_MAP.get(genre, [])
        lens_ids.extend(genre_lenses)

        # Проблемно-ориентированные линзы
        existing_issues: list[ValidationIssue] = []
        for check in [profile.mda_check, profile.balance_check,
                      profile.narrative_check, profile.economy_check]:
            if check and hasattr(check, "issues"):
                existing_issues.extend(check.issues)

        for issue in existing_issues:
            extra = PROBLEM_LENS_MAP.get(issue.issue_type, [])
            lens_ids.extend(extra)

        # Дедупликация
        lens_ids = sorted(set(lens_ids))

        # Шаг 6.2: Применение каждой линзы (AI)
        results: list[LensResult] = []
        all_issues: list[ValidationIssue] = []
        critical_count = 0
        warning_count = 0
        passed_count = 0

        for lens_id in lens_ids[:20]:  # Ограничение на 20 линз
            try:
                lens_response = await self.executor.execute(
                    "APPLY_LENS_VAL",
                    inputs={
                        "lens_id": lens_id,
                        "concept": input_data.concept or {},
                        "core_loop": input_data.core_loop or {},
                        "mda_profile": input_data.mda_profile or {},
                        "balance_result": input_data.balance_result or {},
                        "progression_profile": input_data.progression_profile or {},
                        "economy_profile": input_data.economy_profile or {},
                    },
                )

                if lens_response and isinstance(lens_response, dict):
                    score = lens_response.get("score", 0.5)
                    results.append(LensResult(
                        lens_id=lens_id,
                        lens_name=lens_response.get("lens_name", f"Lens #{lens_id}"),
                        key_question=lens_response.get("key_question", ""),
                        answer=lens_response.get("answer", ""),
                        score=score,
                        issues=lens_response.get("issues", []),
                        suggestions=lens_response.get("suggestions", []),
                    ))

                    # Конвертировать score в severity
                    if score < 0.4:
                        severity: IssueSeverity = "critical"
                        critical_count += 1
                    elif score < 0.7:
                        severity = "warning"
                        warning_count += 1
                    else:
                        severity = "info"
                        passed_count += 1

                    if score < 0.7:
                        all_issues.append(ValidationIssue(
                            severity=severity,
                            issue_type="lens_check",
                            area="overall",
                            description=f"Линза #{lens_id} ({lens_response.get('lens_name', '')}): "
                                       f"{'; '.join(lens_response.get('issues', [])[:2])}",
                            suggestion="; ".join(lens_response.get("suggestions", [])[:2]),
                            detected_by=["lenses"],
                        ))
                else:
                    # AI не вернул результат — fallback
                    results.append(LensResult(
                        lens_id=lens_id,
                        lens_name=f"Lens #{lens_id}",
                        key_question="",
                        answer="AI не смог оценить данную линзу",
                        score=0.5,
                    ))
                    passed_count += 1

            except Exception as e:
                logger.warning(f"APPLY_LENS_VAL for lens #{lens_id} failed: {e}")
                results.append(LensResult(
                    lens_id=lens_id,
                    lens_name=f"Lens #{lens_id}",
                    key_question="",
                    answer=f"Ошибка при оценке: {e}",
                    score=0.5,
                ))
                passed_count += 1

        # Шаг 6.3: Агрегация
        scores = [r.score for r in results]
        overall = round(sum(scores) / max(len(scores), 1), 2) if scores else 0.0

        return LensCheckResult(
            applied_lenses=lens_ids[:20],
            results=results,
            issues=all_issues,
            critical_count=critical_count,
            warning_count=warning_count,
            passed_count=passed_count,
            overall_lens_score=overall,
        )

    # ================================================================
    # ЭТАП 7: АГРЕГАЦИЯ, ПРИОРИТИЗАЦИЯ, РЕМЕДИАЦИЯ (3.8.9)
    # ================================================================

    def _aggregate_results(self, profile: ValidationProfile) -> None:
        """Агрегация результатов всех чек-листов, приоритизация, план ремедиации."""
        # 1. Собрать все проблемы
        all_issues: list[ValidationIssue] = []
        for check in [profile.mda_check, profile.balance_check,
                      profile.narrative_check, profile.economy_check,
                      profile.lens_check]:
            if check and hasattr(check, "issues"):
                all_issues.extend(check.issues)

        # 2. Дедупликация по description similarity (упрощённая — по issue_type + area)
        seen_keys: dict[str, ValidationIssue] = {}
        for issue in all_issues:
            key = f"{issue.issue_type}|{issue.area}"
            if key in seen_keys:
                existing = seen_keys[key]
                # Upgrade severity if needed
                severity_order = {"info": 0, "warning": 1, "critical": 2}
                if severity_order.get(issue.severity, 0) > severity_order.get(existing.severity, 0):
                    existing.severity = issue.severity
                if issue.detected_by:
                    for d in issue.detected_by:
                        if d not in existing.detected_by:
                            existing.detected_by.append(d)
            else:
                seen_keys[key] = issue.model_copy()

        deduped_issues = list(seen_keys.values())

        # 3. Приоритизация
        severity_weights = {"critical": 3, "warning": 2, "info": 1}
        detection_bonus = 1.5  # если обнаружено несколькими чек-листами

        def priority_score(issue: ValidationIssue) -> float:
            base = severity_weights.get(issue.severity, 1)
            bonus = detection_bonus if len(issue.detected_by) > 1 else 1.0
            return base * bonus

        deduped_issues.sort(key=priority_score, reverse=True)

        # Ограничить количество проблем
        if len(deduped_issues) > 100:
            deduped_issues = deduped_issues[:100]

        profile.all_issues = deduped_issues

        # 4. Сводка
        critical = sum(1 for i in deduped_issues if i.severity == "critical")
        warning = sum(1 for i in deduped_issues if i.severity == "warning")
        info = sum(1 for i in deduped_issues if i.severity == "info")

        # Подсчёт по областям
        issues_by_area: dict[str, int] = {}
        for i in deduped_issues:
            issues_by_area[i.area] = issues_by_area.get(i.area, 0) + 1

        # Общая оценка (0-100)
        score_parts: list[float] = []
        if profile.mda_check and not profile.mda_check.skipped:
            score_parts.append(profile.mda_check.overall_mda_score * 100)
        if profile.balance_check and not profile.balance_check.skipped:
            score_parts.append(profile.balance_check.overall_balance_score * 100)
        if profile.narrative_check and not profile.narrative_check.skipped:
            score_parts.append(profile.narrative_check.overall_narrative_score * 100)
        if profile.economy_check and not profile.economy_check.skipped:
            score_parts.append(profile.economy_check.overall_economy_score * 100)
        if profile.lens_check and not profile.lens_check.skipped:
            score_parts.append(profile.lens_check.overall_lens_score * 100)

        overall_score = int(sum(score_parts) / max(len(score_parts), 1)) if score_parts else 0

        # Уровень готовности
        if overall_score >= 90:
            readiness: ReadinessLevel = "ready"
        elif overall_score >= 70:
            readiness = "nearly_ready"
        elif overall_score >= 50:
            readiness = "needs_work"
        else:
            readiness = "not_ready"

        # Оценка часов на исправление
        estimated_hours = critical * 8 + warning * 2 + info * 0.5

        profile.summary = ValidationSummary(
            overall_score=overall_score,
            readiness_level=readiness,
            total_issues=len(deduped_issues),
            critical_issues=critical,
            warning_issues=warning,
            info_issues=info,
            issues_by_area=issues_by_area,
            estimated_remediation_hours=round(estimated_hours, 1),
        )

        # 5. Топ-5 приоритетных проблем
        profile.top_priority_issues = deduped_issues[:5]

        # 6. Quick wins (severity >= warning, effort = low)
        profile.quick_wins = [
            i for i in deduped_issues
            if i.severity in ("warning", "critical")
        ][:5]

        # 7. План ремедиации
        remediation_plan = self._generate_remediation(deduped_issues)
        profile.remediation_plan = remediation_plan

        # 8. Флаги обновления
        profile.gdd_update_required = critical > 0 or warning > 3
        profile.revalidation_recommended = critical > 0

    def _generate_remediation(
        self,
        issues: list[ValidationIssue],
    ) -> list[RemediationItem]:
        """Генерация плана ремедиации из списка проблем."""
        severity_weights = {"critical": 3, "warning": 2, "info": 1}
        effort_map: dict[str, EffortLevel] = {
            "aesthetic_orphan": "medium",
            "dynamic_orphan": "medium",
            "mda_gap": "medium",
            "bond_dissonance": "high",
            "overpowered_elements": "low",
            "underpowered_elements": "low",
            "dominant_strategy": "high",
            "grind": "medium",
            "difficulty_wall": "medium",
            "empty_levels": "low",
            "ludonarrative_dissonance": "high",
            "ludonarrative_irony": "low",
            "agency_gap": "medium",
            "narrative_structure": "medium",
            "quest_monotony": "low",
            "economic_runaway": "high",
            "runaway_risk": "high",
            "economic_deadlock": "high",
            "resource_inflation": "medium",
            "resource_scarcity": "medium",
            "excessive_profitability": "medium",
            "unprofitable_cycle": "low",
            "lens_check": "medium",
        }

        hours_map: dict[EffortLevel, float] = {
            "low": 0.5,
            "medium": 2.0,
            "high": 12.0,
        }

        plan: list[RemediationItem] = []
        for idx, issue in enumerate(issues[:50]):
            effort = effort_map.get(issue.issue_type, "medium")
            plan.append(RemediationItem(
                issue_id=f"ISSUE-{idx + 1:03d}",
                issue_description=issue.description,
                correction=issue.suggestion,
                estimated_effort=effort,
                hours_estimate=hours_map[effort],
                affected_algorithms=issue.affected_algorithms,
                blocking_issues=[],
                suggested_order=idx + 1,
                severity=issue.severity,
            ))

        return plan
