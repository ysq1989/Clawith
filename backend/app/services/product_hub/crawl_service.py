"""Product Hub — crawl service for fetching products from szwego (微商相册).

The szwego API is the backend for the WeChat business album (微商相册) platform.
Products are fetched via HTTP GET with token-based authentication.

API endpoints:
  - User info: https://www.szwego.com/increase/api/v3/my/findUserBasisInfo
  - Products:  https://www.szwego.com/album/moments
  - Shop list: https://www.szwego.com/service/album/get_album_list.jsp

Authentication: token passed as URL query parameter (not header).
Pagination: timestamp-based (millisecond timestamps in pagination.pageTimestamp).
"""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from loguru import logger

from app.database import async_session
from app.models.product_hub import ProductHubCrawlTask, ProductHubProduct, ProductHubSupplyChain
from sqlalchemy import select, update


# ─── szwego API constants ─────────────────────────────────────────────────────

SZWEGO_BASE_URL = "https://www.szwego.com"
SZWEGO_USER_INFO_URL = f"{SZWEGO_BASE_URL}/increase/api/v3/my/findUserBasisInfo"
SZWEGO_ALBUM_MOMENTS_URL = f"{SZWEGO_BASE_URL}/album/moments"
SZWEGO_ALBUM_LIST_URL = f"{SZWEGO_BASE_URL}/service/album/get_album_list.jsp"

SZWEGO_HTTP_TIMEOUT = 30
SZWEGO_MAX_PAGES = 50
SZWEGO_MAX_RETRIES = 3


# ─── szwego API Client ────────────────────────────────────────────────────────


