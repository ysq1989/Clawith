"""WeChat Business Album — sync service.

Orchestrates supplier discovery and product syncing from szwego.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from loguru import logger
from sqlalchemy import select, func

from app.database import async_session
from app.models.wecom_album import WecomAlbumAccount, WecomAlbumSupplier, WecomAlbumProduct
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


async def sync_suppliers(tenant_id: uuid.UUID) -> dict:
    """Sync suppliers (friends) from szwego.

    1. Load account config
    2. Fetch friends list from szwego
    3. Upsert suppliers
    4. Return sync summary
    """
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == tenant_id)
        )
        account = result.scalar_one_or_none()
        if not account or not account.is_active:
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
                    supplier.album_id = norm["album_id"]
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

            account.last_owner_sync_at = datetime.now(timezone.utc)
            account.last_error = None
            await db.commit()

            logger.info(f"[WecomAlbum] Supplier sync for {tenant_id}: {created} created, {updated} updated")
            return {
                "success": True,
                "total": synced,
                "created": created,
                "updated": updated,
            }

        except Exception as e:
            account.last_error = str(e)[:500]
            await db.commit()
            logger.error(f"[WecomAlbum] Supplier sync failed for {tenant_id}: {e}")
            return {"success": False, "error": str(e)}


async def sync_products(tenant_id: uuid.UUID) -> dict:
    """Sync products from all active suppliers' albums.

    1. Load account config
    2. Fetch products with timestamp-based pagination
    3. Upsert products by goods_id + tenant
    4. Return sync summary
    """
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == tenant_id)
        )
        account = result.scalar_one_or_none()
        if not account or not account.is_active:
            return {"success": False, "error": "No active szwego account configured"}

        # Compute cutoff for incremental sync
        cutoff_ts = None
        if account.last_product_sync_at and account.product_sync_stale_hours:
            cutoff_dt = account.last_product_sync_at - timedelta(hours=account.product_sync_stale_hours)
            cutoff_ts = int(cutoff_dt.timestamp() * 1000)

        try:
            client = WecomAlbumSzwegoClient(account.token)
            raw_products = await client.fetch_products(cutoff_timestamp=cutoff_ts)

            # Build supplier lookup by shop_id
            suppliers_result = await db.execute(
                select(WecomAlbumSupplier).where(
                    WecomAlbumSupplier.tenant_id == tenant_id,
                    WecomAlbumSupplier.is_active == True,
                )
            )
            suppliers = suppliers_result.scalars().all()
            shop_to_supplier: dict[str, WecomAlbumSupplier] = {}
            for s in suppliers:
                if s.shop_id:
                    shop_to_supplier[s.shop_id] = s
                if s.external_id:
                    shop_to_supplier[s.external_id] = s

            created = 0
            updated = 0
            skipped = 0

            for raw in raw_products:
                norm = normalize_product(raw)
                if not norm["goods_id"]:
                    skipped += 1
                    continue

                # Find matching supplier by shop_id
                product_shop_id = norm.get("shop_id", "")
                supplier = shop_to_supplier.get(product_shop_id)

                # Skip products from disabled/unmatched suppliers
                if not supplier:
                    skipped += 1
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
                    # Update existing product
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
                    if supplier:
                        product.supplier_id = supplier.id
                    updated += 1
                else:
                    product = WecomAlbumProduct(
                        tenant_id=tenant_id,
                        supplier_id=supplier.id if supplier else uuid.uuid4(),
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

            account.last_product_sync_at = datetime.now(timezone.utc)
            account.last_error = None
            await db.commit()

            logger.info(
                f"[WecomAlbum] Product sync for {tenant_id}: "
                f"{created} created, {updated} updated, {skipped} skipped"
            )
            return {
                "success": True,
                "total": created + updated,
                "created": created,
                "updated": updated,
                "skipped": skipped,
            }

        except Exception as e:
            account.last_error = str(e)[:500]
            await db.commit()
            logger.error(f"[WecomAlbum] Product sync failed for {tenant_id}: {e}")
            return {"success": False, "error": str(e)}
