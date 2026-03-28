"""add bookstack sync config

Revision ID: 20260329_0005
Revises: 5f612943e644
Create Date: 2026-03-29 10:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260329_0005"
down_revision = "5f612943e644"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bookstack_sync_config",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column(
            "source_id",
            sa.Uuid(),
            sa.ForeignKey("document_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("target_key", sa.String(length=64), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=True),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("page_id", sa.Integer(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source_id", "user_id", "target_key", name="uq_bookstack_sync_config_target"),
    )
    op.create_index(
        "ix_bookstack_sync_config_source_enabled",
        "bookstack_sync_config",
        ["source_id", "is_enabled"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_bookstack_sync_config_source_enabled", table_name="bookstack_sync_config")
    op.drop_table("bookstack_sync_config")
