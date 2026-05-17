"""add knowledge_chunks table + pgvector extension

Фаза 4.A.10: RAG — таблица knowledge_chunks с векторным поиском

Revision ID: a3f10b7c8d21
Revises: 8500d29c55e0
Create Date: 2026-05-18

Изменения:
- Включить расширение pgvector (CREATE EXTENSION IF NOT EXISTS vector)
- Создать таблицу knowledge_chunks для RAG
- Добавить колонку embedding vector(1536) для векторного поиска
- Создать IVFFlat-индекс для косинусного сходства
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "a3f10b7c8d21"
down_revision = "8500d29c55e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Включить расширение pgvector
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Создать таблицу knowledge_chunks
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_name", sa.String(255), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("embedding", sa.Text(), nullable=True),  # Временно Text, потом vector
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Индексы
    op.create_index("ix_knowledge_source", "knowledge_chunks", ["source_type", "source_name"])
    op.create_index("ix_knowledge_chunk_idx", "knowledge_chunks", ["source_name", "chunk_index"])
    op.create_index("ix_knowledge_chunks_source_type", "knowledge_chunks", ["source_type"])
    op.create_index("ix_knowledge_chunks_source_name", "knowledge_chunks", ["source_name"])

    # Заменить колонку embedding на vector(1536)
    op.execute("ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector")

    # Создать IVFFlat-индекс для косинусного поиска
    # (создаётся после загрузки данных, но создаём сразу для пустой БД)
    op.execute(
        """
        CREATE INDEX ix_knowledge_embedding ON knowledge_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_embedding", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunks_source_type", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunks_source_name", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunk_idx", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_source", table_name="knowledge_chunks")
    op.drop_table("knowledge_chunks")

    # Отключать pgvector при откате не стоит (может использоваться другими таблицами)
