"""Xiaohongshu (小红书) operations REST API.

Endpoints for content management, publishing, search, analytics,
account management, and scheduling.

Route summary
─────────────
Content       GET/POST /api/xhs/content, GET/PUT/DELETE /api/xhs/content/{id}
Publish       POST /api/xhs/publish, POST /api/xhs/schedule
Search        GET /api/xhs/search
Notes         GET /api/xhs/notes/{note_id}
Comment       POST /api/xhs/notes/{note_id}/comment
Like/Bookmark POST /api/xhs/notes/{note_id}/like, POST /api/xhs/notes/{note_id}/bookmark
Analytics     GET /api/xhs/analytics/overview, GET /api/xhs/analytics/notes
Accounts      GET/POST /api/xhs/accounts, DELETE /api/xhs/accounts/{id}
              POST /api/xhs/accounts/{id}/login, GET /api/xhs/accounts/{id}/status
Personas      GET/POST /api/xhs/personas, PUT/DELETE /api/xhs/personas/{id}
Knowledge     GET/POST /api/xhs/knowledge, DELETE /api/xhs/knowledge/{id}
"""

import asyncio
import json
import os
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user as _jwt_get_current_user
from app.database import async_session, get_db
from app.models.xhs import (
    XHSAccount,
    XHSContent,
    XHSKnowledge,
    XHSNoteAnalytics,
    XHSPersona,
    XHSPublishLog,
    XHSSchedule,
)

router = APIRouter(prefix="/api/xhs", tags=["xiaohongshu"])


# ─── Auth ────────────────────────────────────────────────────────────────────


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db=Depends(get_db),
):
    """Accept X-Agent-Tenant-Id header (internal agent) or normal JWT."""
    agent_tid = request.headers.get("X-Agent-Tenant-Id")
    if agent_tid:

        class _AgentUser:
            tenant_id = uuid.UUID(agent_tid)
            id = uuid.UUID(int=0)
            display_name = "Agent"

        return _AgentUser()
    if not credentials:
        raise HTTPException(401, "Missing authentication")
    return await _jwt_get_current_user(credentials, db)


# ─── CDP Script Runner ──────────────────────────────────────────────────────

# Path to the XiaohongshuSkills scripts
_XHS_SKILLS_DIR = Path(os.environ.get("XHS_SKILLS_DIR", "D:/开发工作区/XiaohongshuSkills"))
_CDP_HOST = os.environ.get("XHS_CDP_HOST", "127.0.0.1")
_CDP_PORT = os.environ.get("XHS_CDP_PORT", "9222")


