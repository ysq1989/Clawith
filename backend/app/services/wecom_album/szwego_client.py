"""WeChat Business Album — szwego API client.

Extends the base szwego client with friend/owner list fetching.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from loguru import logger


SZWEGO_BASE_URL = "https://www.szwego.com"
SZWEGO_USER_INFO_URL = f"{SZWEGO_BASE_URL}/increase/api/v3/my/findUserBasisInfo"
SZWEGO_ALBUM_MOMENTS_URL = f"{SZWEGO_BASE_URL}/album/moments"
SZWEGO_ALBUM_LIST_URL = f"{SZWEGO_BASE_URL}/service/album/get_album_list.jsp"

SZWEGO_HTTP_TIMEOUT = 30
SZWEGO_MAX_RETRIES = 3
SZWEGO_MAX_LIST_PAGES = 50


class SzwegoAPIError(Exception):
    pass


class WecomAlbumSzwegoClient:
    """Async HTTP client for szwego (微商相册) API.

    Handles token-based auth (query param), retry on transient errors,
    and friends/products fetching with pagination.
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
            "User-Agent": "Mozilla/5.0 (compatible; FutureStaffWecomAlbum/1.0)",
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

                # Token-related errors — don't retry, fail immediately
                token_errors = ("登录已超时", "token", "未登录", "请先登录", "授权", "获取用户信息失败")
                if any(kw in errmsg for kw in token_errors):
                    raise SzwegoAPIError(f"szwego token 无效或已过期，请在系统设置中重新填写 token（错误: {errmsg}）")

                if "服务器偷懒" in errmsg and attempt < SZWEGO_MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(0.3 * attempt)
                    continue
                raise SzwegoAPIError(errmsg)

            except httpx.HTTPStatusError as e:
                last_error = f"HTTP {e.response.status_code}"
                if e.response.status_code in (401, 403):
                    raise SzwegoAPIError(f"szwego token 无效或已过期（HTTP {e.response.status_code}），请在系统设置中重新填写")
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
        """Get album owner info."""
        data = await self._get(SZWEGO_USER_INFO_URL)
        return data.get("result", {})

    async def fetch_friends_list(self, max_pages: int = SZWEGO_MAX_LIST_PAGES) -> list[dict]:
        """Fetch the full list of followed shops/friends (suppliers).

        Uses the album list endpoint with act=attention_enc (following list).
        Paginates via page_index (1-based).

        Returns list of shop dicts with keys:
            shop_id, shop_name, shop_icon, album_id, new_goods, total_goods, isDel, etc.
        """
        all_shops: list[dict] = []
        seen_ids: set[str] = set()

        for page_index in range(1, max_pages + 1):
            params = {
                "act": "attention_enc",
                "search_value": "",
                "tag_id": "",
                "page_index": str(page_index),
                "_t": str(int(time.time() * 1000)),
            }

            try:
                data = await self._get(SZWEGO_ALBUM_LIST_URL, params=params)
            except SzwegoAPIError as e:
                logger.warning(f"[WecomAlbum] Friends list page {page_index} failed: {e}")
                break

            result = data.get("result", {})
            shops = result.get("shop_list", [])

            if page_index == 1:
                logger.info(f"[WecomAlbum] Friends list response keys: {list(result.keys())}, shop_list count: {len(shops)}")
                if shops:
                    logger.info(f"[WecomAlbum] First shop keys: {list(shops[0].keys())}")

            if not shops:
                break

            new_count = 0
            for shop in shops:
                # album_id is the primary identifier, fallback to shop_id/user_id
                sid = str(shop.get("album_id", shop.get("shop_id", shop.get("user_id", ""))))
                if not sid or sid in seen_ids:
                    continue
                # Skip deleted shops
                if shop.get("isDel") or shop.get("is_del"):
                    continue
                seen_ids.add(sid)
                all_shops.append(shop)
                new_count += 1

            if new_count == 0:
                break

            # Check hasMore (three-tier fallback matching lnzx4.0 PHP logic)
            if "hasMore" in result:
                has_more = bool(result["hasMore"])
            elif "isLoadMore" in result:
                has_more = bool(result["isLoadMore"])
            else:
                has_more = len(shops) >= 28  # Heuristic: full page means likely more

            # Heuristic: if page returned fewer than 28 items, assume last page
            if len(shops) < 28:
                break

        logger.info(f"[WecomAlbum] Fetched {len(all_shops)} friends/suppliers from szwego")
        return all_shops

    async def fetch_products(
        self,
        max_pages: int = 50,
        cutoff_timestamp: int | None = None,
    ) -> list[dict]:
        """Fetch products from album with timestamp-based pagination.

        Args:
            max_pages: Maximum pages to fetch.
            cutoff_timestamp: If set, stop scanning when encountering items
                older than this millisecond timestamp.

        Returns list of raw product dicts.
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

            new_items = []
            for item in items:
                gid = str(item.get("goods_id", item.get("item_id", item.get("id", ""))))
                if gid and gid not in seen_ids:
                    seen_ids.add(gid)
                    new_items.append(item)

                    # Check cutoff for incremental sync
                    if cutoff_timestamp:
                        item_ts = _parse_item_timestamp(item)
                        if item_ts and item_ts < cutoff_timestamp:
                            # Item is older than cutoff — stop here
                            return all_items

            if not new_items:
                break

            all_items.extend(new_items)

            # Pagination
            pagination = result.get("pagination", {})
            if not pagination.get("isLoadMore", False):
                break
            next_ts = pagination.get("pageTimestamp", "")
            if not next_ts or str(next_ts) == str(page_timestamp):
                break
            page_timestamp = str(next_ts)

        logger.info(f"[WecomAlbum] Fetched {len(all_items)} products from szwego")
        return all_items


def _parse_item_timestamp(item: dict) -> int | None:
    """Extract update_time or create_time as millisecond timestamp."""
    for key in ("update_time", "createTime", "create_time", "updateTime"):
        val = item.get(key)
        if val:
            try:
                ts = int(val)
                # If it looks like seconds (< 1e12), convert to ms
                if ts < 1_000_000_000_000:
                    ts *= 1000
                return ts
            except (ValueError, TypeError):
                continue
    return None


def normalize_supplier(shop: dict) -> dict:
    """Normalize a szwego shop dict to our supplier schema.

    szwego shop item keys (from lnzx4.0 PHP analysis):
        album_id, shop_id, user_id — identifiers (album_id is primary)
        shop_name, user_name — display name
        user_icon, avatar — avatar URL
        new_goods, total_goods — product counts
        isDel — deletion flag
    """
    # album_id is the primary identifier in szwego
    album_id = str(shop.get("album_id", ""))
    shop_id = str(shop.get("shop_id", shop.get("user_id", "")))
    external_id = album_id or shop_id

    return {
        "external_id": external_id,
        "shop_id": shop_id,
        "name": shop.get("shop_name", shop.get("user_name", "Unknown")),
        "avatar": shop.get("user_icon", shop.get("avatar", "")),
        "album_id": album_id,
        "total_products": int(shop.get("total_goods", 0)),
        "new_products": int(shop.get("new_goods", 0)),
    }


def normalize_product(raw: dict) -> dict:
    """Normalize a szwego product dict to our product schema."""
    # Price
    price = _safe_float(raw.get("itemNamePrice") or raw.get("itemPrice"))
    title = (raw.get("title") or "").strip()

    # Images
    imgs = raw.get("imgs", []) or raw.get("imgsSrc", [])
    if isinstance(imgs, str):
        imgs = [u.strip() for u in imgs.split(",") if u.strip()]
    main_image = imgs[0] if imgs else (raw.get("videoThumbImg") or "")

    # Tags
    raw_tags = raw.get("tags", []) or []
    tags = [t.get("tagName", "") for t in raw_tags if isinstance(t, dict) and t.get("tagName")]

    # Source URL
    source_url = raw.get("link", "")
    if source_url and not source_url.startswith("http"):
        source_url = f"https://www.szwego.com{source_url}"

    # Timestamp
    szwego_ts = None
    for key in ("update_time", "createTime", "create_time", "updateTime"):
        val = raw.get(key)
        if val:
            try:
                ts = int(val)
                if ts < 1_000_000_000_000:
                    ts *= 1000
                from datetime import datetime, timezone
                szwego_ts = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                break
            except (ValueError, TypeError):
                continue

    return {
        "goods_id": str(raw.get("goods_id", raw.get("selfGoodsId", raw.get("id", "")))),
        "title": title,
        "price": price,
        "images": imgs,
        "main_image": main_image,
        "video_url": raw.get("videoURL") or raw.get("videoUrl") or "",
        "shop_name": raw.get("shop_name", ""),
        "shop_id": str(raw.get("shop_id", raw.get("selfShopId", ""))),
        "source_url": source_url,
        "tags": tags,
        "attributes": {
            "sku": raw.get("sku", {}),
            "totalStock": raw.get("totalStock"),
            "goodsNum": raw.get("goodsNum", ""),
        },
        "szwego_created_at": szwego_ts,
    }


def compute_source_hash(raw: dict) -> str:
    """Compute a hash for dedup/update detection."""
    import hashlib
    parts = "|".join([
        str(raw.get("title", "")),
        str(raw.get("itemNamePrice", "")),
        str(raw.get("update_time", "")),
    ])
    return hashlib.sha1(parts.encode()).hexdigest()


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
