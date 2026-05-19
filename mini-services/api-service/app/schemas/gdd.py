"""
Gidede — GDD Schemas (Pydantic Models)
Фаза 4.D.1–4.D.2: Схемы для Блока 6 — GDD Generator (алгоритм 3.7, Этапы 1–5)

Модели синхронизированы со спецификацией алгоритма 3.7.

Алгоритм 3.7:
- Этап 1: Определение формата GDD → GDDFormatSpec (3.7.3)
- Этап 2: Маппинг Project State → секции GDD → GDDDataMapping (3.7.4)
- Этап 3: Автозаполнение секций → AutoFilledSections (3.7.5)
- Этап 4: AI-генерация и обогащение → AIEnrichedSections (3.7.6)
- Этап 5: Ручные секции и подсказки → ManualSectionsResult (3.7.7)
(Этапы 6–8 будут реализованы в 4.D.3)
"""

from pydantic import BaseModel, Field
from typing import Any, Optional, Literal


# ============================================================
# ТИПЫ ФОРМАТОВ GDD (алгоритм 3.7.3)
# ============================================================

GDDFormat = Literal[
    'one_sheet', 'ten_pager', 'treatment', 'sketch_design',
    'full_gdd', 'concept_doc', 'narrative_bible', 'modular',
]

DocAudience = Literal[
    'investor', 'team_sync', 'production', 'personal', 'educational',
]

DetailLevel = Literal['overview', 'standard', 'detailed', 'exhaustive']


# ============================================================
# ЭТАП 1: СПЕЦИФИКАЦИЯ ФОРМАТА GDD (алгоритм 3.7.3)
# ============================================================

class GDDFormatSpec(BaseModel):
    """Спецификация формата GDD — результат Этапа 1 (алгоритм 3.7.3)."""
    format: GDDFormat = Field(
        'full_gdd',
        description="Формат GDD: one_sheet/ten_pager/treatment/sketch_design/full_gdd/concept_doc/narrative_bible/modular",
    )
    detail_level: DetailLevel = Field(
        'standard',
        description="Уровень детализации: overview/standard/detailed/exhaustive",
    )
    sections: list[str] = Field(
        default_factory=list,
        description="Список секций GDD для данного формата",
    )
    estimated_pages: int = Field(
        0,
        description="Оценка количества страниц",
    )
    audience: Optional[DocAudience] = Field(
        None,
        description="Целевая аудитория документа: investor/team_sync/production/personal/educational",
    )
    export_formats: list[str] = Field(
        default_factory=lambda: ['pdf', 'md'],
        description="Форматы экспорта: pdf/md/html/docx",
    )


# ============================================================
# ЭТАП 2: МАППИНГ ПРОЕКТНОГО СОСТОЯНИЯ → СЕКЦИИ GDD (3.7.4)
# ============================================================

class SectionMapping(BaseModel):
    """Маппинг секции GDD на данные Project State."""
    source: str = Field(
        "",
        description="Источник данных: e.g., 'concept.title', 'coreLoop', 'mdaProfile.aesthetics'",
    )
    auto_fill: bool = Field(
        False,
        description="Можно ли автозаполнить из Project State",
    )
    ai_enrich: bool = Field(
        False,
        description="Требуется AI-обогащение (Этап 4)",
    )
    ai_generate: bool = Field(
        False,
        description="Требуется AI-генерация (Этап 4)",
    )
    ai_suggest: bool = Field(
        False,
        description="AI может предложить варианты",
    )
    manual: bool = Field(
        False,
        description="Требуется ручное заполнение",
    )
    diagram: bool = Field(
        False,
        description="Содержит диаграмму",
    )
    tables: bool = Field(
        False,
        description="Содержит таблицы",
    )
    formulas: bool = Field(
        False,
        description="Содержит формулы",
    )


class SectionReadiness(BaseModel):
    """Статус готовности секции GDD."""
    status: Literal['ready', 'ai_generatable', 'ai_suggestable', 'manual_required'] = Field(
        'manual_required',
        description="Статус готовности: ready/ai_generatable/ai_suggestable/manual_required",
    )
    coverage: float = Field(
        0.0,
        description="Уровень покрытия данных (0.0–1.0)",
    )
    auto_fillable: bool = Field(
        False,
        description="Можно ли автозаполнить из имеющихся данных",
    )


