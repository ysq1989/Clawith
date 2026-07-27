"""WeChat Business Album (微商相册) models.

Core tables:
  - WecomAlbumAccount    : szwego account configuration (token, account info)
  - WecomAlbumSupplier   : Friends/vendors synced from szwego account
  - WecomAlbumProduct    : Products synced from suppliers' albums
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


class WecomAlbumAccount(Base):
    """szwego account configuration — one per tenant."""

    __tablename__ = "wecom_album_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # ── szwego credentials ──
    token: Mapped[str] = mapped_column(String(500), nullable=False)

    # ── Account info (auto-populated on connect) ──
    album_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    album_icon: Mapped[str | None] = mapped_column(String(500), nullable=True)
    album_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Sync settings ──
    product_sync_stale_hours: Mapped[int] = mapped_column(Integer, default=1)
    last_owner_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_product_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Status ──
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class WecomAlbumSupplier(Base):
    """Friends/vendors synced from szwego account.

    Each supplier maps to a szwego shop/owner (friend whose album is followed).
    """

    __tablename__ = "wecom_album_suppliers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wecom_album_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── szwego shop info ──
    external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    shop_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    album_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Stats ──
    total_products: Mapped[int] = mapped_column(Integer, default=0)
    new_products: Mapped[int] = mapped_column(Integer, default=0)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Pricing ──
    discount: Mapped[float] = mapped_column(Float, default=1.0)

    # ── Status ──
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_wecom_album_suppliers_tenant_external", "tenant_id", "external_id", unique=True),
    )


class WecomAlbumProduct(Base):
    """Products synced from suppliers' albums."""

    __tablename__ = "wecom_album_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wecom_album_suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── szwego item info ──
    goods_id: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    images: Mapped[list] = mapped_column(JSON, default=list)
    main_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Shop context ──
    shop_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    shop_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Metadata ──
    tags: Mapped[list] = mapped_column(JSON, default=list)
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    szwego_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── AI cleaning ──
    clean_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    clean_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ai_cleaned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Sync tracking ──
    source_hash: Mapped[str | None] = mapped_column(String(40), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_wecom_album_products_tenant_goods", "tenant_id", "goods_id", unique=True),
        Index("ix_wecom_album_products_tenant_supplier", "tenant_id", "supplier_id"),
    )
