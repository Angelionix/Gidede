"""
Gidede — AI Assistant Service
Фаза 4.D.6–4.D.7: Блок 7 — AI-ассистент

Реализация:
- Контекст проекта: автоматическая сборка из Project State
- Память сессии: хранение истории чата
- RAG: векторный поиск по базе знаний для цитирования
- Проактивные уведомления: обнаружение проблем в Project State
- Контекстные подсказки: модуль-специфичные рекомендации
- Чат: через PromptExecutor с streaming

Зависимости: 4.A.7 (PromptExecutor), 4.A.10 (RAG), 4.C.9 (Pipeline)
"""

import time
import uuid
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, AsyncIterator

from app.ai.executor import PromptExecutor, SYSTEM_PROMPT, build_context_prompt

logger = logging.getLogger(__name__)


# ============================================================
# Data Classes
# ============================================================

@dataclass
class ChatMessageRecord:
    """Запись одного сообщения в чате."""
    id: str
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: float
    metadata: dict = field(default_factory=dict)


@dataclass
class ChatSession:
    """Сессия чата с AI-ассистентом."""
    session_id: str
    user_id: str
    project_id: Optional[str]
    messages: list[ChatMessageRecord] = field(default_factory=list)
    created_at: float = 0.0
    updated_at: float = 0.0

    def __post_init__(self):
        if not self.created_at:
            self.created_at = time.time()
        if not self.updated_at:
            self.updated_at = time.time()


@dataclass
class ProactiveAlert:
    """Проактивное уведомление от AI-ассистента."""
    id: str
    alert_type: str  # "runaway" | "deadlock" | "dissonance" | "gap" | "suggestion"
    severity: str    # "info" | "warning" | "critical"
    block_id: int    # 1-8
    title: str
    description: str
    suggestion: str
    timestamp: float = 0.0

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = time.time()


@dataclass
class ContextualSuggestion:
    """Контекстная подсказка для конкретного блока."""
    block_id: int
    title: str
    description: str
    action: str        # "review" | "fix" | "generate" | "validate"
    priority: str      # "high" | "medium" | "low"
    data: dict = field(default_factory=dict)


@dataclass
class AssistantContext:
    """Полный контекст для AI-ассистента."""
    project_name: str = ""
    genre: str = ""
    aesthetic_profile: dict = field(default_factory=dict)
    core_loop: dict = field(default_factory=dict)
    mda_profile: dict = field(default_factory=dict)
    balance_result: dict = field(default_factory=dict)
    progression_profile: dict = field(default_factory=dict)
    economy_profile: dict = field(default_factory=dict)
    gdd_profile: dict = field(default_factory=dict)
    checklist_results: dict = field(default_factory=dict)
    block_status: dict = field(default_factory=dict)
    rag_context: str = ""

    def to_prompt_string(self) -> str:
        """Сериализация контекста для AI-промпта."""
        parts = []

        if self.project_name:
            parts.append(f"Проект: {self.project_name}")
        if self.genre:
            parts.append(f"Жанр: {self.genre}")

        if self.aesthetic_profile:
            aesthetics = self.aesthetic_profile.get("primary_aesthetics", [])
            if aesthetics:
                parts.append(f"Целевые эстетики: {', '.join(str(a) for a in aesthetics[:3])}")

        if self.core_loop:
            struct_type = self.core_loop.get("structural_type", "")
            if struct_type:
                parts.append(f"Core Loop тип: {struct_type}")
            steps = self.core_loop.get("steps", [])
            if steps:
                step_names = [s.get("name", "") for s in steps[:5]]
                parts.append(f"Шаги Core Loop: {', '.join(step_names)}")

        if self.mda_profile:
            mechanics = self.mda_profile.get("mechanics", [])
            if mechanics:
                parts.append(f"Ключевые механики: {', '.join(str(m) for m in mechanics[:5])}")

        if self.balance_result:
            balance_type = self.balance_result.get("balance_type", "")
            if balance_type:
                parts.append(f"Тип баланса: {balance_type}")
            issues = self.balance_result.get("issues", [])
            if issues:
                parts.append(f"Проблемы баланса: {len(issues)} выявлено")

        if self.progression_profile:
            total_levels = self.progression_profile.get("total_levels", 0)
            if total_levels:
                parts.append(f"Уровни прогрессии: {total_levels}")

        if self.economy_profile:
            resources = self.economy_profile.get("resource_model", {}).get("core", [])
            if resources:
                parts.append(f"Основные ресурсы: {', '.join(str(r) for r in resources[:5])}")

        if self.gdd_profile:
            gdd_format = self.gdd_profile.get("target_format", "")
            if gdd_format:
                parts.append(f"Формат GDD: {gdd_format}")

        if self.block_status:
            filled = [k for k, v in self.block_status.items() if v == "completed"]
            if filled:
                parts.append(f"Заполненные блоки: {', '.join(filled)}")

        if self.rag_context:
            parts.append(f"\nКонтекст из базы знаний:\n{self.rag_context}")

        if not parts:
            return "Контекст проекта: данные ещё не заполнены."

        return "\n".join(parts)


