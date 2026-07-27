"""WeChat Business Album (微商相册) REST API.

Route summary
─────────────
Admin:
  Account        GET/PUT /api/wecom-album/account
  Test           POST /api/wecom-album/test-connection
  Sync owners    POST /api/wecom-album/sync/suppliers
  Sync products  POST /api/wecom-album/sync/products
  Suppliers      GET /api/wecom-album/suppliers
  Products       GET/PATCH/DELETE /api/wecom-album/products/{id}

User:
  Suppliers      GET /api/wecom-album/suppliers
  Products       GET /api/wecom-album/products, GET /api/wecom-album/products/{id}
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user as _jwt_get_current_user
from app.database import async_session, get_db
from app.models.wecom_album import WecomAlbumAccount, WecomAlbumSupplier, WecomAlbumProduct
from app.services.wecom_album.szwego_client import WecomAlbumSzwegoClient
from app.services.wecom_album.sync_service import test_connection, sync_suppliers, sync_products

router = APIRouter(prefix="/api/wecom-album", tags=["wecom-album"])


# ─── Auth helpers ─────────────────────────────────────────────────────────────


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    """Accept X-Agent-Tenant-Id header (internal agent) or normal JWT."""
    agent_tid = request.headers.get("X-Agent-Tenant-Id")
    if agent_tid:

        class _AgentUser:
            tenant_id = uuid.UUID(agent_tid)

        return _AgentUser()

    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await _jwt_get_current_user(credentials, db)


async def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    """Require admin role."""
    user = await get_current_user(request, credentials, db)
    if not hasattr(user, "role") or user.role not in ("super_admin", "platform_admin", "org_admin"):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


# ─── Response helpers ─────────────────────────────────────────────────────────


def _account_to_out(account: WecomAlbumAccount) -> dict:
    return {
        "id": str(account.id),
        "token": account.token[:20] + "..." if account.token and len(account.token) > 20 else account.token,
        "album_name": account.album_name,
        "album_icon": account.album_icon,
        "album_id": account.album_id,
        "product_sync_stale_hours": account.product_sync_stale_hours,
        "last_owner_sync_at": account.last_owner_sync_at.isoformat() if account.last_owner_sync_at else None,
        "last_product_sync_at": account.last_product_sync_at.isoformat() if account.last_product_sync_at else None,
        "is_active": account.is_active,
        "last_error": account.last_error,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


def _supplier_to_out(s) -> dict:
    return {
        "id": str(s.id),
        "external_id": s.external_id,
        "shop_id": s.shop_id,
        "name": s.name,
        "avatar": s.avatar,
        "album_id": s.album_id,
        "total_products": s.total_products,
        "new_products": s.new_products,
        "discount": s.discount,
        "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _product_to_out(p) -> dict:
    return {
        "id": str(p.id),
        "supplier_id": str(p.supplier_id),
        "goods_id": p.goods_id,
        "title": p.title,
        "price": str(p.price) if p.price else None,
        "images": p.images or [],
        "main_image": p.main_image,
        "video_url": p.video_url,
        "shop_name": p.shop_name,
        "source_url": p.source_url,
        "tags": p.tags or [],
        "szwego_created_at": p.szwego_created_at.isoformat() if p.szwego_created_at else None,
        "synced_at": p.synced_at.isoformat() if p.synced_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _product_to_detail(p) -> dict:
    return {
        **_product_to_out(p),
        "shop_id": p.shop_id,
        "attributes": p.attributes or {},
    }


# ─── Request schemas ──────────────────────────────────────────────────────────


class AccountUpdate(BaseModel):
    token: str
    product_sync_stale_hours: int = 1


# ─── Account endpoints ────────────────────────────────────────────────────────


@router.get("/account")
async def get_account(request: Request, user=Depends(require_admin)):
    """Get the szwego account config for the tenant."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == user.tenant_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            return {"configured": False}
        return {"configured": True, **_account_to_out(account)}


@router.put("/account")
async def update_account(body: AccountUpdate, request: Request, user=Depends(require_admin)):
    """Create or update the szwego account config."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == user.tenant_id)
        )
        account = result.scalar_one_or_none()

        if account:
            account.token = body.token.strip()
            account.product_sync_stale_hours = body.product_sync_stale_hours
        else:
            account = WecomAlbumAccount(
                tenant_id=user.tenant_id,
                token=body.token.strip(),
                product_sync_stale_hours=body.product_sync_stale_hours,
            )
            db.add(account)

        # Test connection and save account info
        try:
            info = await test_connection(body.token.strip())
            account.album_name = info.get("album_name", "")
            account.album_icon = info.get("album_icon", "")
            account.album_id = str(info.get("album_id", ""))
            account.is_active = True
            account.last_error = None
        except Exception as e:
            logger.warning(f"[WecomAlbum] Token test failed on save: {e}")
            account.last_error = str(e)[:500]

        await db.commit()
        await db.refresh(account)

        return {"success": True, **_account_to_out(account)}


@router.post("/test-connection")
async def api_test_connection(request: Request, user=Depends(require_admin)):
    """Test szwego connection with the stored token."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == user.tenant_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=400, detail="未配置微商相册账号")

        try:
            info = await test_connection(account.token)
            return {
                "success": True,
                "album_name": info.get("album_name", ""),
                "album_icon": info.get("album_icon", ""),
                "album_id": str(info.get("album_id", "")),
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"连接失败: {e}")


