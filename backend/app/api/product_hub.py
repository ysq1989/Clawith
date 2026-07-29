"""Product Hub (选品中心) REST API.

Route summary
─────────────
Admin (admin/*):
  Supply chains  GET/POST /admin/supply-chains, PUT/DELETE /admin/supply-chains/{id}
  Crawl tasks    POST /admin/crawl/start, GET /admin/crawl/tasks, DELETE /admin/crawl/tasks/{id}
  Products       GET/PATCH/DELETE /admin/products/{id}, POST /admin/products/batch-clean
  Categories     GET/POST /admin/categories, PUT/DELETE /admin/categories/{id}

User:
  Products       GET /products, GET /products/{id}
  Categories     GET /categories
  My pools       GET/POST /my-pools, GET/PATCH/DELETE /my-pools/{id}
                 POST /my-pools/{id}/items, DELETE /my-pools/{id}/items/{item_id}

Agent (internal):
  Search         POST /agent/search
  Pick           POST /agent/pick
  List pools     POST /agent/list-pools
  Get pool items POST /agent/get-pool-items
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import String, select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user as _jwt_get_current_user
from app.database import async_session, get_db
from app.models.user import User
from app.models.product_hub import (
    ProductHubCategory,
    ProductHubCrawlTask,
    ProductHubProduct,
    ProductHubSupplyChain,
    ProductHubUserPool,
    ProductHubUserPoolItem,
)

router = APIRouter(prefix="/api/product-hub", tags=["product-hub"])


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
    """Require platform admin role."""
    user = await get_current_user(request, credentials, db)
    if not hasattr(user, "role") or user.role not in ("super_admin", "platform_admin", "org_admin"):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


# ─── Response helpers ─────────────────────────────────────────────────────────


def _supply_chain_to_out(sc) -> dict:
    return {
        "id": str(sc.id),
        "display_name": sc.display_name,
        "description": sc.description,
        "logo_url": sc.logo_url,
        "source_platform": sc.source_platform,
        "is_active": sc.is_active,
        "last_crawl_at": sc.last_crawl_at.isoformat() if sc.last_crawl_at else None,
        "products_count": sc.products_count,
        "created_at": sc.created_at.isoformat() if sc.created_at else None,
    }


def _supply_chain_to_admin_out(sc) -> dict:
    return {
        **_supply_chain_to_out(sc),
        "crawl_config": sc.crawl_config,
    }


def _category_to_out(cat) -> dict:
    return {
        "id": str(cat.id),
        "name": cat.name,
        "parent_id": str(cat.parent_id) if cat.parent_id else None,
        "icon": cat.icon,
        "sort_order": cat.sort_order,
        "is_active": cat.is_active,
    }


def _product_to_user_out(p) -> dict:
    """User-facing product output — hides internal crawl source fields."""
    return {
        "id": str(p.id),
        "title": p.title,
        "description": p.description,
        "price": str(p.price) if p.price else None,
        "original_price": str(p.original_price) if p.original_price else None,
        "images": p.images or [],
        "main_image": p.main_image,
        "supply_chain_name": p.supply_chain_name,
        "category_id": str(p.category_id) if p.category_id else None,
        "tags": p.tags or [],
        "clean_summary": p.clean_summary,
        "attributes": p.attributes or {},
        "quality_score": p.quality_score,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _product_to_admin_out(p) -> dict:
    """Admin-facing product output — includes internal source fields."""
    return {
        **_product_to_user_out(p),
        "source_url": getattr(p, "_source_url", None) or getattr(p, "source_url", None),
        "source_shop_name": getattr(p, "_source_shop_name", None) or getattr(p, "source_shop_name", None),
        "supply_chain_id": str(getattr(p, "_supply_chain_id", None) or getattr(p, "supply_chain_id", None))
        if getattr(p, "_supply_chain_id", None) or getattr(p, "supply_chain_id", None)
        else None,
        "crawl_task_id": str(getattr(p, "_crawl_task_id", None) or getattr(p, "crawl_task_id", None))
        if getattr(p, "_crawl_task_id", None) or getattr(p, "crawl_task_id", None)
        else None,
    }


def _crawl_task_to_out(task) -> dict:
    return {
        "id": str(task.id),
        "supply_chain_id": str(task.supply_chain_id) if task.supply_chain_id else None,
        "source_url": task.source_url,
        "status": task.status,
        "products_count": task.products_count,
        "clean_count": task.clean_count,
        "error_message": task.error_message,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "finished_at": task.finished_at.isoformat() if task.finished_at else None,
    }


def _user_pool_to_out(pool, item_count: int = 0) -> dict:
    return {
        "id": str(pool.id),
        "name": pool.name,
        "description": pool.description,
        "is_active": pool.is_active,
        "item_count": item_count,
        "created_at": pool.created_at.isoformat() if pool.created_at else None,
        "updated_at": pool.updated_at.isoformat() if pool.updated_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

admin_router = APIRouter(prefix="/api/product-hub/admin", tags=["product-hub-admin"])


# ── Supply chains ──


@admin_router.get("/supply-chains")
async def admin_list_supply_chains(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProductHubSupplyChain)
        .where(ProductHubSupplyChain.tenant_id == user.tenant_id)
        .order_by(ProductHubSupplyChain.created_at.desc())
    )
    chains = result.scalars().all()
    return [_supply_chain_to_admin_out(c) for c in chains]


class SupplyChainCreate(BaseModel):
    display_name: str
    description: str | None = None
    logo_url: str | None = None
    source_platform: str = "weixin_album"
    crawl_config: dict = {}


@admin_router.post("/supply-chains")
async def admin_create_supply_chain(
    body: SupplyChainCreate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    sc = ProductHubSupplyChain(
        tenant_id=user.tenant_id,
        display_name=body.display_name,
        description=body.description,
        logo_url=body.logo_url,
        source_platform=body.source_platform,
        crawl_config=body.crawl_config,
    )
    db.add(sc)
    await db.flush()
    return _supply_chain_to_admin_out(sc)


@admin_router.put("/supply-chains/{chain_id}")
async def admin_update_supply_chain(
    chain_id: uuid.UUID,
    body: SupplyChainCreate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubSupplyChain).where(
            ProductHubSupplyChain.id == chain_id,
            ProductHubSupplyChain.tenant_id == user.tenant_id,
        )
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(404, "Supply chain not found")
    sc.display_name = body.display_name
    sc.description = body.description
    sc.logo_url = body.logo_url
    sc.source_platform = body.source_platform
    sc.crawl_config = body.crawl_config
    await db.flush()
    return _supply_chain_to_admin_out(sc)


@admin_router.delete("/supply-chains/{chain_id}")
async def admin_delete_supply_chain(
    chain_id: uuid.UUID,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubSupplyChain).where(
            ProductHubSupplyChain.id == chain_id,
            ProductHubSupplyChain.tenant_id == user.tenant_id,
        )
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(404, "Supply chain not found")
    await db.delete(sc)
    return {"ok": True}


class TestConnectionRequest(BaseModel):
    token: str


@admin_router.post("/test-connection")
async def admin_test_szwego_connection(
    body: TestConnectionRequest,
    user=Depends(require_admin),
):
    """Test connection to szwego (微商相册) API with the given token."""
    from app.services.product_hub.crawl_service import test_szwego_connection, SzwegoAPIError

    try:
        info = await test_szwego_connection(body.token)
        return {
            "ok": True,
            "album_id": info.get("albumId", ""),
            "album_name": info.get("albumName", ""),
            "total_fans": info.get("totalFans", 0),
            "vip_status": info.get("vipDetail", {}).get("vipStatus", 0),
        }
    except SzwegoAPIError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=f"Connection test failed: {e}")


# ── Crawl tasks ──


@admin_router.get("/crawl/tasks")
async def admin_list_crawl_tasks(
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(ProductHubCrawlTask).where(ProductHubCrawlTask.tenant_id == user.tenant_id)
    if status:
        q = q.where(ProductHubCrawlTask.status == status)
    q = q.order_by(ProductHubCrawlTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    tasks = result.scalars().all()

    count_q = select(func.count(ProductHubCrawlTask.id)).where(ProductHubCrawlTask.tenant_id == user.tenant_id)
    if status:
        count_q = count_q.where(ProductHubCrawlTask.status == status)
    total = (await db.execute(count_q)).scalar() or 0

    return {"items": [_crawl_task_to_out(t) for t in tasks], "total": total}


class CrawlStartRequest(BaseModel):
    supply_chain_id: uuid.UUID | None = None
    source_url: str
    crawl_config: dict = {}


@admin_router.post("/crawl/start")
async def admin_start_crawl(
    body: CrawlStartRequest,
    background_tasks: BackgroundTasks,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Start a new crawl task. Crawling runs in the background."""
    task = ProductHubCrawlTask(
        tenant_id=user.tenant_id,
        user_id=user.id if hasattr(user, "id") else uuid.uuid4(),
        supply_chain_id=body.supply_chain_id,
        source_url=body.source_url,
        crawl_config=body.crawl_config,
        status="pending",
    )
    db.add(task)
    await db.flush()

    # Trigger background crawl
    from app.services.product_hub.crawl_service import execute_crawl_task

    background_tasks.add_task(execute_crawl_task, task.id)
    logger.info(f"[ProductHub] Crawl task {task.id} started by user {user.id}")

    return _crawl_task_to_out(task)