class SzwegoClient:
    """Async HTTP client for the szwego (微商相册) API.

    Authentication is via token query parameter, not HTTP header.
    """

    def __init__(self, token: str):
        self.token = token.strip()

    async def _get(self, url: str, params: dict | None = None) -> dict:
        """Make a GET request with retry logic."""
        query = {
            "client_type": "net",
            "token": self.token,
            "channel": "pc_client",
            **(params or {}),
        }
        headers = {
            "Accept": "application/json,text/plain,*/*",
            "User-Agent": "Mozilla/5.0 (compatible; FutureStaffSync/1.0)",
        }

        last_error = ""
        for attempt in range(1, SZWEGO_MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=SZWEGO_HTTP_TIMEOUT, verify=False) as client:
                    resp = await client.get(url, params=query, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()

                errcode = data.get("errcode", -1)
                if errcode == 0:
                    return data

                errmsg = data.get("errmsg", "szwego error")
                last_error = errmsg
                # Retry on transient errors
                if "服务器偷懒" in errmsg and attempt < SZWEGO_MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(0.3 * attempt)
                    continue
                raise SzwegoAPIError(errmsg)

            except httpx.HTTPStatusError as e:
                last_error = f"HTTP {e.response.status_code}"
                if attempt < SZWEGO_MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(0.5 * attempt)
                    continue
                raise SzwegoAPIError(f"szwego HTTP error: {last_error}")
            except SzwegoAPIError:
                raise
            except Exception as e:
                last_error = str(e)
                if attempt < SZWEGO_MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(0.5 * attempt)
                    continue
                raise SzwegoAPIError(f"szwego network error: {last_error}")

        raise SzwegoAPIError(f"szwego failed after {SZWEGO_MAX_RETRIES} retries: {last_error}")

    async def get_user_info(self) -> dict:
        """Get album owner info (used for connection testing)."""
        data = await self._get(SZWEGO_USER_INFO_URL)
        return data.get("result", {})

    async def fetch_all_products(self, max_pages: int = SZWEGO_MAX_PAGES) -> list[dict]:
        """Fetch all products from the album with timestamp-based pagination.

        Returns list of raw product dicts from szwego API.
        """
        all_items: list[dict] = []
        seen_ids: set[str] = set()
        page_timestamp = ""

        for page_num in range(1, max_pages + 1):
            params: dict[str, Any] = {
                "searchValue": "",
                "searchImg": "",
                "noCache": 0,
                "slipType": 1,
                "requestDataType": "",
                "_t": str(int(time.time() * 1000)),
            }
            if page_timestamp:
                params["timestamp"] = page_timestamp

            data = await self._get(SZWEGO_ALBUM_MOMENTS_URL, params=params)
            result = data.get("result", {})
            items = result.get("items", result.get("list", []))

            if not items:
                break

            # Dedup by goods_id
            new_items = []
            for item in items:
                gid = str(item.get("goods_id", item.get("item_id", item.get("id", ""))))
                if gid and gid not in seen_ids:
                    seen_ids.add(gid)
                    new_items.append(item)

            if not new_items:
                break

            all_items.extend(new_items)
            logger.info(f"[Szwego] Page {page_num}: fetched {len(new_items)} new products (total: {len(all_items)})")

            # Pagination
            pagination = result.get("pagination", {})
            if not pagination.get("isLoadMore", False):
                break
            next_ts = pagination.get("pageTimestamp", "")
            if not next_ts or str(next_ts) == str(page_timestamp):
                break
            page_timestamp = str(next_ts)

        return all_items


class SzwegoAPIError(Exception):
    pass


# ─── Product normalization ────────────────────────────────────────────────────


def _normalize_szwego_product(raw: dict, supply_chain_id: uuid.UUID | None, supply_chain_name: str | None) -> dict:
    """Convert a raw szwego product dict to our standard schema."""
    # Price: try itemNamePrice first, then extract from title
    price = _safe_float(raw.get("itemNamePrice") or raw.get("itemPrice"))
    title = (raw.get("title") or "").strip()

    if price is None or price == 0:
        price = _extract_price_from_title(title)

    # Images: imgs array contains direct URLs
    imgs = raw.get("imgs", []) or raw.get("imgsSrc", [])
    if isinstance(imgs, str):
        imgs = [u.strip() for u in imgs.split(",") if u.strip()]

    # Main image
    main_image = imgs[0] if imgs else (raw.get("videoThumbImg") or "")

    # Title cleaning: remove emoji markers and marketing fluff
    clean_title = _clean_title(title)

    # Description: everything after first line
    parts = title.split("\n", 1)
    description = parts[1].strip()[:500] if len(parts) > 1 else ""

    # Tags from szwego
    raw_tags = raw.get("tags", []) or []
    tags = [t.get("tagName", "") for t in raw_tags if isinstance(t, dict) and t.get("tagName")]

    # Source info
    source_url = raw.get("link", "")
    if source_url and not source_url.startswith("http"):
        source_url = f"https://www.szwego.com{source_url}"

    shop_name = raw.get("shop_name", "")
    shop_id = raw.get("shop_id", raw.get("selfShopId", ""))
    goods_id = raw.get("goods_id", raw.get("selfGoodsId", ""))

    return {
        "title": clean_title,
        "description": description,
        "price": price,
        "original_price": None,
        "images": imgs,
        "main_image": main_image,
        "source_url": source_url,
        "source_shop_name": shop_name,
        "source_shop_id": str(shop_id),
        "source_goods_id": str(goods_id),
        "supply_chain_id": supply_chain_id,
        "supply_chain_name": supply_chain_name,
        "tags": tags,
        "attributes": {
            "sku": raw.get("sku", {}),
            "totalStock": raw.get("totalStock"),
            "videoURL": raw.get("videoURL") or raw.get("videoUrl") or "",
            "goodsNum": raw.get("goodsNum", ""),
            "themeType": raw.get("themeType"),
        },
    }


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _extract_price_from_title(title: str) -> float | None:
    """Extract price from title text. Handles formats like:
    - 💰8000
    - 💰1.18万
    - 💰25000
    - 价格:8000
    - 秒🉐718
    """
    import re
    # Match price patterns: number with optional 万/w suffix
    # IMPORTANT: 万 patterns must come BEFORE non-万 patterns to avoid partial matches
    # Each tuple: (pattern, has_wan_multiplier)
    patterns = [
        (r'💰\s*(\d+(?:\.\d+)?)\s*万', True),    # 💰1.18万
        (r'💰\s*(\d+(?:\.\d+)?)\s*(?!万)', False), # 💰8000 (negative lookahead for 万)
        (r'🉐\s*(\d+(?:\.\d+)?)\s*万', True),     # 🀄1.18万
        (r'🉐\s*(\d+(?:\.\d+)?)\s*(?!万)', False), # 🀄718
        (r'秒\s*🉐\s*(\d+(?:\.\d+)?)', False),    # 秒🉐718
        (r'(\d+(?:\.\d+)?)\s*万', True),           # 2.4万
        (r'价格[：:]\s*(\d+(?:\.\d+)?)', False),   # 价格:8000
    ]
    for pattern, has_wan in patterns:
        match = re.search(pattern, title)
        if match:
            value = float(match.group(1))
            if has_wan:
                value *= 10000
            if value > 0:
                return value
    return None


def _clean_title(title: str) -> str:
    """Clean szwego title: remove emoji markers, marketing fluff, normalize."""
    import re
    # Take first line only
    first_line = title.split("\n")[0].strip()

    # Remove common szwego emoji markers
    cleaned = re.sub(r'[💰🔥🌹🉐💲🏷️📦✨💎👑🌸]', '', first_line)
    # Remove extra whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Truncate
    return cleaned[:200] if cleaned else title[:200]


def _product_dedup_key(product: dict) -> str:
    """Generate dedup key based on source goods_id or title+shop."""
    gid = product.get("source_goods_id", "")
    if gid:
        return gid
    return hashlib.md5(f"{product.get('title', '')}|{product.get('source_shop_name', '')}".encode()).hexdigest()


# ─── Crawl orchestration ─────────────────────────────────────────────────────


async def test_szwego_connection(token: str) -> dict:
    """Test connection to szwego API with the given token.

    Returns user info dict on success, raises on failure.
    """
    client = SzwegoClient(token)
    return await client.get_user_info()


async def execute_crawl_task(task_id: uuid.UUID) -> None:
    """Execute a crawl task: fetch products from szwego → normalize → store.

    This is the main entry point called by the background worker.
    """
    async with async_session() as db:
        result = await db.execute(
            select(ProductHubCrawlTask).where(ProductHubCrawlTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            logger.error(f"[Crawl] Task {task_id} not found")
            return

        task.status = "running"
        await db.commit()

        try:
            # Load supply chain config
            sc_config: dict = {}
            supply_chain_name = None
            if task.supply_chain_id:
                sc_result = await db.execute(
                    select(ProductHubSupplyChain).where(
                        ProductHubSupplyChain.id == task.supply_chain_id
                    )
                )
                sc = sc_result.scalar_one_or_none()
                if sc:
                    sc_config = sc.crawl_config or {}
                    supply_chain_name = sc.display_name

            crawl_config = {**sc_config, **(task.crawl_config or {})}
            token = crawl_config.get("token", "")
            if not token:
                raise ValueError("No szwego token configured in crawl_config")

            max_pages = crawl_config.get("max_pages", SZWEGO_MAX_PAGES)

            # Fetch from szwego
            client = SzwegoClient(token)
            raw_products = await client.fetch_all_products(max_pages=max_pages)

            if not raw_products:
                task.status = "done"
                task.products_count = 0
                task.finished_at = datetime.now(timezone.utc)
                await db.commit()
                logger.info(f"[Crawl] Task {task_id}: no products found")
                return

            # Normalize and dedup
            normalized = []
            seen_keys: set[str] = set()
            for raw in raw_products:
                prod = _normalize_szwego_product(raw, task.supply_chain_id, supply_chain_name)
                key = _product_dedup_key(prod)
                if key not in seen_keys:
                    seen_keys.add(key)
                    normalized.append(prod)

            # Store products
            stored_count = 0
            for prod in normalized:
                ph_product = ProductHubProduct(
                    tenant_id=task.tenant_id,
                    title=prod["title"],
                    description=prod["description"],
                    price=prod["price"],
                    original_price=prod["original_price"],
                    images=prod["images"],
                    main_image=prod["main_image"],
                    _source_url=prod["source_url"],
                    _source_shop_name=prod["source_shop_name"],
                    _source_shop_id=prod["source_shop_id"],
                    _crawl_task_id=task.id,
                    _supply_chain_id=prod["supply_chain_id"],
                    supply_chain_name=prod["supply_chain_name"],
                    tags=prod["tags"],
                    attributes=prod["attributes"],
                    status="active",
                )
                db.add(ph_product)
                stored_count += 1

            # Update task stats
            task.products_count = stored_count
            task.clean_count = 0
            task.status = "done"
            task.finished_at = datetime.now(timezone.utc)

            # Update supply chain counter
            if task.supply_chain_id:
                await db.execute(
                    update(ProductHubSupplyChain)
                    .where(ProductHubSupplyChain.id == task.supply_chain_id)
                    .values(
                        last_crawl_at=datetime.now(timezone.utc),
                        products_count=ProductHubSupplyChain.products_count + stored_count,
                    )
                )

            await db.commit()
            logger.info(
                f"[Crawl] Task {task_id} done: {stored_count} products "
                f"(from {len(raw_products)} raw, deduped to {len(normalized)})"
            )

        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)[:500]
            task.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.error(f"[Crawl] Task {task_id} failed: {e}")
            raise
