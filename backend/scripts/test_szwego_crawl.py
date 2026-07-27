"""Test script for szwego crawl integration.

Usage:
    cd backend
    python -m scripts.test_szwego_crawl

This script tests:
1. szwego API connection with the provided token
2. Fetching products from the album
3. Normalizing product data
"""

import asyncio
import json
import sys
import os

# Ensure backend app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.product_hub.crawl_service import (
    SzwegoClient,
    SzwegoAPIError,
    _normalize_szwego_product,
)


TEST_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiYzNjOTI5Yzc5MmNmNzBlZTYyODBiYWJmYTk5ZTUyNDEiLCJzdGFmZklkIjoiUzI2MDIwMzE3MzcyNDc3MjIwMDAwMjUzNyIsInRva2VuIjoiTkRRd01USTFNMFpCUTBaRVFUY3dNakkxUTBKRk1VWTFSRU13T0RjNFJEWkJNa0UzTlVGQ05rWkZNVFZGUmtNeE9UY3lSRUV5TmpnM1JETXdRVFl4TkROR1FUVkdOVU0zT1RrNVFVSkZNekl6UVVVME1EWkZOVGd5TVVaR1F6QTUiLCJhbGJ1bUlkIjoiQTIwMjQxMjIyMTIwNTEwMjQxMjAwMTg5MSIsInYiOjIsIm1hc3RlckFjY291bnQiOnRydWV9.kzNX74mvrl-hS1N7qjMhtU54CFYydGsGxznSgLR0bj0"


async def main():
    print("=" * 60)
    print("  szwego (微商相册) Crawl Integration Test")
    print("=" * 60)

    client = SzwegoClient(TEST_TOKEN)

    # 1. Test connection
    print("\n[1] Testing connection...")
    try:
        user_info = await client.get_user_info()
        album_id = user_info.get("albumId", "")
        album_name = user_info.get("albumName", "")
        fans = user_info.get("totalFans", 0)
        vip = user_info.get("vipDetail", {}).get("vipStatus", 0)
        print(f"    ✅ Connected!")
        print(f"    Album ID:    {album_id}")
        print(f"    Album Name:  {album_name}")
        print(f"    Total Fans:  {fans}")
        print(f"    VIP Status:  {'Active' if vip else 'Inactive'}")
    except SzwegoAPIError as e:
        print(f"    ❌ Connection failed: {e}")
        return

    # 2. Fetch first page of products
    print("\n[2] Fetching products (first page only)...")
    try:
        products = await client.fetch_all_products(max_pages=1)
        print(f"    ✅ Fetched {len(products)} products")
    except SzwegoAPIError as e:
        print(f"    ❌ Fetch failed: {e}")
        return

    if not products:
        print("    ⚠️  No products found")
        return

    # 3. Normalize and display
    print("\n[3] Normalizing products...")
    normalized = [_normalize_szwego_product(p, None, "测试供应链") for p in products[:5]]

    for i, prod in enumerate(normalized, 1):
        print(f"\n    ── Product {i} ──")
        print(f"    Title:       {prod['title'][:60]}")
        print(f"    Price:       ¥{prod['price']}" if prod['price'] else "    Price:       N/A")
        print(f"    Images:      {len(prod['images'])} images")
        print(f"    Shop:        {prod['source_shop_name']}")
        print(f"    Tags:        {', '.join(prod['tags'][:3]) if prod['tags'] else 'none'}")
        print(f"    Source URL:  {prod['source_url'][:60]}...")

    print("\n" + "=" * 60)
    print(f"  ✅ Test complete! {len(products)} products available for crawling.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