class GDDDataMapping(BaseModel):
    """Маппинг Project State → секции GDD — результат Этапа 2 (алгоритм 3.7.4)."""
    format_spec: GDDFormatSpec = Field(
        default_factory=GDDFormatSpec,
        description="Спецификация формата (из Этапа 1)",
    )
    active_mappings: dict[str, SectionMapping] = Field(
        default_factory=dict,
        description="Активные маппинги: section_name → SectionMapping",
    )
    section_readiness: dict[str, SectionReadiness] = Field(
        default_factory=dict,
        description="Готовность секций: section_name → SectionReadiness",
    )
    auto_fillable_sections: list[str] = Field(
        default_factory=list,
        description="Секции, доступные для автозаполнения",
    )
    manual_sections: list[str] = Field(
        default_factory=list,
        description="Секции, требующие ручного заполнения",
    )
    ai_generatable_sections: list[str] = Field(
        default_factory=list,
        description="Секции, доступные для AI-генерации",
    )
    coverage_score: float = Field(
        0.0,
        description="Общий уровень покрытия (0.0–1.0)",
    )


# ============================================================
# ЭТАП 3: АВТОЗАПОЛНЕННЫЕ СЕКЦИИ (алгоритм 3.7.5)
# ============================================================

class SectionContent(BaseModel):
    """Содержимое заполненной секции GDD."""
    content: str = Field(
        "",
        description="Текстовое содержимое секции в Markdown",
    )
    source: str = Field(
        "",
        description="Источник данных: auto_fill/ai_generate/manual",
    )
    auto_filled: bool = Field(
        True,
        description="Автозаполнена ли секция",
    )
    diagram: Optional[str] = Field(
        None,
        description="Markdown-представление диаграммы (если есть)",
    )
    tables: Optional[list[dict]] = Field(
        None,
        description="Таблицы секции в виде списка dict",
    )
    formulas: Optional[list[str]] = Field(
        None,
        description="Формулы секции",
    )
    requires_review: bool = Field(
        False,
        description="Требует ли секция ревью пользователем",
    )


class AutoFilledSections(BaseModel):
    """Автозаполненные секции GDD — результат Этапа 3 (алгоритм 3.7.5)."""
    sections: dict[str, SectionContent] = Field(
        default_factory=dict,
        description="Заполненные секции: section_name → SectionContent",
    )
    count: int = Field(
        0,
        description="Количество автозаполненных секций",
    )
    total_coverage: float = Field(
        0.0,
        description="Общий уровень покрытия после автозаполнения (0.0–1.0)",
    )


# ============================================================
# ВХОДНЫЕ ДАННЫЕ
# ============================================================

class GDDGenerationInput(BaseModel):
    """Входные данные для генерации GDD (алгоритм 3.7)."""
    concept: Optional[dict] = Field(
        None,
        description="Концепт игры (из Блока 1): жанр, эстетика, платформа, ЦА",
    )
    core_loop: Optional[dict] = Field(
        None,
        description="Профиль Core Loop (из Блока 2): структурный тип, петли, ресурсы",
    )
    mda_profile: Optional[dict] = Field(
        None,
        description="MDA-профиль (из Блока 3): механики, динамики, эстетика",
    )
    balance_result: Optional[dict] = Field(
        None,
        description="Результат балансировки (из Блока 4): кривые cost-power",
    )
    progression_profile: Optional[dict] = Field(
        None,
        description="Профиль прогрессии (из Блока 5): кривые, тиры, контент-план",
    )
    economy_profile: Optional[dict] = Field(
        None,
        description="Профиль экономики (из Блока 5): ресурсы, Machinations, патологии",
    )
    target_format: Optional[GDDFormat] = Field(
        None,
        description="Целевой формат GDD. Если не задан — определяется эвристически.",
    )
    target_audience_doc: Optional[DocAudience] = Field(
        None,
        description="Целевая аудитория документа. Если не задана — определяется по проекту.",
    )
    detail_level: Optional[DetailLevel] = Field(
        None,
        description="Уровень детализации. Если не задан — определяется по жанру.",
    )
    custom_sections: Optional[list[str]] = Field(
        None,
        description="Дополнительные секции (помимо стандартных для формата)",
    )
    excluded_sections: Optional[list[str]] = Field(
        None,
        description="Секции, исключённые из GDD",
    )
    language: str = Field(
        "ru",
        description="Язык документа: ru/en",
    )
    project_stage: Optional[str] = Field(
        None,
        description="Стадия проекта: concept/prototype/preproduction/production/live_ops",
    )


# ============================================================
# ОГРАНИЧЕНИЯ
# ============================================================

class GDDConstraints(BaseModel):
    """Ограничения для генерации GDD."""
    max_pages: Optional[int] = Field(
        None,
        description="Максимальное количество страниц",
    )
    include_diagrams: bool = Field(
        True,
        description="Включать ли диаграммы",
    )
    include_formulas: bool = Field(
        True,
        description="Включать ли формулы",
    )
    include_tables: bool = Field(
        True,
        description="Включать ли таблицы",
    )
    citation_style: str = Field(
        "footnote",
        description="Стиль цитирования: footnote/endnote/inline",
    )
    export_formats: list[str] = Field(
        default_factory=lambda: ['pdf', 'md', 'html'],
        description="Форматы экспорта: pdf/md/html/docx",
    )


