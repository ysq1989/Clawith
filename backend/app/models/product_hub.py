"""Product Hub (选品中心) models.

Core tables:
  - ProductHubSupplyChain     : Supply chain source configs (admin-only, disguised as vendor names)
  - ProductHubCategory        : Product category tree (tenant-scoped)
  - ProductHubProduct         : Cleaned products in the public selection pool
  - ProductHubCrawlTask       : Crawl task records (admin-only)
  - ProductHubUserPool        : User's personal selection pool
  - ProductHubUserPoolItem    : Products in a user's pool
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductHubSupplyChain(Base):
    """Supply chain source configuration (admin-only).

    Maps an internal crawl source (e.g. WeChat business album) to a
    user-facing display name (e.g. "华南女装供应链").
    """

    __tablename__ = "product_hub_supply_chains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # ── User-facing fields ──
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Internal fields (admin only) ──
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False, default="weixin_album")
    crawl_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # crawl_config example:
    # {
    #     "base_url": "https://...",
    #     "shop_id": "xxx",
    #     "categories": ["女装", "连衣裙"],
    #     "schedule": "0 6 * * *",
    #     "max_pages": 20
    # }

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_crawl_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    products_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class ProductHubCategory(Base):
    """Product category tree (supports hierarchy)."""

    __tablename__ = "product_hub_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProductHubProduct(Base):
    """Public product selection pool — cleaned and classified products."""

    __tablename__ = "product_hub_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )

    # ── Internal fields (admin only — not exposed to users) ──
    _source_url: Mapped[str | None] = mapped_column("source_url", String(500), nullable=True)
    _source_shop_name: Mapped[str | None] = mapped_column("source_shop_name", String(200), nullable=True)
    _source_shop_id: Mapped[str | None] = mapped_column("source_shop_id", String(100), nullable=True)
    _crawl_task_id: Mapped[uuid.UUID | None] = mapped_column(
        "crawl_task_id", UUID(as_uuid=True), nullable=True
    )
    _supply_chain_id: Mapped[uuid.UUID | None] = mapped_column(
        "supply_chain_id",
        UUID(as_uuid=True),
        ForeignKey("product_hub_supply_chains.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── User-visible fields ──
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    original_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    images: Mapped[list] = mapped_column(JSON, default=list)
    main_image: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Classification (auto-populated by LLM cleaning) ──
    supply_chain_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_hub_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    tags: Mapped[list] = mapped_column(JSON, default=list)
    clean_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Status ──
    status: Mapped[str] = mapped_column(String(20), default="active")  # active / archived

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_product_hub_products_tenant_category", "tenant_id", "category_id"),
        Index("ix_product_hub_products_tenant_status", "tenant_id", "status"),
    )


class ProductHubCrawlTask(Base):
    """Crawl task records — admin-only."""

    __tablename__ = "product_hub_crawl_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # ── Crawl config ──
    supply_chain_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_hub_supply_chains.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    crawl_config: Mapped[dict] = mapped_column(JSON, default=dict)

    # ── Status ──
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / running / done / failed
    products_count: Mapped[int] = mapped_column(Integer, default=0)
    clean_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProductHubUserPool(Base):
    """User's personal selection pool — products selected by the user/agent."""

    __tablename__ = "product_hub_user_pools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class ProductHubUserPoolItem(Base):
    """Products in a user's personal pool."""

    __tablename__ = "product_hub_user_pool_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_hub_user_pools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_hub_products.id", ondelete="CASCADE"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    selected_by_agent: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