# ============================================================
# Block-specific suggestion templates
# ============================================================

BLOCK_SUGGESTION_TEMPLATES: dict[int, list[dict]] = {
    1: [
        {"title": "Уточнить жанр", "action": "generate", "priority": "high",
         "description": "Позвольте AI определить жанр автоматически или выберите из таксономии"},
        {"title": "Добавить референтные игры", "action": "review", "priority": "medium",
         "description": "Укажите игры, которые вдохновляют ваш проект — это поможет AI точнее подобрать механики"},
        {"title": "Проверить уникальность USP", "action": "validate", "priority": "high",
         "description": "Проверьте, что ваше УТП действительно уникально и не повторяет существующие игры"},
    ],
    2: [
        {"title": "Проверить патологии Core Loop", "action": "validate", "priority": "high",
         "description": "Запустите диагностику на 7 типов патологий (runaway, deadlock, stall и др.)"},
        {"title": "Уточнить иерархию петель", "action": "review", "priority": "medium",
         "description": "Проверьте, что микро- и мета-петли согласованы и образуют связную иерархию"},
        {"title": "Протестировать «30 секунд веселья»", "action": "validate", "priority": "high",
         "description": "Проверьте, что базовый цикл геймплея увлекателен с первых секунд"},
    ],
    3: [
        {"title": "Запустить Reverse MDA", "action": "generate", "priority": "high",
         "description": "Определите целевую эстетику и получите рекомендованные механики"},
        {"title": "Проверить лудонарративный диссонанс", "action": "validate", "priority": "high",
         "description": "Убедитесь, что нарратив и механики не противоречат друг другу"},
        {"title": "Применить линзы Шелла", "action": "validate", "priority": "medium",
         "description": "9 приоритетных линз помогут выявить слабые места дизайна"},
    ],
    4: [
        {"title": "Запустить transitive-анализ", "action": "generate", "priority": "high",
         "description": "Проверьте соотношение cost/power для всех элементов"},
        {"title": "Запустить Monte Carlo-симуляцию", "action": "generate", "priority": "high",
         "description": "Моделирование 1000+ боёв для проверки статистического баланса"},
        {"title": "Проверить доминантные стратегии", "action": "validate", "priority": "high",
         "description": "Убедитесь, что нет доминантной стратегии, исключающей другие варианты"},
    ],
    5: [
        {"title": "Проверить кривые прогрессии", "action": "validate", "priority": "high",
         "description": "Убедитесь, что XP, мощность, стоимость и сложность сбалансированы"},
        {"title": "Диагностика экономики", "action": "validate", "priority": "high",
         "description": "Проверьте на runaway, deadlock и дисбаланс faucets/drains"},
        {"title": "Синхронизировать прогрессию с экономикой", "action": "fix", "priority": "medium",
         "description": "Убедитесь, что экономические фазы соответствуют этапам прогрессии"},
    ],
    6: [
        {"title": "Сгенерировать GDD", "action": "generate", "priority": "high",
         "description": "Запустите генерацию GDD в выбранном формате из данных проекта"},
        {"title": "Запустить чек-листы", "action": "validate", "priority": "high",
         "description": "5 типов чек-листов: Линзы Шелла, MDA, баланс, нарратив, экономика"},
        {"title": "Экспортировать GDD", "action": "generate", "priority": "medium",
         "description": "Экспорт в PDF, DOCX, HTML или Markdown"},
    ],
    7: [
        {"title": "Спросить AI-ассистента", "action": "generate", "priority": "high",
         "description": "Задайте вопрос о геймдизайне — AI ответит с учётом контекста проекта"},
        {"title": "Получить рекомендации", "action": "generate", "priority": "medium",
         "description": "AI проанализирует текущее состояние проекта и предложит улучшения"},
    ],
    8: [
        {"title": "Настроить подключение GBE", "action": "fix", "priority": "medium",
         "description": "Введите API-ключ и URL GBE-инстанса для синхронизации"},
        {"title": "Синхронизировать с GBE", "action": "generate", "priority": "low",
         "description": "Экспорт/импорт данных между Gidede и GDCombine Blueprint Editor"},
    ],
}