# ============================================================
# ЭТАП 4: AI-ОБОГАЩЁННЫЕ СЕКЦИИ (алгоритм 3.7.6)
# ============================================================

class AIEnrichedSections(BaseModel):
    """AI-обогащённые секции GDD — результат Этапа 4 (алгоритм 3.7.6)."""
    enriched_sections: dict[str, SectionContent] = Field(
        default_factory=dict,
        description="Обогащённые секции (enrich): section_name → SectionContent",
    )
    generated_sections: dict[str, SectionContent] = Field(
        default_factory=dict,
        description="Сгенерированные с нуля секции: section_name → SectionContent",
    )
    enriched_count: int = Field(
        0,
        description="Количество обогащённых секций",
    )
    generated_count: int = Field(
        0,
        description="Количество сгенерированных секций",
    )
    failed_sections: list[str] = Field(
        default_factory=list,
        description="Секции, для которых AI-генерация не удалась",
    )
    total_coverage: float = Field(
        0.0,
        description="Общий уровень покрытия после AI-генерации",
    )


# ============================================================
# ЭТАП 5: РУЧНЫЕ СЕКЦИИ С ПОДСКАЗКАМИ (алгоритм 3.7.7)
# ============================================================

SectionPriority = Literal['critical', 'important', 'optional']


class ManualSectionSkeleton(BaseModel):
    """Скелет ручной секции с AI-подсказками."""
    section_name: str = Field(
        "",
        description="Название секции GDD",
    )
    priority: SectionPriority = Field(
        'important',
        description="Приоритет секции: critical/important/optional",
    )
    template: str = Field(
        "",
        description="Шаблон-скелет секции в Markdown с плейсхолдерами",
    )
    hints: list[str] = Field(
        default_factory=list,
        description="AI-подсказки для заполнения секции",
    )
    estimated_effort: str = Field(
        "medium",
        description="Оценка трудоёмкости: low/medium/high",
    )


class ManualSectionsResult(BaseModel):
    """Ручные секции с подсказками — результат Этапа 5 (алгоритм 3.7.7)."""
    skeletons: dict[str, ManualSectionSkeleton] = Field(
        default_factory=dict,
        description="Скелеты секций: section_name → ManualSectionSkeleton",
    )
    critical_sections: list[str] = Field(
        default_factory=list,
        description="Секции с приоритетом critical",
    )
    important_sections: list[str] = Field(
        default_factory=list,
        description="Секции с приоритетом important",
    )
    optional_sections: list[str] = Field(
        default_factory=list,
        description="Секции с приоритетом optional",
    )
    total_manual_count: int = Field(
        0,
        description="Общее количество ручных секций",
    )
    failed_sections: list[str] = Field(
        default_factory=list,
        description="Секции, для которых генерация подсказок не удалась",
    )


# ============================================================
# ИТОГОВЫЙ ПРОФИЛЬ GDD
# ============================================================

class GDDProfile(BaseModel):
    """
    Полный профиль GDD — результат алгоритма 3.7 (Этапы 1–5+).

    Включает:
    - format_spec: Спецификация формата (Этап 1)
    - data_mapping: Маппинг Project State → секции (Этап 2)
    - auto_filled_sections: Автозаполненные секции (Этап 3)
    - ai_enriched_sections: AI-обогащённые секции (Этап 4)
    - manual_skeletons: Скелеты ручных секций (Этап 5)
    - stages_completed: Завершённые этапы
    - coverage_score: Общий уровень покрытия
    - latency_ms: Время выполнения
    """
    format_spec: GDDFormatSpec = Field(
        default_factory=GDDFormatSpec,
        description="Спецификация формата GDD (Этап 1)",
    )
    data_mapping: Optional[GDDDataMapping] = Field(
        None,
        description="Маппинг Project State → секции (Этап 2)",
    )
    auto_filled_sections: Optional[AutoFilledSections] = Field(
        None,
        description="Автозаполненные секции (Этап 3)",
    )
    ai_enriched_sections: Optional[AIEnrichedSections] = Field(
        None,
        description="AI-обогащённые секции (Этап 4)",
    )
    manual_skeletons: Optional[ManualSectionsResult] = Field(
        None,
        description="Скелеты ручных секций с подсказками (Этап 5)",
    )
    stages_completed: list[int] = Field(
        default_factory=list,
        description="Завершённые этапы алгоритма 3.7",
    )
    coverage_score: float = Field(
        0.0,
        description="Общий уровень покрытия данных",
    )
    latency_ms: int = Field(
        0,
        description="Время выполнения (мс)",
    )
