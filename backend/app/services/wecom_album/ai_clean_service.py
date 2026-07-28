"""WeChat Business Album — AI title cleaning service.

Uses the company's configured LLM (optimized for Agnes AI) to clean product
titles and extract cost prices. Supports vision (product images) for better
accuracy when the model supports it.
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
from app.services.llm.utils import get_model_api_key

AI_TIMEOUT = 60

# ─── Optimized prompts (Role + Task + Context + Requirements + Output Format) ───

DEFAULT_SYSTEM_PROMPT = """你是一位资深珠宝玉石行业商品数据专家，负责清洗微商相册商品标题、提取成本价，并判断商品是否值得同步到选品池。

## 核心能力
1. 理解珠宝玉石行业术语（翡翠、和田玉、钻石、黄金等）
2. 从混乱的营销标题中提取商品核心信息
3. 准确识别价格描述并转换为数字
4. 判断商品是否适合上架销售

## 清洗规则
- 保留：品牌名、材质、规格（尺寸/重量/克拉）、数量、品质描述
- 去除：营销词（秒杀/私域/完美/真实/诚信/厂家直销）、联系方式、表情符号、重复符号、多余空格
- 价格：仅提取成本价/批发价数字，忽略零售价、市场价等

## 跳过规则（sync=0 表示不同步，需说明原因）
以下商品应标记为不同步：
1. 标题过短或无意义（如只有表情、只有"新款"等）
2. 无明确价格信息且无法推断成本价
3. 明显是服务/加工/定制类（非成品商品）
4. 标题包含明显违规词（如"高仿""A货"等假冒相关）
5. 重复铺货（同一商品多次发布）

## 输出格式
严格输出 JSON，不要输出任何解释或思考过程。"""

DEFAULT_USER_PROMPT_TEMPLATE = """请清洗以下商品标题并提取成本价，同时判断是否值得同步到选品池。

## 商品标题
{title}

## 输出要求
严格输出 JSON 对象，不要输出任何其他内容：
{{"clean_title": "清洗后的标题", "cost": 0, "sync": 1, "skip_reason": ""}}

字段说明：
- clean_title: 清洗后的标题
- cost: 成本价（数字），无法判断填 0
- sync: 1=同步, 0=不同步
- skip_reason: 不同步时必填原因，同步时填空字符串

## 示例
输入：🌴正圈冰飘花 完美无瑕 尺寸：55.7/12.2/8.1 价格：小六3️⃣开！起荧光
输出：{{"clean_title": "正圈冰飘花 尺寸55.7/12.2/8.1", "cost": 0, "sync": 1, "skip_reason": ""}}

输入：💰翡翠A货 冰种观音 26x18x5mm 批发价3800
输出：{{"clean_title": "翡翠A货 冰种观音 26x18x5mm", "cost": 3800, "sync": 1, "skip_reason": ""}}

输入：🔥来图定制 手镯加工 100元起
输出：{{"clean_title": "来图定制 手镯加工", "cost": 0, "sync": 0, "skip_reason": "加工定制类非成品"}}

输入：👍新款上市
输出：{{"clean_title": "新款上市", "cost": 0, "sync": 0, "skip_reason": "标题无意义缺少商品信息"}}"""

DEFAULT_BATCH_USER_PROMPT_TEMPLATE = """请批量清洗以下商品标题并提取成本价，同时判断每个商品是否值得同步到选品池。

## 商品列表
{items_json}

## 输出要求
严格输出 JSON 数组，不要输出任何其他内容：
[{{"item_id": "xxx", "clean_title": "清洗后的标题", "cost": 0, "sync": 1, "skip_reason": ""}}, ...]

字段说明：
- clean_title: 清洗后的标题
- cost: 成本价（数字），无法判断填 0
- sync: 1=同步, 0=不同步
- skip_reason: 不同步时必填原因，同步时填空字符串