@admin_router.delete("/crawl/tasks/{task_id}")
async def admin_delete_crawl_task(
    task_id: uuid.UUID,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubCrawlTask).where(
            ProductHubCrawlTask.id == task_id,
            ProductHubCrawlTask.tenant_id == user.tenant_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Crawl task not found")
    if task.status == "running":
        raise HTTPException(400, "Cannot delete a running task")
    await db.delete(task)
    return {"ok": True}


class BatchCleanRequest(BaseModel):
    product_ids: list[uuid.UUID] | None = None
    limit: int = 50


@admin_router.post("/products/batch-clean")
async def admin_batch_clean(
    body: BatchCleanRequest,
    background_tasks: BackgroundTasks,
    user=Depends(require_admin),
):
    """Trigger LLM batch cleaning for products."""
    from app.services.product_hub.clean_service import batch_clean_products

    async def _run_clean():
        count = await batch_clean_products(
            tenant_id=user.tenant_id,
            product_ids=body.product_ids,
            limit=body.limit,
        )
        logger.info(f"[ProductHub] Batch clean completed: {count} products")

    background_tasks.add_task(_run_clean)
    return {"ok": True, "message": "Batch clean started in background"}


# ── Admin product management ──


@admin_router.get("/products")
async def admin_list_products(
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    keyword: str | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(ProductHubProduct).where(ProductHubProduct.tenant_id == user.tenant_id)
    if keyword:
        q = q.where(
            or_(
                ProductHubProduct.title.ilike(f"%{keyword}%"),
                ProductHubProduct.description.ilike(f"%{keyword}%"),
            )
        )
    if category_id:
        q = q.where(ProductHubProduct.category_id == category_id)
    if status:
        q = q.where(ProductHubProduct.status == status)

    count_q = select(func.count(ProductHubProduct.id)).where(ProductHubProduct.tenant_id == user.tenant_id)
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(ProductHubProduct.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    products = result.scalars().all()
    return {"items": [_product_to_admin_out(p) for p in products], "total": total}


@admin_router.patch("/products/{product_id}")
async def admin_update_product(
    product_id: uuid.UUID,
    request: Request,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubProduct).where(
            ProductHubProduct.id == product_id,
            ProductHubProduct.tenant_id == user.tenant_id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    body = await request.json()
    for field in ("title", "description", "tags", "category_id", "supply_chain_name", "status", "attributes"):
        if field in body:
            setattr(product, field, body[field])
    await db.flush()
    return _product_to_admin_out(product)


@admin_router.delete("/products/{product_id}")
async def admin_delete_product(
    product_id: uuid.UUID,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubProduct).where(
            ProductHubProduct.id == product_id,
            ProductHubProduct.tenant_id == user.tenant_id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    await db.delete(product)
    return {"ok": True}


# ── Admin categories ──


@admin_router.get("/categories")
async def admin_list_categories(
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubCategory)
        .where(ProductHubCategory.tenant_id == user.tenant_id)
        .order_by(ProductHubCategory.sort_order)
    )
    return [_category_to_out(c) for c in result.scalars().all()]


class CategoryCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    sort_order: int = 0


@admin_router.post("/categories")
async def admin_create_category(
    body: CategoryCreate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    cat = ProductHubCategory(
        tenant_id=user.tenant_id,
        name=body.name,
        parent_id=body.parent_id,
        icon=body.icon,
        sort_order=body.sort_order,
    )
    db.add(cat)
    await db.flush()
    return _category_to_out(cat)


@admin_router.put("/categories/{category_id}")
async def admin_update_category(
    category_id: uuid.UUID,
    body: CategoryCreate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubCategory).where(
            ProductHubCategory.id == category_id,
            ProductHubCategory.tenant_id == user.tenant_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.name = body.name
    cat.parent_id = body.parent_id
    cat.icon = body.icon
    cat.sort_order = body.sort_order
    await db.flush()
    return _category_to_out(cat)


@admin_router.delete("/categories/{category_id}")
async def admin_delete_category(
    category_id: uuid.UUID,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubCategory).where(
            ProductHubCategory.id == category_id,
            ProductHubCategory.tenant_id == user.tenant_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    await db.delete(cat)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# USER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# Re-use the main router for user-facing endpoints


@router.get("/products")
async def user_list_products(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    keyword: str | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    tags: str | None = Query(None, description="Comma-separated tags"),
    price_min: float | None = Query(None),
    price_max: float | None = Query(None),
    supply_chain_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search products in the public selection pool (from wecom-album synced products)."""
    from app.models.wecom_album import WecomAlbumProduct

    q = select(WecomAlbumProduct).where(
        WecomAlbumProduct.tenant_id == user.tenant_id,
        WecomAlbumProduct.status == "synced",
    )

    if keyword:
        q = q.where(
            or_(
                WecomAlbumProduct.title.ilike(f"%{keyword}%"),
                WecomAlbumProduct.clean_title.ilike(f"%{keyword}%") if WecomAlbumProduct.clean_title else False,
            )
        )
    if category_id:
        q = q.where(WecomAlbumProduct.category_id == category_id)
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        for tag in tag_list:
            q = q.where(WecomAlbumProduct.tags.op("@>")(f'["{tag}"]'))
    if price_min is not None:
        q = q.where(WecomAlbumProduct.clean_price >= price_min)
    if price_max is not None:
        q = q.where(WecomAlbumProduct.clean_price <= price_max)

    # Count
    count_q = select(func.count(WecomAlbumProduct.id)).where(
        WecomAlbumProduct.tenant_id == user.tenant_id,
        WecomAlbumProduct.status == "synced",
    )
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(WecomAlbumProduct.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    products = result.scalars().all()

    def _wecom_to_out(p):
        return {
            "id": str(p.id),
            "title": p.clean_title or p.title,
            "description": "",
            "price": str(p.clean_price) if p.clean_price else str(p.price) if p.price else None,
            "images": p.images or [],
            "main_image": p.main_image,
            "tags": p.tags or [],
            "category_id": p.category_id,
            "status": "active",
            "source": "wecom-album",
            "source_id": str(p.id),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }

    return {"items": [_wecom_to_out(p) for p in products], "total": total}


@router.get("/products/{product_id}")
async def user_get_product(
    product_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubProduct).where(
            ProductHubProduct.id == product_id,
            ProductHubProduct.tenant_id == user.tenant_id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    return _product_to_user_out(product)


@router.get("/categories")
async def user_list_categories(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubCategory)
        .where(
            ProductHubCategory.tenant_id == user.tenant_id,
            ProductHubCategory.is_active == True,
        )
        .order_by(ProductHubCategory.sort_order)
    )
    return [_category_to_out(c) for c in result.scalars().all()]


# ── User pools ──


@router.get("/my-pools")
async def user_list_pools(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubUserPool)
        .where(
            ProductHubUserPool.tenant_id == user.tenant_id,
            ProductHubUserPool.user_id == user.id,
        )
        .order_by(ProductHubUserPool.created_at.desc())
    )
    pools = result.scalars().all()

    # Get item counts
    out = []
    for pool in pools:
        count_q = select(func.count(ProductHubUserPoolItem.id)).where(
            ProductHubUserPoolItem.pool_id == pool.id
        )
        count = (await db.execute(count_q)).scalar() or 0
        out.append(_user_pool_to_out(pool, count))
    return out


class PoolCreate(BaseModel):
    name: str
    description: str | None = None


@router.post("/my-pools")
async def user_create_pool(
    body: PoolCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pool = ProductHubUserPool(
        tenant_id=user.tenant_id,
        user_id=user.id,
        name=body.name,
        description=body.description,
    )
    db.add(pool)
    await db.flush()
    return _user_pool_to_out(pool)


@router.get("/my-pools/{pool_id}")
async def user_get_pool(
    pool_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubUserPool).where(
            ProductHubUserPool.id == pool_id,
            ProductHubUserPool.tenant_id == user.tenant_id,
            ProductHubUserPool.user_id == user.id,
        )
    )
    pool = result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "Pool not found")

    # Get items with product info
    items_q = (
        select(ProductHubUserPoolItem, ProductHubProduct)
        .join(ProductHubProduct, ProductHubUserPoolItem.product_id == ProductHubProduct.id)
        .where(ProductHubUserPoolItem.pool_id == pool_id)
        .order_by(ProductHubUserPoolItem.sort_order)
    )
    items_result = await db.execute(items_q)
    rows = items_result.all()

    return {
        **_user_pool_to_out(pool, len(rows)),
        "items": [
            {
                "id": str(item.id),
                "product": _product_to_user_out(product),
                "note": item.note,
                "selected_by_agent": item.selected_by_agent,
                "sort_order": item.sort_order,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item, product in rows
        ],
    }


@router.patch("/my-pools/{pool_id}")
async def user_update_pool(
    pool_id: uuid.UUID,
    body: PoolCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubUserPool).where(
            ProductHubUserPool.id == pool_id,
            ProductHubUserPool.tenant_id == user.tenant_id,
            ProductHubUserPool.user_id == user.id,
        )
    )
    pool = result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "Pool not found")
    pool.name = body.name
    pool.description = body.description
    await db.flush()
    return _user_pool_to_out(pool)


@router.delete("/my-pools/{pool_id}")
async def user_delete_pool(
    pool_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductHubUserPool).where(
            ProductHubUserPool.id == pool_id,
            ProductHubUserPool.tenant_id == user.tenant_id,
            ProductHubUserPool.user_id == user.id,
        )
    )
    pool = result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "Pool not found")
    await db.delete(pool)
    return {"ok": True}


class PoolItemAdd(BaseModel):
    product_id: uuid.UUID
    note: str | None = None
    selected_by_agent: bool = False


@router.post("/my-pools/{pool_id}/items")
async def user_add_pool_items(
    pool_id: uuid.UUID,
    body: PoolItemAdd,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify pool ownership
    pool_result = await db.execute(
        select(ProductHubUserPool).where(
            ProductHubUserPool.id == pool_id,
            ProductHubUserPool.tenant_id == user.tenant_id,
            ProductHubUserPool.user_id == user.id,
        )
    )
    pool = pool_result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "Pool not found")

    # Verify product exists
    prod_result = await db.execute(
        select(ProductHubProduct).where(
            ProductHubProduct.id == body.product_id,
            ProductHubProduct.tenant_id == user.tenant_id,
        )
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    # Check if already in pool
    existing = await db.execute(
        select(ProductHubUserPoolItem).where(
            ProductHubUserPoolItem.pool_id == pool_id,
            ProductHubUserPoolItem.product_id == body.product_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Product already in pool")

    # Get max sort_order
    max_sort = await db.execute(
        select(func.max(ProductHubUserPoolItem.sort_order)).where(
            ProductHubUserPoolItem.pool_id == pool_id
        )
    )
    max_val = max_sort.scalar() or 0

    item = ProductHubUserPoolItem(
        pool_id=pool_id,
        product_id=body.product_id,
        note=body.note,
        selected_by_agent=body.selected_by_agent,
        sort_order=max_val + 1,
    )
    db.add(item)
    await db.flush()
    return {"ok": True, "id": str(item.id)}


@router.delete("/my-pools/{pool_id}/items/{item_id}")
async def user_remove_pool_item(
    pool_id: uuid.UUID,
    item_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify pool ownership
    pool_result = await db.execute(
        select(ProductHubUserPool).where(
            ProductHubUserPool.id == pool_id,
            ProductHubUserPool.tenant_id == user.tenant_id,
            ProductHubUserPool.user_id == user.id,
        )
    )
    if not pool_result.scalar_one_or_none():
        raise HTTPException(404, "Pool not found")

    item_result = await db.execute(
        select(ProductHubUserPoolItem).where(
            ProductHubUserPoolItem.id == item_id,
            ProductHubUserPoolItem.pool_id == pool_id,
        )
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")
    await db.delete(item)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT ENDPOINTS (internal, X-Agent-Tenant-Id auth)
# ═══════════════════════════════════════════════════════════════════════════════

agent_router = APIRouter(prefix="/api/product-hub/agent", tags=["product-hub-agent"])


class AgentSearchRequest(BaseModel):
    keyword: str | None = None
    category: str | None = None
    price_min: float | None = None
    price_max: float | None = None
    tags: list[str] | None = None
    page: int = 1
    page_size: int = 20


@agent_router.post("/search")
async def agent_search_products(
    body: AgentSearchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Agent searches the public product selection pool."""
    # Auth via X-Agent-Tenant-Id
    agent_tid = request.headers.get("X-Agent-Tenant-Id")
    if not agent_tid:
        raise HTTPException(401, "Missing X-Agent-Tenant-Id header")
    tenant_id = uuid.UUID(agent_tid)

    q = select(ProductHubProduct).where(
        ProductHubProduct.tenant_id == tenant_id,
        ProductHubProduct.status == "active",
    )

    if body.keyword:
        q = q.where(
            or_(
                ProductHubProduct.title.ilike(f"%{body.keyword}%"),
                ProductHubProduct.description.ilike(f"%{body.keyword}%"),
                ProductHubProduct.clean_summary.ilike(f"%{body.keyword}%"),
            )
        )
    if body.category:
        # Lookup category by name
        cat_result = await db.execute(
            select(ProductHubCategory).where(
                ProductHubCategory.tenant_id == tenant_id,
                ProductHubCategory.name.ilike(f"%{body.category}%"),
            )
        )
        cat = cat_result.scalar_one_or_none()
        if cat:
            q = q.where(ProductHubProduct.category_id == cat.id)
    if body.price_min is not None:
        q = q.where(ProductHubProduct.price >= body.price_min)
    if body.price_max is not None:
        q = q.where(ProductHubProduct.price <= body.price_max)
    if body.tags:
        for tag in body.tags:
            q = q.where(ProductHubProduct.tags.op("@>")(f'["{tag}"]'))

    q = q.order_by(ProductHubProduct.quality_score.desc().nullslast(), ProductHubProduct.created_at.desc())
    q = q.offset((body.page - 1) * body.page_size).limit(body.page_size)

    result = await db.execute(q)
    products = result.scalars().all()
    return {"items": [_product_to_user_out(p) for p in products]}


class AgentPickRequest(BaseModel):
    action: str  # "create" | "add" | "remove" | "list" | "detail"
    pool_id: str | None = None
    pool_name: str | None = None
    product_id: str | None = None
    note: str | None = None
    user_id: str | None = None  # Optional: specify which user's pool


@agent_router.post("/pick")
async def agent_manage_pool(
    body: AgentPickRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Agent manages user pools: create, add, remove, list, detail."""
    agent_tid = request.headers.get("X-Agent-Tenant-Id")
    if not agent_tid:
        raise HTTPException(401, "Missing X-Agent-Tenant-Id header")
    tenant_id = uuid.UUID(agent_tid)

    if body.action == "list":
        # List user's pools — need user_id from JWT or request
        # For agent calls, we may need to accept user_id in body
        user_id = uuid.UUID(body.user_id) if body.user_id else None
        if not user_id:
            raise HTTPException(400, "user_id required for list action")

        result = await db.execute(
            select(ProductHubUserPool).where(
                ProductHubUserPool.tenant_id == tenant_id,
                ProductHubUserPool.user_id == user_id,
            ).order_by(ProductHubUserPool.created_at.desc())
        )
        pools = result.scalars().all()
        out = []
        for pool in pools:
            count_q = select(func.count(ProductHubUserPoolItem.id)).where(
                ProductHubUserPoolItem.pool_id == pool.id
            )
            count = (await db.execute(count_q)).scalar() or 0
            out.append(_user_pool_to_out(pool, count))
        return {"pools": out}

    elif body.action == "create":
        user_id = uuid.UUID(body.user_id) if body.user_id else None
        if not user_id or not body.pool_name:
            raise HTTPException(400, "user_id and pool_name required for create")
        pool = ProductHubUserPool(
            tenant_id=tenant_id,
            user_id=user_id,
            name=body.pool_name,
        )
        db.add(pool)
        await db.flush()
        return _user_pool_to_out(pool)

    elif body.action == "add":
        if not body.pool_id or not body.product_id:
            raise HTTPException(400, "pool_id and product_id required for add")
        pool_result = await db.execute(
            select(ProductHubUserPool).where(
                ProductHubUserPool.id == uuid.UUID(body.pool_id),
                ProductHubUserPool.tenant_id == tenant_id,
            )
        )
        pool = pool_result.scalar_one_or_none()
        if not pool:
            raise HTTPException(404, "Pool not found")

        prod_result = await db.execute(
            select(ProductHubProduct).where(
                ProductHubProduct.id == uuid.UUID(body.product_id),
                ProductHubProduct.tenant_id == tenant_id,
            )
        )
        if not prod_result.scalar_one_or_none():
            raise HTTPException(404, "Product not found")

        # Check duplicate
        existing = await db.execute(
            select(ProductHubUserPoolItem).where(
                ProductHubUserPoolItem.pool_id == pool.id,
                ProductHubUserPoolItem.product_id == uuid.UUID(body.product_id),
            )
        )
        if existing.scalar_one_or_none():
            return {"ok": True, "message": "Already in pool"}

        max_sort = await db.execute(
            select(func.max(ProductHubUserPoolItem.sort_order)).where(
                ProductHubUserPoolItem.pool_id == pool.id
            )
        )
        max_val = max_sort.scalar() or 0

        item = ProductHubUserPoolItem(
            pool_id=pool.id,
            product_id=uuid.UUID(body.product_id),
            note=body.note,
            selected_by_agent=True,
            sort_order=max_val + 1,
        )
        db.add(item)
        await db.flush()
        return {"ok": True, "id": str(item.id)}

    elif body.action == "remove":
        if not body.pool_id or not body.product_id:
            raise HTTPException(400, "pool_id and product_id required for remove")
        item_result = await db.execute(
            select(ProductHubUserPoolItem).where(
                ProductHubUserPoolItem.pool_id == uuid.UUID(body.pool_id),
                ProductHubUserPoolItem.product_id == uuid.UUID(body.product_id),
            )
        )
        item = item_result.scalar_one_or_none()
        if not item:
            raise HTTPException(404, "Item not found in pool")
        await db.delete(item)
        return {"ok": True}

    elif body.action == "detail":
        if not body.pool_id:
            raise HTTPException(400, "pool_id required for detail")
        pool_result = await db.execute(
            select(ProductHubUserPool).where(
                ProductHubUserPool.id == uuid.UUID(body.pool_id),
                ProductHubUserPool.tenant_id == tenant_id,
            )
        )
        pool = pool_result.scalar_one_or_none()
        if not pool:
            raise HTTPException(404, "Pool not found")

        items_q = (
            select(ProductHubUserPoolItem, ProductHubProduct)
            .join(ProductHubProduct, ProductHubUserPoolItem.product_id == ProductHubProduct.id)
            .where(ProductHubUserPoolItem.pool_id == pool.id)
            .order_by(ProductHubUserPoolItem.sort_order)
        )
        items_result = await db.execute(items_q)
        rows = items_result.all()
        return {
            **_user_pool_to_out(pool, len(rows)),
            "items": [
                {
                    "id": str(item.id),
                    "product": _product_to_user_out(product),
                    "note": item.note,
                    "selected_by_agent": item.selected_by_agent,
                }
                for item, product in rows
            ],
        }

    else:
        raise HTTPException(400, f"Unknown action: {body.action}")


class AgentGetPoolItemsRequest(BaseModel):
    pool_id: str
    count: int = 1
    product_ids: list[str] | None = None


@agent_router.post("/get-pool-items")
async def agent_get_pool_items(
    body: AgentGetPoolItemsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get pool products for publishing to XHS."""
    agent_tid = request.headers.get("X-Agent-Tenant-Id")
    if not agent_tid:
        raise HTTPException(401, "Missing X-Agent-Tenant-Id header")
    tenant_id = uuid.UUID(agent_tid)

    pool_result = await db.execute(
        select(ProductHubUserPool).where(
            ProductHubUserPool.id == uuid.UUID(body.pool_id),
            ProductHubUserPool.tenant_id == tenant_id,
        )
    )
    pool = pool_result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "Pool not found")

    if body.product_ids:
        # Get specific products
        pids = [uuid.UUID(pid) for pid in body.product_ids]
        q = (
            select(ProductHubUserPoolItem, ProductHubProduct)
            .join(ProductHubProduct, ProductHubUserPoolItem.product_id == ProductHubProduct.id)
            .where(
                ProductHubUserPoolItem.pool_id == pool.id,
                ProductHubUserPoolItem.product_id.in_(pids),
            )
        )
    else:
        q = (
            select(ProductHubUserPoolItem, ProductHubProduct)
            .join(ProductHubProduct, ProductHubUserPoolItem.product_id == ProductHubProduct.id)
            .where(ProductHubUserPoolItem.pool_id == pool.id)
            .order_by(ProductHubUserPoolItem.sort_order)
            .limit(body.count)
        )

    result = await db.execute(q)
    rows = result.all()

    return {
        "pool_name": pool.name,
        "products": [
            {
                "id": str(product.id),
                "title": product.title,
                "description": product.description,
                "images": product.images or [],
                "main_image": product.main_image,
                "tags": product.tags or [],
                "clean_summary": product.clean_summary,
                "supply_chain_name": product.supply_chain_name,
            }
            for _, product in rows
        ],
    }


# Register admin and agent routers onto the main router
router.include_router(admin_router)
router.include_router(agent_router)
