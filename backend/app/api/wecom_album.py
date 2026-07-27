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
from app.models.product_hub import ProductHubProduct
from app.services.wecom_album.szwego_client import WecomAlbumSzwegoClient
from app.services.wecom_album.sync_service import test_connection, sync_suppliers, sync_products
from app.services.wecom_album.ai_clean_service import clean_single, clean_batch, clean_supplier_products

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
        "ai_model_id": str(account.ai_model_id) if account.ai_model_id else None,
        "ai_batch_limit": account.ai_batch_limit,
        "ai_timeout_seconds": account.ai_timeout_seconds,
        "ai_max_tokens": account.ai_max_tokens,
        "ai_prompt_system": account.ai_prompt_system,
        "ai_prompt_user_template": account.ai_prompt_user_template,
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
        "clean_title": p.clean_title,
        "price": str(p.price) if p.price else None,
        "clean_price": str(p.clean_price) if p.clean_price else None,
        "images": p.images or [],
        "main_image": p.main_image,
        "video_url": p.video_url,
        "shop_name": p.shop_name,
        "source_url": p.source_url,
        "tags": p.tags or [],
        "status": p.status,
        "ai_cleaned_at": p.ai_cleaned_at.isoformat() if p.ai_cleaned_at else None,
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
    ai_model_id: str | None = None
    ai_batch_limit: int = 20
    ai_timeout_seconds: int = 60
    ai_max_tokens: int = 2048
    ai_prompt_system: str | None = None
    ai_prompt_user_template: str | None = None


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
            account.ai_model_id = uuid.UUID(body.ai_model_id) if body.ai_model_id else None
            account.ai_batch_limit = body.ai_batch_limit
            account.ai_timeout_seconds = body.ai_timeout_seconds
            account.ai_max_tokens = body.ai_max_tokens
            account.ai_prompt_system = body.ai_prompt_system
            account.ai_prompt_user_template = body.ai_prompt_user_template
        else:
            account = WecomAlbumAccount(
                tenant_id=user.tenant_id,
                token=body.token.strip(),
                product_sync_stale_hours=body.product_sync_stale_hours,
                ai_model_id=uuid.UUID(body.ai_model_id) if body.ai_model_id else None,
                ai_batch_limit=body.ai_batch_limit,
                ai_timeout_seconds=body.ai_timeout_seconds,
                ai_max_tokens=body.ai_max_tokens,
                ai_prompt_system=body.ai_prompt_system,
                ai_prompt_user_template=body.ai_prompt_user_template,
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
    status: str = Query("", description="Filter by status"),
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
        if status:
            base_q = base_q.where(WecomAlbumProduct.status == status)

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

        # Product status counts
        status_counts = {}
        for s in ("pending_clean", "pending_sync", "synced"):
            cnt = (
                await db.execute(
                    select(func.count()).select_from(WecomAlbumProduct).where(
                        WecomAlbumProduct.tenant_id == user.tenant_id,
                        WecomAlbumProduct.status == s,
                    )
                )
            ).scalar() or 0
            status_counts[s] = cnt

        return {
            "supplier_count": supplier_count,
            "active_supplier_count": active_supplier_count,
            "product_count": product_count,
            "status_counts": status_counts,
        }


# ─── AI Cleaning endpoints ────────────────────────────────────────────────────


@router.post("/ai-clean/test")
async def api_ai_clean_test(
    request: Request,
    user=Depends(require_admin),
):
    """Test AI cleaning with a sample title."""
    body = await request.json()
    test_title = body.get("title", "🌴正圈冰飘花 完美无瑕 尺寸：55.7/12.2/8.1 价格：小六3️⃣开！起荧光")

    from app.services.wecom_album.ai_clean_service import _get_ai_model, _call_llm_api, _parse_clean_result, SYSTEM_PROMPT

    model = await _get_ai_model(user.tenant_id)
    if not model:
        raise HTTPException(status_code=400, detail="未配置AI清洗模型")

    # Load custom prompts from account
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == user.tenant_id)
        )
        account = result.scalar_one_or_none()

    system_prompt = (account.ai_prompt_system if account and account.ai_prompt_system else None) or SYSTEM_PROMPT
    user_template = (account.ai_prompt_user_template if account and account.ai_prompt_user_template else None) or "请清洗以下商品标题并提取成本价。\n规则：\n1) clean_title 保留品牌/规格/数量等关键信息，去掉营销词、联系方式、表情、重复符号和多余空格；\n2) cost 仅返回数字，可小数；无法判断返回 0；\n3) 只输出 JSON 对象：{\"clean_title\":\"...\",\"cost\":0}\n商品标题：{title}"
    user_prompt = user_prompt = user_template.format(title=test_title)

    try:
        response_text = await _call_llm_api(model, system_prompt, user_prompt, timeout=account.ai_timeout_seconds if account else 60)
        parsed = _parse_clean_result(response_text)
        return {
            "success": True,
            "model": model.label,
            "raw_response": response_text,
            "parsed": parsed,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AI测试失败: {e}")


@router.post("/ai-clean/single/{product_id}")
async def api_ai_clean_single(
    product_id: uuid.UUID,
    request: Request,
    user=Depends(require_admin),
):
    """AI clean a single product's title."""
    result = await clean_single(product_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "AI清洗失败"))
    return result