## 跳过规则
以下商品标记为 sync=0：
1. 标题过短或无意义
2. 无明确价格信息
3. 加工/定制/服务类（非成品）
4. 明显违规词（高仿/A货等假冒相关）
5. 重复铺货"""


async def _get_ai_model(tenant_id: uuid.UUID) -> LLMModel | None:
    """Get the AI model selected in the wecom-album account config."""
    async with async_session() as db:
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


async def _get_account_config(tenant_id: uuid.UUID) -> WecomAlbumAccount | None:
    """Get wecom-album account config for the tenant."""
    async with async_session() as db:
        result = await db.execute(
            select(WecomAlbumAccount).where(WecomAlbumAccount.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()


async def _call_llm_api(
    model: LLMModel,
    system: str,
    user: str,
    timeout: int = 60,
    images: list[str] | None = None,
    enable_thinking: bool = False,
) -> str:
    """Call LLM API using the selected model's config.

    Supports:
    - Vision: pass product image URLs for better accuracy
    - Thinking mode: enable for complex reasoning (Agnes compatible)
    """
    base_url = model.base_url or "https://apihub.agnes-ai.com/v1"
    if not base_url.endswith("/chat/completions"):
        base_url = base_url.rstrip("/") + "/chat/completions"

    # Build user message content
    if images:
        # Multimodal: text + images (OpenAI vision format)
        content = [{"type": "text", "text": user}]
        for img_url in images[:3]:  # Max 3 images per request
            content.append({
                "type": "image_url",
                "image_url": {"url": img_url},
            })
    else:
        content = user

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": content},
    ]

    body = {
        "model": model.model,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 2048,
    }

    # Enable thinking mode for Agnes models
    if enable_thinking:
        body["chat_template_kwargs"] = {"enable_thinking": True}

    api_key = get_model_api_key(model)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(base_url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

    choice = data["choices"][0]
    message = choice["message"]

    # Handle thinking mode response (reasoning_content)
    content_text = message.get("content", "")
    reasoning = message.get("reasoning_content") or message.get("provider_specific_fields", {}).get("reasoning_content")
    if reasoning:
        logger.debug(f"[WecomAlbum] AI thinking: {str(reasoning)[:200]}")

    return content_text


def _parse_clean_result(text: str) -> dict | None:
    """Parse AI response JSON, extracting clean_title and cost."""
    text = text.strip()

    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(1).strip())
            if isinstance(result, dict):
                return result
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
    """Clean a single product's title using AI.

    When images are available, sends them to the model for better accuracy.
    """
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

        account = await _get_account_config(product.tenant_id)
        system_prompt = (account.ai_prompt_system if account and account.ai_prompt_system else None) or DEFAULT_SYSTEM_PROMPT
        user_template = (account.ai_prompt_user_template if account and account.ai_prompt_user_template else None) or DEFAULT_USER_PROMPT_TEMPLATE
        timeout = account.ai_timeout_seconds if account else AI_TIMEOUT

        user_prompt = user_template.format(title=product.title)

        # Use images for vision-capable models
        images = product.images[:3] if product.images else None

        try:
            response_text = await _call_llm_api(
                model, system_prompt, user_prompt,
                timeout=timeout, images=images,
            )
            parsed = _parse_clean_result(response_text)

            if parsed:
                product.clean_title = parsed.get("clean_title", product.title)
                try:
                    product.clean_price = float(parsed.get("cost", 0) or 0)
                except (ValueError, TypeError):
                    product.clean_price = 0
                product.ai_cleaned_at = datetime.now(timezone.utc)

                # Check if AI recommends skipping
                sync_flag = parsed.get("sync", 1)
                if sync_flag == 0 or str(sync_flag) == "0":
                    product.status = "skip"
                    product.skip_reason = parsed.get("skip_reason", "") or "AI判断不同步"
                else:
                    product.status = "pending_sync"
                    product.skip_reason = None

                await db.commit()
                return {
                    "success": True,
                    "clean_title": product.clean_title,
                    "clean_price": float(product.clean_price),
                    "status": product.status,
                    "skip_reason": product.skip_reason,
                }
            else:
                return {"success": False, "error": "Failed to parse AI response"}

        except Exception as e:
            logger.error(f"[WecomAlbum] AI clean failed for {product_id}: {e}")
            return {"success": False, "error": str(e)}


async def clean_batch(product_ids: list[uuid.UUID]) -> dict:
    """Clean multiple products' titles using AI (batch mode).

    Leverages Agnes's 512K context window for large batches.
    """
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

        account = await _get_account_config(tenant_id)
        system_prompt = (account.ai_prompt_system if account and account.ai_prompt_system else None) or DEFAULT_SYSTEM_PROMPT
        timeout = account.ai_timeout_seconds if account else AI_TIMEOUT

        items = [{"item_id": str(p.id), "title": p.title} for p in products]
        user_prompt = DEFAULT_BATCH_USER_PROMPT_TEMPLATE.format(
            items_json=json.dumps(items, ensure_ascii=False)
        )

        try:
            response_text = await _call_llm_api(model, system_prompt, user_prompt, timeout=timeout)
            parsed_list = _parse_batch_result(response_text)

            if not parsed_list:
                return {"success": False, "error": "Failed to parse batch AI response"}

            lookup = {str(item.get("item_id", "")): item for item in parsed_list}

            cleaned = 0
            skipped = 0
            for p in products:
                item = lookup.get(str(p.id))
                if item:
                    p.clean_title = item.get("clean_title", p.title)
                    try:
                        p.clean_price = float(item.get("cost", 0) or 0)
                    except (ValueError, TypeError):
                        p.clean_price = 0
                    p.ai_cleaned_at = datetime.now(timezone.utc)

                    sync_flag = item.get("sync", 1)
                    if sync_flag == 0 or str(sync_flag) == "0":
                        p.status = "skip"
                        p.skip_reason = item.get("skip_reason", "") or "AI判断不同步"
                        skipped += 1
                    else:
                        p.status = "pending_sync"
                        p.skip_reason = None
                        cleaned += 1

            await db.commit()
            return {"success": True, "cleaned": cleaned, "skipped": skipped, "total": len(products)}

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
