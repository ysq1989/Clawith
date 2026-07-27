"""WeChat Business Album — AI title cleaning service.

Uses the company's configured LLM to clean product titles and extract cost prices.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

import httpx
from loguru import logger
from sqlalchemy import select

from app.database import async_session
from app.models.llm import LLMModel
from app.models.wecom_album import WecomAlbumAccount, WecomAlbumProduct

AI_TIMEOUT = 60

SYSTEM_PROMPT = "你是商品标题清洗助手，负责清洗商品标题并提取成本价。请严格按要求返回 JSON，不要输出任何解释。"

USER_PROMPT_TEMPLATE = """请清洗以下商品标题并提取成本价。
规则：
1) clean_title 保留品牌/规格/数量等关键信息，去掉营销词、联系方式、表情、重复符号和多余空格；
2) cost 仅返回数字，可小数；无法判断返回 0；
3) 只输出 JSON 对象：{{"clean_title":"...","cost":0}}
商品标题：{title}"""

BATCH_USER_PROMPT_TEMPLATE = """请清洗以下商品标题并提取成本价。
规则：
1) clean_title 保留品牌/规格/数量等关键信息，去掉营销词、联系方式、表情、重复符号和多余空格；
2) cost 仅返回数字，可小数；无法判断返回 0；
3) 只输出 JSON 数组：[{{"item_id":"xxx","clean_title":"...","cost":0}},...]
商品列表：{items_json}"""


async def _get_ai_model(tenant_id: uuid.UUID) -> LLMModel | None:
    """Get the AI model selected in the wecom-album account config."""
    async with async_session() as db:
        # Get account's selected model
        acct_result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == tenant_id)
        )
        account = acct_result.scalar_one_or_none()
        if not account or not account.ai_model_id:
            return None

        model_result = await db.execute(
            select(LLMModel).where(
                LLMModel.id == account.ai_model_id,
                LLMModel.enabled == True,
            )
        )
        return model_result.scalar_one_or_none()


async def _call_llm_api(model: LLMModel, system: str, user: str) -> str:
    """Call LLM API using the selected model's config."""
    base_url = model.base_url or "https://apihub.agnes-ai.com/v1"
    # Ensure base_url ends with /chat/completions
    if not base_url.endswith("/chat/completions"):
        base_url = base_url.rstrip("/") + "/chat/completions"

    headers = {
        "Authorization": f"Bearer {model.api_key_encrypted}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
        "max_tokens": 2048,
    }

    timeout = model.request_timeout or AI_TIMEOUT
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(base_url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

    return data["choices"][0]["message"]["content"]


def _parse_clean_result(text: str) -> dict | None:
    """Parse AI response JSON, extracting clean_title and cost."""
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{[^{}]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _parse_batch_result(text: str) -> list | None:
    """Parse batch AI response JSON array."""
    text = text.strip()

    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(1).strip())
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


async def clean_single(product_id: uuid.UUID) -> dict:
    """Clean a single product's title using AI."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumProduct).where(WecomAlbumProduct.id == product_id)
        )
        product = result.scalar_one_or_none()
        if not product:
            return {"success": False, "error": "Product not found"}

        model = await _get_ai_model(product.tenant_id)
        if not model:
            return {"success": False, "error": "No AI model configured in system settings"}

        user_prompt = USER_PROMPT_TEMPLATE.format(title=product.title)

        try:
            response_text = await _call_llm_api(model, SYSTEM_PROMPT, user_prompt)
            parsed = _parse_clean_result(response_text)

            if parsed:
                product.clean_title = parsed.get("clean_title", product.title)
                try:
                    product.clean_price = float(parsed.get("cost", 0) or 0)
                except (ValueError, TypeError):
                    product.clean_price = 0
                product.ai_cleaned_at = datetime.now(timezone.utc)
                product.status = "pending_sync"
                await db.commit()
                return {
                    "success": True,
                    "clean_title": product.clean_title,
                    "clean_price": float(product.clean_price),
                }
            else:
                return {"success": False, "error": "Failed to parse AI response"}

        except Exception as e:
            logger.error(f"[WecomAlbum] AI clean failed for {product_id}: {e}")
            return {"success": False, "error": str(e)}


async def clean_batch(product_ids: list[uuid.UUID]) -> dict:
    """Clean multiple products' titles using AI (batch mode)."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumProduct).where(WecomAlbumProduct.id.in_(product_ids))
        )
        products = result.scalars().all()

        if not products:
            return {"success": False, "error": "No products found"}

        tenant_id = products[0].tenant_id
        model = await _get_ai_model(tenant_id)
        if not model:
            return {"success": False, "error": "No AI model configured in system settings"}

        items = [{"item_id": str(p.id), "title": p.title} for p in products]
        user_prompt = BATCH_USER_PROMPT_TEMPLATE.format(items_json=json.dumps(items, ensure_ascii=False))

        try:
            response_text = await _call_llm_api(model, SYSTEM_PROMPT, user_prompt)
            parsed_list = _parse_batch_result(response_text)

            if not parsed_list:
                return {"success": False, "error": "Failed to parse batch AI response"}

            lookup = {str(item.get("item_id", "")): item for item in parsed_list}

            cleaned = 0
            for p in products:
                item = lookup.get(str(p.id))
                if item:
                    p.clean_title = item.get("clean_title", p.title)
                    try:
                        p.clean_price = float(item.get("cost", 0) or 0)
                    except (ValueError, TypeError):
                        p.clean_price = 0
                    p.ai_cleaned_at = datetime.now(timezone.utc)
                    p.status = "pending_sync"
                    cleaned += 1

            await db.commit()
            return {"success": True, "cleaned": cleaned, "total": len(products)}

        except Exception as e:
            logger.error(f"[WecomAlbum] Batch AI clean failed: {e}")
            return {"success": False, "error": str(e)}


async def clean_supplier_products(supplier_id: uuid.UUID, limit: int = 100) -> dict:
    """Clean all uncleaned products for a supplier."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumProduct).where(
                WecomAlbumProduct.supplier_id == supplier_id,
                WecomAlbumProduct.ai_cleaned_at.is_(None),
            ).limit(limit)
        )
        products = result.scalars().all()

        if not products:
            return {"success": True, "cleaned": 0, "message": "No uncleaned products"}

        total_cleaned = 0
        batch_size = 20

        for i in range(0, len(products), batch_size):
            batch = products[i : i + batch_size]
            batch_ids = [p.id for p in batch]
            result = await clean_batch(batch_ids)
            if result.get("success"):
                total_cleaned += result.get("cleaned", 0)

        return {"success": True, "cleaned": total_cleaned, "total": len(products)}