@router.post("/ai-clean/batch")
async def api_ai_clean_batch(
    request: Request,
    user=Depends(require_admin),
):
    """AI clean multiple products' titles."""
    body = await request.json()
    product_ids = body.get("product_ids", [])
    if not product_ids:
        raise HTTPException(status_code=400, detail="product_ids is required")

    ids = [uuid.UUID(pid) for pid in product_ids]
    result = await clean_batch(ids)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "AI清洗失败"))
    return result


@router.post("/ai-clean/supplier/{supplier_id}")
async def api_ai_clean_supplier(
    supplier_id: uuid.UUID,
    request: Request,
    user=Depends(require_admin),
):
    """AI clean all uncleaned products for a supplier."""
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    limit = body.get("limit", 100)
    result = await clean_supplier_products(supplier_id, limit=limit)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "AI清洗失败"))
    return result


# ─── Push to Product Hub ──────────────────────────────────────────────────────


@router.post("/push-to-pool")
async def api_push_to_pool(
    request: Request,
    user=Depends(require_admin),
):
    """Push cleaned products to Product Hub selection pool.

    Body: {"product_ids": ["uuid", ...]} or {"status": "pending_sync"} to push all pending.
    """
    body = await request.json()
    product_ids = body.get("product_ids", [])
    push_all = body.get("status") == "pending_sync"

    async with async_session() as db:
        if push_all:
            result = await db.execute(
                select(WecomAlbumProduct).where(
                    WecomAlbumProduct.tenant_id == user.tenant_id,
                    WecomAlbumProduct.status == "pending_sync",
                )
            )
        elif product_ids:
            ids = [uuid.UUID(pid) for pid in product_ids]
            result = await db.execute(
                select(WecomAlbumProduct).where(
                    WecomAlbumProduct.id.in_(ids),
                    WecomAlbumProduct.status == "pending_sync",
                )
            )
        else:
            raise HTTPException(status_code=400, detail="product_ids or status=pending_sync required")

        products = result.scalars().all()

        pushed = 0
        for p in products:
            # Create ProductHubProduct
            ph_product = ProductHubProduct(
                tenant_id=user.tenant_id,
                title=p.clean_title or p.title,
                description="",
                price=p.clean_price or p.price,
                images=p.images,
                main_image=p.main_image,
                _source_url=p.source_url,
                _source_shop_name=p.shop_name,
                _source_shop_id=p.shop_id,
                tags=p.tags or [],
                supply_chain_name=p.shop_name,
                status="active",
            )
            db.add(ph_product)

            # Update wecom-album product status
            p.status = "synced"
            pushed += 1

        await db.commit()

        return {"success": True, "pushed": pushed}
