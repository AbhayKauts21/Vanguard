"""create document integration tables

Revision ID: 20260327_0002
Revises: 20260322_0001
Create Date: 2026-03-27 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_0002"
down_revision = "20260322_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_sources",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("source_key", sa.String(length=128), nullable=False),
        sa.Column("provider_type", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source_key", name="uq_document_sources_source_key"),
    )
    op.create_index(
        "ix_document_sources_provider_type",
        "document_sources",
        ["provider_type"],
        unique=False,
    )

    op.create_table(
        "normalized_documents",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("source_id", sa.Uuid(), sa.ForeignKey("document_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_uid", sa.String(length=255), nullable=False),
        sa.Column("external_document_id", sa.String(length=255), nullable=False),
        sa.Column("external_parent_id", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("container_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("content_format", sa.String(length=32), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=False),
        sa.Column("provider_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("access_scope", sa.JSON(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("document_uid", name="uq_normalized_documents_document_uid"),
        sa.UniqueConstraint(
            "source_id",
            "external_document_id",
            name="uq_normalized_documents_source_external_document_id",
        ),
    )
    op.create_index(
        "ix_normalized_documents_source_deleted",
        "normalized_documents",
        ["source_id", "is_deleted"],
        unique=False,
    )
    op.create_index(
        "ix_normalized_documents_provider_updated_at",
        "normalized_documents",
        ["provider_updated_at"],
        unique=False,
    )

    op.create_table(
        "document_sync_runs",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("source_id", sa.Uuid(), sa.ForeignKey("document_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("documents_seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("documents_upserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("documents_skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("documents_deleted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("documents_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_detail", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_document_sync_runs_source_started_at",
        "document_sync_runs",
        ["source_id", "started_at"],
        unique=False,
    )
    op.create_index(
        "ix_document_sync_runs_status",
        "document_sync_runs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_document_sync_runs_status", table_name="document_sync_runs")
    op.drop_index("ix_document_sync_runs_source_started_at", table_name="document_sync_runs")
    op.drop_table("document_sync_runs")

    op.drop_index("ix_normalized_documents_provider_updated_at", table_name="normalized_documents")
    op.drop_index("ix_normalized_documents_source_deleted", table_name="normalized_documents")
    op.drop_table("normalized_documents")

    op.drop_index("ix_document_sources_provider_type", table_name="document_sources")
    op.drop_table("document_sources")