# ============================================================
# AI Assistant Service
# ============================================================

class AIAssistantService:
    """
    Блок 7: AI-ассистент Gidede.

    Реализует:
    - build_assistant_context() — сборка контекста из Project State
    - manage_session() — управление сессиями чата
    - search_knowledge() — RAG-поиск по базе знаний
    - check_proactive_alerts() — проактивные уведомления
    - generate_suggestions() — контекстные подсказки по блокам
    - chat() — чат с AI с streaming
    """

    # Максимальное количество сообщений в контексте чата
    MAX_CONTEXT_MESSAGES = 20

    # TTL сессии в секундах (24 часа)
    SESSION_TTL = 86400

    def __init__(self, executor: PromptExecutor):
        self.executor = executor
        # In-memory хранилище сессий (fallback если Redis недоступен)
        self._sessions: dict[str, ChatSession] = {}

    # ========================================================
    # Контекст проекта (4.D.6)
    # ========================================================

    async def build_assistant_context(
        self,
        project_state: Optional[dict] = None,
        include_rag: bool = True,
    ) -> AssistantContext:
        """
        Сборка контекста AI-ассистента из Project State.

        Извлекает данные из всех 6 блоков и формирует
        структурированный контекст для AI-промпта.

        Args:
            project_state: Полное состояние проекта
            include_rag: Включить RAG-контекст

        Returns:
            AssistantContext с данными проекта
        """
        ctx = AssistantContext()

        if not project_state:
            return ctx

        # Извлечение данных из блоков
        concept = project_state.get("concept") or {}
        ctx.project_name = concept.get("title", project_state.get("name", ""))
        ctx.genre = concept.get("genre", "")

        if concept.get("aesthetic_profile"):
            ctx.aesthetic_profile = concept["aesthetic_profile"]

        core_loop = project_state.get("core_loop") or project_state.get("coreLoop") or {}
        if core_loop:
            ctx.core_loop = core_loop

        mda = project_state.get("mda") or project_state.get("mda_profile") or {}
        if mda:
            ctx.mda_profile = mda

        balance = project_state.get("balance") or project_state.get("balance_result") or {}
        if balance:
            ctx.balance_result = balance

        progression = project_state.get("progression") or project_state.get("progression_profile") or {}
        if progression:
            ctx.progression_profile = progression

        economy = project_state.get("economy") or project_state.get("economy_profile") or {}
        if economy:
            ctx.economy_profile = economy

        gdd = project_state.get("gdd") or project_state.get("gdd_profile") or {}
        if gdd:
            ctx.gdd_profile = gdd

        checklist = project_state.get("checklist") or project_state.get("checklist_results") or {}
        if checklist:
            ctx.checklist_results = checklist

        # Статус блоков
        pipeline_state = project_state.get("pipeline_state") or {}
        if pipeline_state:
            ctx.block_status = {
                k: v.get("status", "empty") if isinstance(v, dict) else "empty"
                for k, v in pipeline_state.items()
            }

        # RAG-контекст
        if include_rag and ctx.genre:
            ctx.rag_context = await self.search_knowledge(
                query=f"геймдизайн {ctx.genre} рекомендации",
                max_tokens=1500,
            )

        return ctx

    # ========================================================
    # Управление сессиями (4.D.6)
    # ========================================================

    async def manage_session(
        self,
        user_id: str,
        project_id: Optional[str] = None,
        action: str = "get_or_create",
    ) -> ChatSession:
        """
        Управление сессией чата.

        Args:
            user_id: ID пользователя
            project_id: ID проекта (опционально)
            action: "get_or_create" | "create" | "clear"

        Returns:
            ChatSession
        """
        session_key = f"{user_id}:{project_id or 'general'}"

        if action == "clear":
            if session_key in self._sessions:
                del self._sessions[session_key]
            return ChatSession(
                session_id=uuid.uuid4().hex[:12],
                user_id=user_id,
                project_id=project_id,
            )

        if action == "create":
            session = ChatSession(
                session_id=uuid.uuid4().hex[:12],
                user_id=user_id,
                project_id=project_id,
            )
            self._sessions[session_key] = session
            return session

        # get_or_create
        if session_key in self._sessions:
            session = self._sessions[session_key]
            session.updated_at = time.time()
            return session

        session = ChatSession(
            session_id=uuid.uuid4().hex[:12],
            user_id=user_id,
            project_id=project_id,
        )
        self._sessions[session_key] = session
        return session

    async def add_message(
        self,
        user_id: str,
        project_id: Optional[str],
        role: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> ChatMessageRecord:
        """Добавить сообщение в сессию чата."""
        session = await self.manage_session(user_id, project_id, "get_or_create")

        msg = ChatMessageRecord(
            id=uuid.uuid4().hex[:12],
            role=role,
            content=content,
            timestamp=time.time(),
            metadata=metadata or {},
        )

        session.messages.append(msg)
        session.updated_at = time.time()

        # Ограничиваем историю
        if len(session.messages) > self.MAX_CONTEXT_MESSAGES * 2:
            session.messages = session.messages[-self.MAX_CONTEXT_MESSAGES:]

        return msg

    async def get_chat_history(
        self,
        user_id: str,
        project_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[ChatMessageRecord]:
        """Получить историю чата."""
        session = await self.manage_session(user_id, project_id, "get_or_create")
        return session.messages[-limit:]

    # ========================================================
    # RAG-поиск (4.D.6)
    # ========================================================

    async def search_knowledge(
        self,
        query: str,
        max_tokens: int = 2000,
    ) -> str:
        """
        Векторный поиск по базе знаний для цитирования источников.

        Args:
            query: Поисковый запрос
            max_tokens: Максимум токенов контекста

        Returns:
            Строка с релевантным контекстом или пустая строка
        """
        try:
            from app.core.rag_service import get_rag_service
            rag_service = await get_rag_service()
            return await rag_service.enrich_prompt(
                query=query,
                max_context_tokens=max_tokens,
            )
        except Exception as e:
            logger.warning(f"RAG search failed in AI assistant: {e}")
            return ""

    # ========================================================
    # Проактивные уведомления (4.D.6)
    # ========================================================

    async def check_proactive_alerts(
        self,
        project_state: Optional[dict] = None,
    ) -> list[ProactiveAlert]:
        """
        Проверка Project State на наличие проблем.

        Обнаруживает:
        - Runaway в экономике
        - Deadlock/stall
        - Лудонарративный диссонанс
        - Пробелы в данных (gaps)
        - Дисбаланс

        Args:
            project_state: Полное состояние проекта

        Returns:
            Список ProactiveAlert
        """
        if not project_state:
            return []

        alerts: list[ProactiveAlert] = []

        # Проверка экономики
        economy = project_state.get("economy") or project_state.get("economy_profile") or {}
        if economy:
            diagnostics = economy.get("diagnostics", {})
            if diagnostics.get("runaway_detected"):
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="runaway",
                    severity="critical",
                    block_id=5,
                    title="Обнаружен runaway в экономике",
                    description="Ресурсы накапливаются быстрее, чем тратятся, что ведёт к инфляции",
                    suggestion="Увеличьте drains или уменьшите faucets. Проверьте ratio ресурсов.",
                ))

            if diagnostics.get("deadlock_detected"):
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="deadlock",
                    severity="critical",
                    block_id=5,
                    title="Обнаружен deadlock в экономике",
                    description="Игрок может застрять без необходимых ресурсов для продолжения",
                    suggestion="Добавьте альтернативные источники критических ресурсов или safety net.",
                ))

        # Проверка баланса
        balance = project_state.get("balance") or project_state.get("balance_result") or {}
        if balance:
            elements = balance.get("elements", [])
            overpowered = [e for e in elements if e.get("status") == "overpowered"]
            underpowered = [e for e in elements if e.get("status") == "underpowered"]

            if len(overpowered) > len(elements) * 0.2:
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="dissonance",
                    severity="warning",
                    block_id=4,
                    title="Слишком много переоценённых элементов",
                    description=f"{len(overpowered)} из {len(elements)} элементов переоценены",
                    suggestion="Пересмотрите cost-power ratio для переоценённых элементов.",
                ))

            if balance.get("has_dominant_strategy"):
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="dissonance",
                    severity="critical",
                    block_id=4,
                    title="Обнаружена доминантная стратегия",
                    description="Существует стратегия, которая доминирует над остальными",
                    suggestion="Ослабьте доминантную стратегию или усильте альтернативы.",
                ))

        # Проверка MDA
        mda = project_state.get("mda") or project_state.get("mda_profile") or {}
        if mda:
            if mda.get("ludonarrative_dissonance"):
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="dissonance",
                    severity="warning",
                    block_id=3,
                    title="Лудонарративный диссонанс",
                    description="Нарратив и механики противоречат друг другу",
                    suggestion="Приведите механики в соответствие с нарративом, или пересмотрите историю.",
                ))

        # Проверка Core Loop
        core_loop = project_state.get("core_loop") or project_state.get("coreLoop") or {}
        if core_loop:
            pathologies = core_loop.get("pathologies", [])
            for pathology in pathologies[:3]:
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="runaway" if pathology.get("type") == "runaway" else "gap",
                    severity="warning" if pathology.get("severity") != "critical" else "critical",
                    block_id=2,
                    title=f"Патология Core Loop: {pathology.get('type', 'unknown')}",
                    description=pathology.get("description", ""),
                    suggestion=pathology.get("recommendation", "Пересмотрите структуру Core Loop."),
                ))

        # Проверка пробелов в данных
        blocks_data = {
            1: bool(project_state.get("concept")),
            2: bool(core_loop),
            3: bool(mda),
            4: bool(balance),
            5: bool(economy or project_state.get("progression")),
            6: bool(project_state.get("gdd")),
        }
        for block_id, has_data in blocks_data.items():
            if not has_data:
                alerts.append(ProactiveAlert(
                    id=uuid.uuid4().hex[:8],
                    alert_type="gap",
                    severity="info",
                    block_id=block_id,
                    title=f"Блок {block_id} не заполнен",
                    description=f"Данные для Блока {block_id} отсутствуют — заполните их для улучшения качества рекомендаций",
                    suggestion=f"Перейдите на страницу Блока {block_id} и заполните данные.",
                ))

        # Сортировка по severity
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        alerts.sort(key=lambda a: severity_order.get(a.severity, 3))

        return alerts

    # ========================================================
    # Контекстные подсказки (4.D.7)
    # ========================================================

    async def generate_suggestions(
        self,
        block_id: int,
        project_state: Optional[dict] = None,
    ) -> list[ContextualSuggestion]:
        """
        Генерация контекстных подсказок для конкретного блока.

        Подсказки учитывают:
        - Текущее состояние проекта
        - Типичные проблемы данного блока
        - Рекомендации из базы знаний

        Args:
            block_id: ID блока (1-8)
            project_state: Состояние проекта

        Returns:
            Список ContextualSuggestion
        """
        suggestions: list[ContextualSuggestion] = []

        # Базовые подсказки из шаблона
        templates = BLOCK_SUGGESTION_TEMPLATES.get(block_id, [])
        for tpl in templates:
            suggestions.append(ContextualSuggestion(
                block_id=block_id,
                title=tpl["title"],
                description=tpl["description"],
                action=tpl["action"],
                priority=tpl["priority"],
            ))

        # Контекстные подсказки на основе Project State
        if project_state:
            context_suggestions = self._generate_context_suggestions(block_id, project_state)
            suggestions.extend(context_suggestions)

        return suggestions

    def _generate_context_suggestions(
        self,
        block_id: int,
        project_state: dict,
    ) -> list[ContextualSuggestion]:
        """Генерация подсказок на основе текущего состояния проекта."""
        suggestions: list[ContextualSuggestion] = []

        if block_id == 1:
            concept = project_state.get("concept") or {}
            if not concept.get("genre"):
                suggestions.append(ContextualSuggestion(
                    block_id=1, title="Определить жанр",
                    description="Жанр не указан — AI может определить его автоматически",
                    action="generate", priority="high",
                ))

        elif block_id == 2:
            core_loop = project_state.get("core_loop") or project_state.get("coreLoop") or {}
            if not core_loop:
                suggestions.append(ContextualSuggestion(
                    block_id=2, title="Создать Core Loop",
                    description="Core Loop не спроектирован — начните с определения структурного типа",
                    action="generate", priority="high",
                ))

        elif block_id == 3:
            mda = project_state.get("mda") or project_state.get("mda_profile") or {}
            if not mda:
                suggestions.append(ContextualSuggestion(
                    block_id=3, title="Запустить MDA-анализ",
                    description="MDA-профиль не создан — запустите Reverse MDA или Classic MDA",
                    action="generate", priority="high",
                ))

        elif block_id == 4:
            balance = project_state.get("balance") or project_state.get("balance_result") or {}
            if balance and balance.get("has_dominant_strategy"):
                suggestions.append(ContextualSuggestion(
                    block_id=4, title="Устранить доминантную стратегию",
                    description="Обнаружена доминантная стратегия — необходимо скорректировать баланс",
                    action="fix", priority="high",
                    data={"issue": "dominant_strategy"},
                ))

        elif block_id == 5:
            economy = project_state.get("economy") or project_state.get("economy_profile") or {}
            if economy and economy.get("diagnostics", {}).get("runaway_detected"):
                suggestions.append(ContextualSuggestion(
                    block_id=5, title="Исправить runaway",
                    description="Обнаружен runaway в экономике — увеличьте drains или уменьшите faucets",
                    action="fix", priority="high",
                    data={"issue": "runaway"},
                ))

        elif block_id == 6:
            gdd = project_state.get("gdd") or project_state.get("gdd_profile") or {}
            if not gdd:
                suggestions.append(ContextualSuggestion(
                    block_id=6, title="Сгенерировать GDD",
                    description="GDD ещё не сгенерирован — запустите генерацию из данных проекта",
                    action="generate", priority="high",
                ))

        return suggestions

    # ========================================================
    # Чат с AI (4.D.7)
    # ========================================================

    async def chat(
        self,
        message: str,
        user_id: str,
        project_id: Optional[str] = None,
        project_state: Optional[dict] = None,
        user_plan: str = "free",
    ) -> dict:
        """
        Чат с AI-ассистентом.

        Полный пайплайн:
        1. Сборка контекста проекта
        2. RAG-поиск
        3. Сохранение сообщения пользователя
        4. Вызов AI через PromptExecutor
        5. Сохранение ответа
        6. Возврат результата

        Args:
            message: Сообщение пользователя
            user_id: ID пользователя
            project_id: ID проекта
            project_state: Состояние проекта
            user_plan: План пользователя (free/pro)

        Returns:
            Dict с ответом AI и метаданными
        """
        start_time = time.time()

        # 1. Сохраняем сообщение пользователя
        await self.add_message(user_id, project_id, "user", message)

        # 2. Собираем контекст
        ctx = await self.build_assistant_context(project_state, include_rag=True)
        context_string = ctx.to_prompt_string()

        # 3. Получаем историю чата для контекста
        history = await self.get_chat_history(user_id, project_id, limit=self.MAX_CONTEXT_MESSAGES)

        # 4. Формируем сообщения для AI
        chat_history_str = self._format_chat_history(history[:-1])  # Исключаем текущее сообщение

        # 5. Вызов AI
        try:
            result = await self.executor.execute(
                prompt_id="AI_CHAT",
                inputs={
                    "message": message,
                    "chat_history": chat_history_str,
                },
                project_state=project_state,
                user_plan=user_plan,
            )

            # Извлекаем текстовый ответ
            if isinstance(result.data, dict):
                reply = result.data.get("reply", result.data.get("content", str(result.data)))
            elif isinstance(result.data, str):
                reply = result.data
            else:
                reply = str(result.data)

            # Источники из RAG
            sources = result.data.get("sources", []) if isinstance(result.data, dict) else []

            # 6. Сохраняем ответ
            await self.add_message(
                user_id, project_id, "assistant", reply,
                metadata={
                    "model": result.metadata.get("model", ""),
                    "provider": result.metadata.get("provider", ""),
                    "latency_ms": result.metadata.get("latency_ms", 0),
                },
            )

            latency_ms = int((time.time() - start_time) * 1000)

            return {
                "reply": reply,
                "sources": sources,
                "suggestions": self._extract_suggestions(reply),
                "model_used": result.metadata.get("model", ""),
                "provider": result.metadata.get("provider", ""),
                "latency_ms": latency_ms,
                "from_cache": result.metadata.get("from_cache", False),
            }

        except Exception as e:
            logger.error(f"AI chat failed: {e}")
            latency_ms = int((time.time() - start_time) * 1000)

            fallback_reply = (
                "Извините, не удалось получить ответ от AI-сервиса. "
                "Проверьте настройки провайдеров (z.ai, OpenAI, Anthropic или Ollama). "
                f"Ошибка: {str(e)}"
            )

            await self.add_message(user_id, project_id, "assistant", fallback_reply)

            return {
                "reply": fallback_reply,
                "sources": [],
                "suggestions": [],
                "model_used": "error",
                "provider": "error",
                "latency_ms": latency_ms,
                "from_cache": False,
            }

    async def chat_stream(
        self,
        message: str,
        user_id: str,
        project_id: Optional[str] = None,
        project_state: Optional[dict] = None,
        user_plan: str = "free",
    ) -> AsyncIterator[str]:
        """
        Streaming чат с AI-ассистентом (SSE).

        Возвращает токены по мере генерации.

        Args:
            message: Сообщение пользователя
            user_id: ID пользователя
            project_id: ID проекта
            project_state: Состояние проекта
            user_plan: План пользователя

        Yields:
            JSON-строки с токенами или финальным ответом
        """
        # Сохраняем сообщение пользователя
        await self.add_message(user_id, project_id, "user", message)

        # Для streaming используем обычный chat с эмуляцией
        # (реальный streaming требует поддержки от провайдеров)
        result = await self.chat(message, user_id, project_id, project_state, user_plan)

        # Отправляем финальный ответ как SSE-событие
        yield json.dumps({
            "type": "message",
            "content": result["reply"],
            "sources": result.get("sources", []),
            "suggestions": result.get("suggestions", []),
        }, ensure_ascii=False)

        yield json.dumps({
            "type": "done",
            "latency_ms": result.get("latency_ms", 0),
            "model_used": result.get("model_used", ""),
            "provider": result.get("provider", ""),
        }, ensure_ascii=False)

    # ========================================================
    # Helper методы
    # ========================================================

    def _format_chat_history(self, messages: list[ChatMessageRecord]) -> str:
        """Форматирование истории чата для контекста AI."""
        if not messages:
            return ""

        parts = []
        for msg in messages[-self.MAX_CONTEXT_MESSAGES:]:
            role_label = "Пользователь" if msg.role == "user" else "AI-ассистент"
            parts.append(f"{role_label}: {msg.content}")

        return "\n".join(parts)

    def _extract_suggestions(self, reply: str) -> list[str]:
        """Извлечение предложений из ответа AI."""
        suggestions = []

        # Простая эвристика: ищем фразы с рекомендациями
        markers = ["рекомендую", "предлагаю", "советую", "рекомендация:", "предложение:"]
        for line in reply.split("\n"):
            line = line.strip()
            if any(marker in line.lower() for marker in markers):
                suggestions.append(line)

        return suggestions[:5]  # Максимум 5 подсказок
