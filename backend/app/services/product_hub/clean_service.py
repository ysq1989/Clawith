"""Product Hub — LLM-powered cleaning and classification service.

Takes raw products from the crawl service and applies:
1. Title cleaning (remove ad words, normalize)
2. Auto-classification (match to category tree)
3. Tag generation (AI-generated keyword tags)
4. Summary generation (one-line product description)
5. Quality scoring (0-100)
6. Deduplication detection
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from loguru import logger
from sqlalchemy import select, func

from app.database import async_session
from app.models.product_hub import (
    ProductHubCategory,
    ProductHubProduct,
    ProductHubSupplyChain,
)


async def _call_llm(prompt: str, system_prompt: str = "") -> str:
    """Call the LLM for text processing.

    Uses the same LLM client abstraction as the rest of the platform.
    Falls back to a simple pass-through if LLM is unavailable.
    """
    try:
        from app.services.llm.client import create_llm_client
        from app.services.llm.caller import call_llm

        client = create_llm_client(
            provider="openai",
            model="gpt-4o-mini",
        )
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await call_llm(client, messages, max_tokens=2000)
        return response.content or ""
    except Exception as e:
        logger.warning(f"[Clean] LLM call failed, using fallback: {e}")
        return ""


async def _get_tenant_categories(tenant_id: uuid.UUID) -> list[dict]:
    """Get existing categories for the tenant."""
    async with async_session() as db:
        result = await db.execute(
            select(ProductHubCategory).where(
                ProductHubCategory.tenant_id == tenant_id,
                ProductHubCategory.is_active == True,
            )
        )
        cats = result.scalars().all()
        return [{"id": str(c.id), "name": c.name} for c in cats]


async def clean_product_with_llm(product: ProductHubProduct, tenant_id: uuid.UUID) -> dict:
    """Use LLM to clean and classify a single product.

    Returns a dict with cleaned fields to update the product.
    """
    categories = await _get_tenant_categories(tenant_id)
    category_list = "\n".join([f"- {c['name']} (id: {c['id']})" for c in categories]) if categories else "No categories defined yet."

    system_prompt = """你是一个商品数据清洗助手。你的任务是：
1. 清洗商品标题（去除广告词、特殊符号、无意义的修饰语）
2. 为商品选择最合适的分类
3. 生成 3-5 个关键词标签
4. 生成一段简洁的商品描述（一句话）
5. 评估商品质量（0-100分）

请以 JSON 格式返回结果。"""

    prompt = f"""请清洗和分类以下商品：

标题：{product.title}
原始描述：{product.description or '无'}
价格：{product.price or '未知'}
标签：{product.tags or '无'}
属性：{json.dumps(product.attributes or {}, ensure_ascii=False)}

可用分类：
{category_list}

请返回 JSON：
{{
  "cleaned_title": "清洗后的标题",
  "category_id": "分类ID（从上面选）或null",
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "一句话描述",
  "quality_score": 80
}}"""

    raw_response = await _call_llm(prompt, system_prompt)

    if not raw_response:
        # Fallback: basic cleaning without LLM
        return {
            "cleaned_title": product.title.strip()[:200],
            "category_id": None,
            "tags": [],
            "summary": product.description[:100] if product.description else "",
            "quality_score": None,
        }

    # Parse LLM response
    try:
        # Extract JSON from response (may be wrapped in markdown code block)
        text = raw_response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)
        return {
            "cleaned_title": result.get("cleaned_title", product.title)[:200],
            "category_id": uuid.UUID(result["category_id"]) if result.get("category_id") else None,
            "tags": result.get("tags", [])[:10],
            "summary": result.get("summary", "")[:500],
            "quality_score": min(100, max(0, float(result.get("quality_score", 50)))),
        }
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.warning(f"[Clean] Failed to parse LLM response: {e}")
        return {
            "cleaned_title": product.title.strip()[:200],
            "category_id": None,
            "tags": [],
            "summary": "",
            "quality_score": None,
        }


async def batch_clean_products(
    tenant_id: uuid.UUID,
    product_ids: list[uuid.UUID] | None = None,
    limit: int = 50,
) -> int:
    """Batch clean products using LLM.

    Args:
        tenant_id: Tenant to clean for
        product_ids: Specific product IDs to clean. If None, cleans uncleaned products.
        limit: Max products to process in this batch

    Returns:
        Number of products cleaned
    """
    async with async_session() as db:
        # Find products that haven't been cleaned yet (no category_id and no tags)
        q = (
            select(ProductHubProduct).where(
                ProductHubProduct.tenant_id == tenant_id,
                ProductHubProduct.status == "active",
                ProductHubProduct.category_id.is_(None),
                func.jsonb_array_length(ProductHubProduct.tags) == 0,
            )
            .limit(limit)
        )
        if product_ids:
            q = select(ProductHubProduct).where(
                ProductHubProduct.id.in_(product_ids),
                ProductHubProduct.tenant_id == tenant_id,
            )

        result = await db.execute(q)
        products = result.scalars().all()

        if not products:
            logger.info(f"[Clean] No products to clean for tenant {tenant_id}")
            return 0

        cleaned_count = 0
        for product in products:
            try:
                cleaned = await clean_product_with_llm(product, tenant_id)

                # Update product with cleaned data
                product.title = cleaned["cleaned_title"]
                product.category_id = cleaned["category_id"]
                product.tags = cleaned["tags"]
                product.clean_summary = cleaned["summary"]
                product.quality_score = cleaned["quality_score"]
                product.updated_at = datetime.now(timezone.utc)

                cleaned_count += 1
                logger.info(
                    f"[Clean] Product {product.id}: classified as "
                    f"category={cleaned['category_id']}, "
                    f"tags={cleaned['tags']}, "
                    f"quality={cleaned['quality_score']}"
                )
            except Exception as e:
                logger.error(f"[Clean] Failed to clean product {product.id}: {e}")
                continue

        await db.commit()
        logger.info(f"[Clean] Batch completed: {cleaned_count}/{len(products)} products cleaned")
        return cleaned_count


async def auto_clean_for_tenant(tenant_id: uuid.UUID) -> int:
    """Auto-clean all uncleaned products for a tenant.

    Called by the background scheduler or after crawl tasks complete.
    """
    return await batch_clean_products(tenant_id, limit=100)
