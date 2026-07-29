"""WeChat Business Album — sync service.

Orchestrates supplier discovery and product syncing from szwego.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone, timedelta

from loguru import logger
from sqlalchemy import select, func

from app.database import async_session
from app.models.wecom_album import WecomAlbumAccount, WecomAlbumSupplier, WecomAlbumProduct, WecomAlbumSyncLog
from app.services.wecom_album.szwego_client import (
    WecomAlbumSzwegoClient,
    normalize_supplier,
    normalize_product,
    compute_source_hash,
)


async def test_connection(token: str) -> dict:
    """Test szwego connection and return account info."""
    client = WecomAlbumSzwegoClient(token)
    return await client.get_user_info()


async def _create_sync_log(
    db, tenant_id: uuid.UUID, task_type: str, status: str = "running", **kwargs
) -> WecomAlbumSyncLog:
    """Create a sync log entry."""
    log = WecomAlbumSyncLog(tenant_id=tenant_id, task_type=task_type, status=status, **kwargs)
    db.add(log)
    await db.flush()
    return log


async def _finish_sync_log(log: WecomAlbumSyncLog, status: str, message: str = "", duration_ms: int = 0, **kwargs):
    """Update sync log on completion."""
    log.status = status
    log.message = message
    log.duration_ms = duration_ms
    for k, v in kwargs.items():
        if hasattr(log, k):
            setattr(log, k, v)


async def sync_suppliers(tenant_id: uuid.UUID) -> dict:
    """Sync suppliers (friends) from szwego."""
    t0 = time.time()
    async with async_session() as db:
        log = await _create_sync_log(db, tenant_id, "sync_suppliers")

        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == tenant_id)
        )
        account = result.scalar_one_or_none()
        if not account or not account.is_active:
            await _finish_sync_log(log, "failed", "No active szwego account configured")
            await db.commit()
            return {"success": False, "error": "No active szwego account configured"}

        try:
            client = WecomAlbumSzwegoClient(account.token)
            friends = await client.fetch_friends_list()

            synced = 0
            created = 0
            updated = 0

            for shop in friends:
                norm = normalize_supplier(shop)
                if not norm["external_id"]:
                    continue

                existing = await db.execute(
                    select(WecomAlbumSupplier).where(
                        WecomAlbumSupplier.tenant_id == tenant_id,
                        WecomAlbumSupplier.external_id == norm["external_id"],
                    )
                )
                supplier = existing.scalar_one_or_none()

                if supplier:
                    supplier.name = norm["name"]
                    supplier.avatar = norm["avatar"]
                    supplier.shop_id = norm["shop_id"]
                    supplier.album_id = norm["album_id"] or supplier.album_id or norm["external_id"]
                    supplier.total_products = norm["total_products"]
                    supplier.new_products = norm["new_products"]
                    supplier.last_sync_at = datetime.now(timezone.utc)
                    updated += 1
                else:
                    supplier = WecomAlbumSupplier(
                        tenant_id=tenant_id,
                        account_id=account.id,
                        external_id=norm["external_id"],
                        shop_id=norm["shop_id"],
                        name=norm["name"],
                        avatar=norm["avatar"],
                        album_id=norm["album_id"],
                        total_products=norm["total_products"],
                        new_products=norm["new_products"],
                        last_sync_at=datetime.now(timezone.utc),
                    )
                    db.add(supplier)
                    created += 1
                synced += 1

            duration = int((time.time() - t0) * 1000)
            account.last_owner_sync_at = datetime.now(timezone.utc)
            account.last_error = None
            msg = f"同步供应商完成：新增 {created}，更新 {updated}，共 {synced} 个"
            await _finish_sync_log(log, "success", msg, duration_ms=duration,
                                   items_count=synced, created_count=created, updated_count=updated)
            try:
                await db.commit()
                logger.info(f"[WecomAlbum] Supplier sync log committed: {log.id}")
            except Exception as commit_err:
                logger.error(f"[WecomAlbum] Failed to commit sync log: {commit_err}")
                await db.rollback()
                raise

            logger.info(f"[WecomAlbum] Supplier sync for {tenant_id}: {created} created, {updated} updated")
            return {
                "success": True,
                "total": synced,
                "created": created,
                "updated": updated,
            }

        except Exception as e:
            duration = int((time.time() - t0) * 1000)
            account.last_error = str(e)[:500]
            await _finish_sync_log(log, "failed", str(e)[:500], duration_ms=duration)
            await db.commit()
            logger.error(f"[WecomAlbum] Supplier sync failed for {tenant_id}: {e}")
            return {"success": False, "error": str(e)}


async def _fetch_supplier_products(
    client: WecomAlbumSzwegoClient,
    album_id: str,
    cutoff_ts: int | None = None,
    max_pages: int = 50,
) -> list[dict]:
    """Fetch products from a specific supplier's album.

    Uses album/moments with album_id filter.
    Applies client-side cutoff: stops when encountering items older than cutoff_ts.
    """
    all_items: list[dict] = []
    seen_ids: set[str] = set()
    page_timestamp = ""

    for _page in range(1, max_pages + 1):
        params: dict = {
            "album_id": album_id,
            "searchValue": "",
            "searchImg": "",
            "noCache": 0,
            "slipType": 1,
            "requestDataType": "",
            "_t": str(int(time.time() * 1000)),
        }
        if page_timestamp:
            params["timestamp"] = page_timestamp

        try:
            data = await client._get("https://www.szwego.com/album/moments", params=params)
        except Exception as e:
            logger.warning(f"[WecomAlbum] Fetch products for album {album_id} failed: {e}")
            break

        result = data.get("result", {})
        items = result.get("items", result.get("list", []))

        if not items:
            break

        new_count = 0
        for item in items:
            gid = str(item.get("goods_id", item.get("item_id", item.get("id", ""))))
            if gid and gid not in seen_ids:
                seen_ids.add(gid)

                # Client-side cutoff: check item update_time
                if cutoff_ts:
                    item_ts = 0
                    for key in ("update_time", "time_stamp"):
                        val = item.get(key)
                        if val:
                            try:
                                item_ts = int(val)
                                if item_ts < 1_000_000_000_000:
                                    item_ts *= 1000
                                break
                            except (ValueError, TypeError):
                                continue
                    if item_ts > 0 and item_ts < cutoff_ts:
                        # Item is older than cutoff — stop scanning this supplier
                        return all_items

                all_items.append(item)
                new_count += 1

        if new_count == 0:
            break

        # Pagination
        pagination = result.get("pagination", {})
        if not pagination.get("isLoadMore", False):
            break
        next_ts = pagination.get("pageTimestamp", "")
        if not next_ts or str(next_ts) == str(page_timestamp):
            break
        page_timestamp = str(next_ts)

    return all_items


async def sync_products(tenant_id: uuid.UUID) -> dict:
    """Sync products from all active suppliers."""
    t0 = time.time()
    async with async_session() as db:
        log = await _create_sync_log(db, tenant_id, "sync_products")

        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == tenant_id)
        )
        account = result.scalar_one_or_none()
        if not account or not account.is_active:
            await _finish_sync_log(log, "failed", "No active szwego account configured")
            await db.commit()
            return {"success": False, "error": "No active szwego account configured"}

        # Compute cutoff timestamp for incremental sync (milliseconds)
        # Always filter by last N hours, even on first sync
        stale_hours = account.product_sync_stale_hours or 1
        cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=stale_hours)
        cutoff_ts = int(cutoff_dt.timestamp() * 1000)
        logger.info(
            f"[WecomAlbum] Sync cutoff: {cutoff_dt.isoformat()}, "
            f"stale_hours = {stale_hours}"
        )

        try:
            client = WecomAlbumSzwegoClient(account.token)

            # Load active suppliers with album_id (use external_id as fallback)
            suppliers_result = await db.execute(
                select(WecomAlbumSupplier).where(
                    WecomAlbumSupplier.tenant_id == tenant_id,
                    WecomAlbumSupplier.is_active == True,
                )
            )
            suppliers = suppliers_result.scalars().all()

            # Filter to suppliers with valid album_id (try album_id, then external_id)
            valid_suppliers = []
            for s in suppliers:
                aid = s.album_id or s.external_id
                if aid:
                    s._resolved_album_id = aid
                    valid_suppliers.append(s)

            if not valid_suppliers:
                logger.warning(f"[WecomAlbum] No suppliers with album_id found for {tenant_id}")
                return {"success": True, "total": 0, "created": 0, "updated": 0, "skipped": 0}

            total_created = 0
            total_updated = 0
            total_skipped = 0

            for supplier in valid_suppliers:
                album_id = supplier._resolved_album_id
                raw_products = await _fetch_supplier_products(
                    client, album_id, cutoff_ts=cutoff_ts, max_pages=50
                )

                created = 0
                updated = 0
                skipped = 0

                for raw in raw_products:
                    norm = normalize_product(raw)
                    if not norm["goods_id"]:
                        continue

                    new_hash = compute_source_hash(raw)

                    existing = await db.execute(
                        select(WecomAlbumProduct).where(
                            WecomAlbumProduct.tenant_id == tenant_id,
                            WecomAlbumProduct.goods_id == norm["goods_id"],
                        )
                    )
                    product = existing.scalar_one_or_none()

                    if product:
                        if product.source_hash == new_hash:
                            skipped += 1
                            continue
                        product.title = norm["title"]
                        product.price = norm["price"]
                        product.images = norm["images"]
                        product.main_image = norm["main_image"]
                        product.video_url = norm["video_url"]
                        product.shop_name = norm["shop_name"]
                        product.source_url = norm["source_url"]
                        product.tags = norm["tags"]
                        product.attributes = norm["attributes"]
                        product.source_hash = new_hash
                        product.szwego_created_at = norm["szwego_created_at"]
                        product.supplier_id = supplier.id
                        updated += 1
                    else:
                        product = WecomAlbumProduct(
                            tenant_id=tenant_id,
                            supplier_id=supplier.id,
                            goods_id=norm["goods_id"],
                            title=norm["title"],
                            price=norm["price"],
                            images=norm["images"],
                            main_image=norm["main_image"],
                            video_url=norm["video_url"],
                            shop_name=norm["shop_name"],
                            shop_id=norm["shop_id"],
                            source_url=norm["source_url"],
                            tags=norm["tags"],
                            attributes=norm["attributes"],
                            szwego_created_at=norm["szwego_created_at"],
                            source_hash=new_hash,
                        )
                        db.add(product)
                        created += 1

                total_created += created
                total_updated += updated
                total_skipped += skipped
                logger.info(
                    f"[WecomAlbum] {supplier.name[:20]}: "
                    f"{len(raw_products)} api, {created} new, {updated} up, {skipped} dup"
                )

            # Update sync timestamp
            account.last_product_sync_at = datetime.now(timezone.utc)
            account.last_error = None
            await db.commit()

            logger.info(
                f"[WecomAlbum] Product sync done for {tenant_id}: "
                f"{total_created} created, {total_updated} updated, {total_skipped} skipped"
            )
            duration = int((time.time() - t0) * 1000)
            msg = f"同步商品完成：新增 {total_created}，更新 {total_updated}，跳过 {total_skipped}"
            await _finish_sync_log(log, "success", msg, duration_ms=duration,
                                   items_count=total_created + total_updated,
                                   created_count=total_created, updated_count=total_updated,
                                   skipped_count=total_skipped)
            await db.commit()
            return {
                "success": True,
                "total": total_created + total_updated,
                "created": total_created,
                "updated": total_updated,
                "skipped": total_skipped,
            }

        except Exception as e:
            duration = int((time.time() - t0) * 1000)
            account.last_error = str(e)[:500]
            await _finish_sync_log(log, "failed", str(e)[:500], duration_ms=duration)
            await db.commit()
            logger.error(f"[WecomAlbum] Product sync failed for {tenant_id}: {e}")
            return {"success": False, "error": str(e)}
