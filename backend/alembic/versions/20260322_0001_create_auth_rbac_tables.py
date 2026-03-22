"""create auth and rbac tables

Revision ID: 20260322_0001
Revises: 
Create Date: 2026-03-22 00:00:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "20260322_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_roles_name"),
    )

    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    )

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("permission_id", sa.Uuid(), sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jti", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
    )

    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid()),
        sa.column("permission_id", sa.Uuid()),
    )

    created_at = datetime.now(timezone.utc)

    role_ids = {
        "admin": uuid4(),
        "operator": uuid4(),
        "developer": uuid4(),
        "viewer": uuid4(),
    }
    permission_ids = {
        "sync:manage": uuid4(),
        "rbac:manage": uuid4(),
        "users:read": uuid4(),
        "users:manage": uuid4(),
        "chat:use": uuid4(),
    }

    op.bulk_insert(
        roles_table,
        [
            {"id": role_ids["admin"], "name": "admin", "description": "Full platform administration.", "created_at": created_at},
            {"id": role_ids["operator"], "name": "operator", "description": "Operational sync management.", "created_at": created_at},
            {"id": role_ids["developer"], "name": "developer", "description": "Authenticated developer access.", "created_at": created_at},
            {"id": role_ids["viewer"], "name": "viewer", "description": "Read-only authenticated access.", "created_at": created_at},
        ],
    )

    op.bulk_insert(
        permissions_table,
        [
            {"id": permission_ids["sync:manage"], "code": "sync:manage", "description": "Trigger and monitor ingestion jobs.", "created_at": created_at},
            {"id": permission_ids["rbac:manage"], "code": "rbac:manage", "description": "Manage roles and permissions.", "created_at": created_at},
            {"id": permission_ids["users:read"], "code": "users:read", "description": "View user directory and role assignments.", "created_at": created_at},
            {"id": permission_ids["users:manage"], "code": "users:manage", "description": "Assign roles to users.", "created_at": created_at},
            {"id": permission_ids["chat:use"], "code": "chat:use", "description": "Use authenticated chat endpoints.", "created_at": created_at},
        ],
    )

    op.bulk_insert(
        role_permissions_table,
        [
            {"role_id": role_ids["admin"], "permission_id": permission_ids["sync:manage"]},
            {"role_id": role_ids["admin"], "permission_id": permission_ids["rbac:manage"]},
            {"role_id": role_ids["admin"], "permission_id": permission_ids["users:read"]},
            {"role_id": role_ids["admin"], "permission_id": permission_ids["users:manage"]},
            {"role_id": role_ids["admin"], "permission_id": permission_ids["chat:use"]},
            {"role_id": role_ids["operator"], "permission_id": permission_ids["sync:manage"]},
            {"role_id": role_ids["operator"], "permission_id": permission_ids["users:read"]},
            {"role_id": role_ids["operator"], "permission_id": permission_ids["chat:use"]},
            {"role_id": role_ids["developer"], "permission_id": permission_ids["chat:use"]},
            {"role_id": role_ids["viewer"], "permission_id": permission_ids["chat:use"]},
        ],
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("role_permissions")
    op.drop_table("user_roles")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