async def _run_cdp_command(
    args: list[str],
    timeout: int = 120,
) -> dict:
    """Run a XiaohongshuSkills CDP command and return parsed output.

    The scripts print structured JSON after a marker line. This function
    captures stdout, finds the JSON block, and returns it as a dict.
    """
    cmd = [
        "python",
        str(_XHS_SKILLS_DIR / "scripts" / "cdp_publish.py"),
        "--host", _CDP_HOST,
        "--port", _CDP_PORT,
        "--headless",
        *args,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(_XHS_SKILLS_DIR),
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        output = stdout.decode("utf-8", errors="replace")
        err_output = stderr.decode("utf-8", errors="replace")

        # Try to extract JSON from output
        json_data = _extract_json(output)
        if json_data is not None:
            return {"success": True, "data": json_data, "raw": output}

        # Check for known status patterns
        if "NOT LOGGED IN" in output:
            return {"success": False, "error": "not_logged_in", "message": "小红书未登录，请先扫码登录"}
        if "Login confirmed" in output:
            return {"success": True, "data": {"status": "logged_in"}, "raw": output}
        if proc.returncode != 0:
            return {"success": False, "error": "command_failed", "message": err_output or output}

        return {"success": True, "data": {"status": "ok"}, "raw": output}
    except asyncio.TimeoutError:
        return {"success": False, "error": "timeout", "message": f"命令执行超时（{timeout}s）"}
    except Exception as e:
        return {"success": False, "error": "exception", "message": str(e)}


def _extract_json(text: str) -> dict | list | None:
    """Extract the last JSON block from CDP script output."""
    # Look for common JSON markers
    for marker in ["CONTENT_DATA_RESULT:", "SEARCH_RESULT:", "FEED_DETAIL:", "FEEDS_RESULT:"]:
        if marker in text:
            idx = text.index(marker) + len(marker)
            rest = text[idx:].strip()
            return _parse_json_from_text(rest)

    # Try to find any JSON object or array in the text
    return _parse_json_from_text(text)


def _parse_json_from_text(text: str) -> dict | list | None:
    """Try to parse JSON from text, handling common edge cases."""
    text = text.strip()
    # Find first { or [
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        if start == -1:
            continue
        # Find matching end
        depth = 0
        for i in range(start, len(text)):
            if text[i] == start_char:
                depth += 1
            elif text[i] == end_char:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break
    return None


async def _run_publish_pipeline(
    title: str,
    content: str,
    image_urls: list[str] | None = None,
    images: list[str] | None = None,
    account: str | None = None,
    preview: bool = False,
    timeout: int = 180,
) -> dict:
    """Run the publish_pipeline.py script."""
    cmd = [
        "python",
        str(_XHS_SKILLS_DIR / "scripts" / "publish_pipeline.py"),
        "--headless",
        "--title", title,
        "--content", content,
    ]
    if image_urls:
        cmd.extend(["--image-urls", *image_urls])
    if images:
        cmd.extend(["--images", *images])
    if account:
        cmd.extend(["--account", account])
    if preview:
        cmd.append("--preview")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(_XHS_SKILLS_DIR),
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        output = stdout.decode("utf-8", errors="replace")
        err_output = stderr.decode("utf-8", errors="replace")

        success = proc.returncode == 0 and "NOT LOGGED IN" not in output
        return {
            "success": success,
            "message": output.strip(),
            "error": err_output.strip() if not success else None,
        }
    except asyncio.TimeoutError:
        return {"success": False, "message": f"发布超时（{timeout}s）"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── Content CRUD ────────────────────────────────────────────────────────────


class ContentCreate(BaseModel):
    title: str
    content: str | None = None
    note_type: str = "image"
    images: list[dict] | None = None
    video_url: str | None = None
    tags: list[str] | None = None
    account_id: uuid.UUID | None = None
    persona_id: uuid.UUID | None = None


class ContentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    images: list[dict] | None = None
    tags: list[str] | None = None
    status: str | None = None
    account_id: uuid.UUID | None = None
    persona_id: uuid.UUID | None = None


@router.get("/content")
async def list_content(
    status: str | None = None,
    account_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List content with optional filters."""
    q = select(XHSContent).where(XHSContent.tenant_id == user.tenant_id)
    if status:
        q = q.where(XHSContent.status == status)
    if account_id:
        q = q.where(XHSContent.account_id == account_id)
    q = q.order_by(XHSContent.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    items = result.scalars().all()

    # Count total
    count_q = select(func.count()).select_from(XHSContent).where(XHSContent.tenant_id == user.tenant_id)
    if status:
        count_q = count_q.where(XHSContent.status == status)
    total = (await db.execute(count_q)).scalar() or 0

    return {
        "items": [_content_to_dict(c) for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/content")
async def create_content(
    body: ContentCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new content draft."""
    item = XHSContent(
        tenant_id=user.tenant_id,
        account_id=body.account_id,
        persona_id=body.persona_id,
        title=body.title,
        content=body.content,
        note_type=body.note_type,
        images=body.images,
        video_url=body.video_url,
        tags=body.tags,
        status="draft",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _content_to_dict(item)


@router.get("/content/{content_id}")
async def get_content(
    content_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get content detail."""
    item = await db.get(XHSContent, content_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Content not found")
    return _content_to_dict(item)


@router.put("/content/{content_id}")
async def update_content(
    content_id: uuid.UUID,
    body: ContentUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update content."""
    item = await db.get(XHSContent, content_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Content not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(item, field, val)
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return _content_to_dict(item)


@router.delete("/content/{content_id}")
async def delete_content(
    content_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete content."""
    item = await db.get(XHSContent, content_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Content not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


def _content_to_dict(c: XHSContent) -> dict:
    return {
        "id": str(c.id),
        "title": c.title,
        "content": c.content,
        "note_type": c.note_type,
        "images": c.images,
        "video_url": c.video_url,
        "tags": c.tags,
        "status": c.status,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "published_at": c.published_at.isoformat() if c.published_at else None,
        "xhs_note_id": c.xhs_note_id,
        "ai_generated": c.ai_generated,
        "account_id": str(c.account_id) if c.account_id else None,
        "persona_id": str(c.persona_id) if c.persona_id else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ─── Publish ─────────────────────────────────────────────────────────────────


class PublishRequest(BaseModel):
    content_id: uuid.UUID
    account_id: uuid.UUID | None = None
    preview: bool = False


class ScheduleRequest(BaseModel):
    content_id: uuid.UUID
    account_id: uuid.UUID
    scheduled_at: datetime


@router.post("/publish")
async def publish_content(
    body: PublishRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Publish content to Xiaohongshu via CDP."""
    item = await db.get(XHSContent, body.content_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Content not found")

    # Get account
    account = None
    if body.account_id:
        account = await db.get(XHSAccount, body.account_id)
        if not account or account.tenant_id != user.tenant_id:
            raise HTTPException(404, "Account not found")

    # Build image URLs from content
    image_urls = []
    if item.images:
        for img in item.images:
            if isinstance(img, dict) and img.get("url"):
                image_urls.append(img["url"])

    # Update status
    item.status = "publishing"
    await db.commit()

    # Run publish pipeline
    result = await _run_publish_pipeline(
        title=item.title,
        content=item.content or "",
        image_urls=image_urls if image_urls else None,
        account=account.alias if account else None,
        preview=body.preview,
    )

    # Update content status
    if result["success"]:
        item.status = "published" if not body.preview else "draft"
        item.published_at = datetime.utcnow() if not body.preview else None
    else:
        item.status = "failed"
        item.publish_log = result.get("message", "")
    await db.commit()

    # Log publish attempt
    log = XHSPublishLog(
        tenant_id=user.tenant_id,
        content_id=item.id,
        account_id=body.account_id,
        status="success" if result["success"] else "failed",
        error_message=result.get("message") if not result["success"] else None,
        published_at=datetime.utcnow() if result["success"] and not body.preview else None,
    )
    db.add(log)
    await db.commit()

    return {
        "success": result["success"],
        "message": result.get("message", ""),
        "content_id": str(item.id),
        "status": item.status,
    }


@router.post("/schedule")
async def schedule_content(
    body: ScheduleRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule content for later publishing."""
    item = await db.get(XHSContent, body.content_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Content not found")

    account = await db.get(XHSAccount, body.account_id)
    if not account or account.tenant_id != user.tenant_id:
        raise HTTPException(404, "Account not found")

    schedule = XHSSchedule(
        tenant_id=user.tenant_id,
        content_id=body.content_id,
        account_id=body.account_id,
        scheduled_at=body.scheduled_at,
    )
    db.add(schedule)

    item.status = "scheduled"
    item.scheduled_at = body.scheduled_at
    item.account_id = body.account_id
    await db.commit()

    return {"ok": True, "schedule_id": str(schedule.id)}


# ─── Search ──────────────────────────────────────────────────────────────────


@router.get("/search")
async def search_notes(
    keyword: str,
    sort_by: str | None = None,
    note_type: str | None = None,
    user=Depends(get_current_user),
):
    """Search Xiaohongshu notes via CDP."""
    args = ["search-feeds", "--keyword", keyword]
    if sort_by:
        args.extend(["--sort-by", sort_by])
    if note_type:
        args.extend(["--note-type", note_type])

    result = await _run_cdp_command(args, timeout=60)
    if not result["success"]:
        raise HTTPException(500, result.get("message", "搜索失败"))
    return result["data"]


# ─── Notes ───────────────────────────────────────────────────────────────────


@router.get("/notes/{note_id}")
async def get_note_detail(
    note_id: str,
    xsec_token: str | None = None,
    load_all_comments: bool = False,
    user=Depends(get_current_user),
):
    """Get note detail via CDP."""
    args = ["get-feed-detail", "--feed-id", note_id]
    if xsec_token:
        args.extend(["--xsec-token", xsec_token])
    if load_all_comments:
        args.append("--load-all-comments")

    result = await _run_cdp_command(args, timeout=60)
    if not result["success"]:
        raise HTTPException(500, result.get("message", "获取笔记详情失败"))
    return result["data"]


@router.post("/notes/{note_id}/comment")
async def post_comment(
    note_id: str,
    content: str,
    xsec_token: str | None = None,
    user=Depends(get_current_user),
):
    """Post a comment on a note."""
    args = ["post-comment-to-feed", "--feed-id", note_id, "--content", content]
    if xsec_token:
        args.extend(["--xsec-token", xsec_token])

    result = await _run_cdp_command(args, timeout=60)
    return {"success": result["success"], "message": result.get("message", "")}


@router.post("/notes/{note_id}/like")
async def like_note(
    note_id: str,
    xsec_token: str | None = None,
    user=Depends(get_current_user),
):
    """Like a note."""
    args = ["note-upvote", "--feed-id", note_id]
    if xsec_token:
        args.extend(["--xsec-token", xsec_token])
    result = await _run_cdp_command(args, timeout=30)
    return {"success": result["success"]}


@router.post("/notes/{note_id}/bookmark")
async def bookmark_note(
    note_id: str,
    xsec_token: str | None = None,
    user=Depends(get_current_user),
):
    """Bookmark a note."""
    args = ["note-bookmark", "--feed-id", note_id]
    if xsec_token:
        args.extend(["--xsec-token", xsec_token])
    result = await _run_cdp_command(args, timeout=30)
    return {"success": result["success"]}


# ─── Analytics ───────────────────────────────────────────────────────────────


@router.get("/analytics/overview")
async def analytics_overview(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics overview from DB (aggregated from collected data)."""
    q = (
        select(
            func.sum(XHSNoteAnalytics.views).label("total_views"),
            func.sum(XHSNoteAnalytics.likes).label("total_likes"),
            func.sum(XHSNoteAnalytics.comments).label("total_comments"),
            func.sum(XHSNoteAnalytics.bookmarks).label("total_bookmarks"),
            func.count(func.distinct(XHSNoteAnalytics.note_id)).label("note_count"),
        )
        .where(XHSNoteAnalytics.tenant_id == user.tenant_id)
    )
    result = await db.execute(q)
    row = result.one_or_none()

    # Content counts by status
    status_q = (
        select(XHSContent.status, func.count())
        .where(XHSContent.tenant_id == user.tenant_id)
        .group_by(XHSContent.status)
    )
    status_result = await db.execute(status_q)
    status_counts = {r[0]: r[1] for r in status_result.all()}

    return {
        "total_views": row.total_views or 0 if row else 0,
        "total_likes": row.total_likes or 0 if row else 0,
        "total_comments": row.total_comments or 0 if row else 0,
        "total_bookmarks": row.total_bookmarks or 0 if row else 0,
        "note_count": row.note_count or 0 if row else 0,
        "content_status": status_counts,
    }


@router.get("/analytics/notes")
async def analytics_notes(
    account_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get per-note analytics data."""
    q = select(XHSNoteAnalytics).where(XHSNoteAnalytics.tenant_id == user.tenant_id)
    if account_id:
        q = q.where(XHSNoteAnalytics.account_id == account_id)
    q = q.order_by(XHSNoteAnalytics.collected_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    items = result.scalars().all()

    return {
        "items": [
            {
                "note_id": i.note_id,
                "title": i.title,
                "author_name": i.author_name,
                "views": i.views,
                "likes": i.likes,
                "comments": i.comments,
                "bookmarks": i.bookmarks,
                "shares": i.shares,
                "collected_at": i.collected_at.isoformat() if i.collected_at else None,
            }
            for i in items
        ]
    }


@router.get("/analytics/live")
async def analytics_live(
    user=Depends(get_current_user),
):
    """Fetch live analytics from Xiaohongshu creator center via CDP."""
    result = await _run_cdp_command(["content-data"], timeout=60)
    if not result["success"]:
        raise HTTPException(500, result.get("message", "获取数据失败"))
    return result["data"]


# ─── Accounts ────────────────────────────────────────────────────────────────


class AccountCreate(BaseModel):
    name: str
    alias: str | None = None


@router.get("/accounts")
async def list_accounts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all Xiaohongshu accounts."""
    q = (
        select(XHSAccount)
        .where(XHSAccount.tenant_id == user.tenant_id)
        .order_by(XHSAccount.created_at.desc())
    )
    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": [_account_to_dict(a) for a in items]}


@router.post("/accounts")
async def create_account(
    body: AccountCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new Xiaohongshu account."""
    account = XHSAccount(
        tenant_id=user.tenant_id,
        name=body.name,
        alias=body.alias,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _account_to_dict(account)


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a Xiaohongshu account."""
    item = await db.get(XHSAccount, account_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Account not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


@router.post("/accounts/{account_id}/login")
async def account_login(
    account_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger QR code login for an account. Returns QR code data."""
    result = await _run_cdp_command(["get-login-qrcode"], timeout=30)
    return {
        "success": result["success"],
        "qrcode": result.get("data", {}),
        "message": result.get("message", ""),
    }


@router.get("/accounts/{account_id}/status")
async def account_status(
    account_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check account login status."""
    result = await _run_cdp_command(["check-login"], timeout=30)
    logged_in = result["success"] and "Login confirmed" in result.get("raw", "")
    return {
        "logged_in": logged_in,
        "message": result.get("message", ""),
    }


def _account_to_dict(a: XHSAccount) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "alias": a.alias,
        "xhs_user_id": a.xhs_user_id,
        "status": a.status,
        "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ─── Personas ────────────────────────────────────────────────────────────────


class PersonaCreate(BaseModel):
    name: str
    description: str | None = None
    tone: str | None = None
    topics: list[str] | None = None
    avoid_words: list[str] | None = None
    is_default: bool = False


class PersonaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tone: str | None = None
    topics: list[str] | None = None
    avoid_words: list[str] | None = None
    is_default: bool | None = None


@router.get("/personas")
async def list_personas(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(XHSPersona).where(XHSPersona.tenant_id == user.tenant_id)
    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": [_persona_to_dict(p) for p in items]}


@router.post("/personas")
async def create_persona(
    body: PersonaCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    persona = XHSPersona(
        tenant_id=user.tenant_id,
        name=body.name,
        description=body.description,
        tone=body.tone,
        topics=body.topics,
        avoid_words=body.avoid_words,
        is_default=body.is_default,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return _persona_to_dict(persona)


@router.put("/personas/{persona_id}")
async def update_persona(
    persona_id: uuid.UUID,
    body: PersonaUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(XHSPersona, persona_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Persona not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(item, field, val)
    await db.commit()
    await db.refresh(item)
    return _persona_to_dict(item)


@router.delete("/personas/{persona_id}")
async def delete_persona(
    persona_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(XHSPersona, persona_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Persona not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


def _persona_to_dict(p: XHSPersona) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "tone": p.tone,
        "topics": p.topics,
        "avoid_words": p.avoid_words,
        "is_default": p.is_default,
    }


# ─── Knowledge Base ──────────────────────────────────────────────────────────


class KnowledgeCreate(BaseModel):
    category: str  # pattern / account / topic / action
    title: str
    content: str
    metadata_: dict | None = None


@router.get("/knowledge")
async def list_knowledge(
    category: str | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(XHSKnowledge).where(XHSKnowledge.tenant_id == user.tenant_id)
    if category:
        q = q.where(XHSKnowledge.category == category)
    q = q.order_by(XHSKnowledge.created_at.desc())
    result = await db.execute(q)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": str(k.id),
                "category": k.category,
                "title": k.title,
                "content": k.content,
                "metadata": k.metadata_,
                "created_at": k.created_at.isoformat() if k.created_at else None,
            }
            for k in items
        ]
    }


@router.post("/knowledge")
async def create_knowledge(
    body: KnowledgeCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = XHSKnowledge(
        tenant_id=user.tenant_id,
        category=body.category,
        title=body.title,
        content=body.content,
        metadata_=body.metadata_,
    )
    db.add(item)
    await db.commit()
    return {"ok": True, "id": str(item.id)}


@router.delete("/knowledge/{knowledge_id}")
async def delete_knowledge(
    knowledge_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(XHSKnowledge, knowledge_id)
    if not item or item.tenant_id != user.tenant_id:
        raise HTTPException(404, "Knowledge not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}