# ─── Sync endpoints ───────────────────────────────────────────────────────────


@router.post("/sync/suppliers")
async def api_sync_suppliers(request: Request, user=Depends(require_admin)):
    """Sync suppliers (friends) from szwego account."""
    result = await sync_suppliers(user.tenant_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "同步失败"))
    return result


@router.post("/sync/products")
async def api_sync_products(request: Request, user=Depends(require_admin)):
    """Sync products from all active suppliers."""
    result = await sync_products(user.tenant_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "同步失败"))
    return result


# ─── Supplier endpoints ───────────────────────────────────────────────────────


@router.get("/suppliers")
async def list_suppliers(
    request: Request,
    keyword: str = Query("", description="Search keyword"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    """List suppliers (friends) for the tenant."""
    async with async_session() as db:
        base_q = select(WecomAlbumSupplier).where(WecomAlbumSupplier.tenant_id == user.tenant_id)

        if keyword:
            base_q = base_q.where(WecomAlbumSupplier.name.ilike(f"%{keyword}%"))

        # Total count
        count_q = select(func.count()).select_from(base_q.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        # Paginate
        q = base_q.order_by(WecomAlbumSupplier.name).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(q)
        suppliers = result.scalars().all()

        return {
            "items": [_supplier_to_out(s) for s in suppliers],
            "total": total,
            "page": page,
            "page_size": page_size,
        }


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: uuid.UUID,
    request: Request,
    user=Depends(require_admin),
):
    """Toggle supplier active status or update discount."""
    body = await request.json()
    is_active = body.get("is_active")
    discount = body.get("discount")

    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumSupplier).where(
                WecomAlbumSupplier.id == supplier_id,
                WecomAlbumSupplier.tenant_id == user.tenant_id,
            )
        )
        supplier = result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=404, detail="供应商不存在")

        if is_active is not None:
            supplier.is_active = is_active
        if discount is not None:
            if not (0 < discount <= 2):
                raise HTTPException(status_code=400, detail="折扣范围: 0.01 ~ 2.0")
            supplier.discount = discount

        await db.commit()
        return {"success": True, **_supplier_to_out(supplier)}


# ─── Product endpoints ────────────────────────────────────────────────────────


@router.get("/products")
async def list_products(
    request: Request,
    keyword: str = Query("", description="Search keyword"),
    supplier_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    """List products synced from suppliers."""
    async with async_session() as db:
        base_q = select(WecomAlbumProduct).where(WecomAlbumProduct.tenant_id == user.tenant_id)

        if keyword:
            base_q = base_q.where(WecomAlbumProduct.title.ilike(f"%{keyword}%"))
        if supplier_id:
            base_q = base_q.where(WecomAlbumProduct.supplier_id == supplier_id)

        # Total count
        count_q = select(func.count()).select_from(base_q.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        # Paginate (newest first)
        q = base_q.order_by(WecomAlbumProduct.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(q)
        products = result.scalars().all()

        return {
            "items": [_product_to_out(p) for p in products],
            "total": total,
            "page": page,
            "page_size": page_size,
        }


@router.get("/products/{product_id}")
async def get_product(
    product_id: uuid.UUID,
    request: Request,
    user=Depends(get_current_user),
):
    """Get product detail."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumProduct).where(
                WecomAlbumProduct.id == product_id,
                WecomAlbumProduct.tenant_id == user.tenant_id,
            )
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="商品不存在")
        return _product_to_detail(product)


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: uuid.UUID,
    request: Request,
    user=Depends(require_admin),
):
    """Delete a product."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumProduct).where(
                WecomAlbumProduct.id == product_id,
                WecomAlbumProduct.tenant_id == user.tenant_id,
            )
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="商品不存在")
        await db.delete(product)
        await db.commit()
        return {"success": True}


# ─── Stats endpoint ───────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats(request: Request, user=Depends(get_current_user)):
    """Get summary stats for the dashboard."""
    async with async_session() as db:
        supplier_count = (
            await db.execute(
                select(func.count()).select_from(WecomAlbumSupplier).where(
                    WecomAlbumSupplier.tenant_id == user.tenant_id
                )
            )
        ).scalar() or 0

        active_supplier_count = (
            await db.execute(
                select(func.count()).select_from(WecomAlbumSupplier).where(
                    WecomAlbumSupplier.tenant_id == user.tenant_id,
                    WecomAlbumSupplier.is_active == True,
                )
            )
        ).scalar() or 0

        product_count = (
            await db.execute(
                select(func.count()).select_from(WecomAlbumProduct).where(
                    WecomAlbumProduct.tenant_id == user.tenant_id
                )
            )
        ).scalar() or 0

        return {
            "supplier_count": supplier_count,
            "active_supplier_count": active_supplier_count,
            "product_count": product_count,
        }
