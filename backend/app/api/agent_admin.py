"""Internal Agent Admin API — for agents to manage other agents.

Uses X-Agent-Tenant-Id header auth (same pattern as erp.py).
Scoped to the caller's tenant — agents can only manage agents in their own tenant.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select

from app.database import async_session
from app.models.agent import Agent, AgentTemplate
from app.models.tool import AgentTool, Tool
from app.services.storage import get_storage_backend

router = APIRouter(prefix="/agent-admin", tags=["agent-admin"])


# ── Auth ──────────────────────────────────────────────────────────────────

async def _get_tenant_id(request: Request) -> uuid.UUID:
    """Extract tenant_id from X-Agent-Tenant-Id header."""
    tid = request.headers.get("X-Agent-Tenant-Id")
    if not tid:
        raise HTTPException(401, "Missing X-Agent-Tenant-Id header")
    try:
        return uuid.UUID(tid)
    except ValueError:
        raise HTTPException(400, "Invalid tenant_id")


async def _get_target_agent(agent_id: str, tenant_id: uuid.UUID) -> Agent:
    """Load target agent, enforcing tenant isolation."""
    try:
        aid = uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(400, "Invalid agent_id")
    async with async_session() as db:
        r = await db.execute(select(Agent).where(Agent.id == aid))
        agent = r.scalar_one_or_none()
        if not agent:
            raise HTTPException(404, "Agent not found")
        if agent.tenant_id and agent.tenant_id != tenant_id:
            raise HTTPException(403, "Agent belongs to another tenant")
        return agent


# ── Agent CRUD ────────────────────────────────────────────────────────────

@router.get("/agents")
async def list_agents(request: Request):
    """List all agents in the tenant."""
    tenant_id = await _get_tenant_id(request)
    async with async_session() as db:
        r = await db.execute(
            select(Agent).where(Agent.tenant_id == tenant_id).order_by(Agent.created_at.desc())
        )
        agents = r.scalars().all()
        return [
            {
                "id": str(a.id),
                "name": a.name,
                "role_description": a.role_description or "",
                "status": a.status,
                "max_tool_rounds": a.max_tool_rounds,
                "context_window_size": a.context_window_size,
                "primary_model_id": str(a.primary_model_id) if a.primary_model_id else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in agents
        ]


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, request: Request):
    """Get detailed info of a specific agent."""
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    return {
        "id": str(agent.id),
        "name": agent.name,
        "role_description": agent.role_description or "",
        "bio": agent.bio or "",
        "welcome_message": agent.welcome_message or "",
        "status": agent.status,
        "max_tool_rounds": agent.max_tool_rounds,
        "context_window_size": agent.context_window_size,
        "primary_model_id": str(agent.primary_model_id) if agent.primary_model_id else None,
        "fallback_model_id": str(agent.fallback_model_id) if agent.fallback_model_id else None,
        "autonomy_policy": agent.autonomy_policy,
        "access_mode": agent.access_mode,
        "is_system": agent.is_system,
    }


# ── Agent Settings Update ────────────────────────────────────────────────

class AgentSettingsUpdate(BaseModel):
    name: str | None = None
    role_description: str | None = None
    bio: str | None = None
    welcome_message: str | None = None
    max_tool_rounds: int | None = None
    context_window_size: int | None = None
    primary_model_id: str | None = None
    fallback_model_id: str | None = None
    autonomy_policy: dict | None = None


@router.patch("/agents/{agent_id}/settings")
async def update_agent_settings(agent_id: str, body: AgentSettingsUpdate, request: Request):
    """Update agent settings (name, role, rounds, model, etc.)."""
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    if agent.is_system:
        raise HTTPException(403, "Cannot modify system agents")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    # Convert string UUIDs to UUID objects where needed
    for field in ("primary_model_id", "fallback_model_id"):
        if field in update_data and update_data[field] is not None:
            try:
                update_data[field] = uuid.UUID(update_data[field])
            except (ValueError, TypeError):
                pass

    async with async_session() as db:
        for key, value in update_data.items():
            setattr(agent, key, value)
        await db.commit()
        await db.refresh(agent)

    logger.info(f"[agent-admin] Updated agent {agent_id}: {list(update_data.keys())}")
    return {"ok": True, "updated_fields": list(update_data.keys())}


# ── Soul.md / Memory.md ──────────────────────────────────────────────────

@router.get("/agents/{agent_id}/files/{file_path:path}")
async def read_agent_file(agent_id: str, file_path: str, request: Request):
    """Read a file from an agent's workspace (soul.md, memory/memory.md, skills/*/SKILL.md, etc.)."""
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    storage = get_storage_backend()
    key = f"{agent.id}/{file_path}"
    if not await storage.is_file(key):
        raise HTTPException(404, f"File not found: {file_path}")
    content = await storage.read_text(key, encoding="utf-8")
    return {"path": file_path, "content": content}


class FileWrite(BaseModel):
    content: str


@router.put("/agents/{agent_id}/files/{file_path:path}")
async def write_agent_file(agent_id: str, file_path: str, body: FileWrite, request: Request):
    """Write/update a file in an agent's workspace."""
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    if agent.is_system:
        raise HTTPException(403, "Cannot modify system agent files")
    storage = get_storage_backend()
    key = f"{agent.id}/{file_path}"
    await storage.write_text(key, body.content, encoding="utf-8")
    logger.info(f"[agent-admin] Wrote {file_path} for agent {agent_id} ({len(body.content)} chars)")
    return {"ok": True, "path": file_path, "size": len(body.content)}


@router.get("/agents/{agent_id}/files")
async def list_agent_files(agent_id: str, request: Request, path: str = ""):
    """List files in an agent's workspace."""
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    storage = get_storage_backend()
    prefix = f"{agent.id}/{path}" if path else f"{agent.id}/"
    entries = await storage.list_dir(prefix)
    items = [{"name": e.name, "is_dir": e.is_dir, "size": e.size} for e in entries]
    return {"path": path, "items": items}


# ── Tools ─────────────────────────────────────────────────────────────────

@router.get("/agents/{agent_id}/tools")
async def list_agent_tools(agent_id: str, request: Request):
    """List tools assigned to an agent with enabled status."""
    tenant_id = await _get_tenant_id(request)
    await _get_target_agent(agent_id, tenant_id)  # tenant check
    async with async_session() as db:
        r = await db.execute(
            select(Tool, AgentTool)
            .outerjoin(AgentTool, (Tool.id == AgentTool.tool_id) & (AgentTool.agent_id == uuid.UUID(agent_id)))
            .where(Tool.enabled == True)  # noqa: E712
            .order_by(Tool.name)
        )
        results = []
        for tool, at in r.all():
            enabled = at.enabled if at else tool.is_default
            results.append({
                "tool_id": str(tool.id),
                "name": tool.name,
                "display_name": tool.display_name,
                "category": tool.category,
                "enabled": enabled,
                "is_default": tool.is_default,
            })
        return results


class ToolAssignment(BaseModel):
    tool_id: str
    enabled: bool


@router.put("/agents/{agent_id}/tools")
async def update_agent_tools(agent_id: str, body: list[ToolAssignment], request: Request):
    """Update tool assignments for an agent (enable/disable)."""
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    if agent.is_system:
        raise HTTPException(403, "Cannot modify system agent tools")
    async with async_session() as db:
        for assignment in body:
            tool_id = uuid.UUID(assignment.tool_id)
            # Check if assignment exists
            r = await db.execute(
                select(AgentTool).where(
                    AgentTool.agent_id == uuid.UUID(agent_id),
                    AgentTool.tool_id == tool_id,
                )
            )
            existing = r.scalar_one_or_none()
            if existing:
                existing.enabled = assignment.enabled
            else:
                db.add(AgentTool(
                    agent_id=uuid.UUID(agent_id),
                    tool_id=tool_id,
                    enabled=assignment.enabled,
                ))
        await db.commit()
    logger.info(f"[agent-admin] Updated tools for agent {agent_id}: {len(body)} changes")
    return {"ok": True, "changes": len(body)}


# ── Skills (via workspace files) ─────────────────────────────────────────

@router.get("/agents/{agent_id}/skills")
async def list_agent_skills(agent_id: str, request: Request):
    """List skills installed on an agent by scanning skills/ folder in workspace."""
    tenant_id = await _get_tenant_id(request)
    await _get_target_agent(agent_id, tenant_id)
    storage = get_storage_backend()
    prefix = f"{agent_id}/skills/"
    entries = await storage.list_dir(prefix)
    # entries are StorageEntry objects with .name like "erp-create-customer"
    skills = []
    for entry in entries:
        if not entry.is_dir:
            continue
        folder = entry.name
        skill_key = f"{agent_id}/skills/{folder}/SKILL.md"
        if await storage.is_file(skill_key):
            content = await storage.read_text(skill_key, encoding="utf-8")
            # Extract name from frontmatter
            name = folder
            if content.startswith("---"):
                try:
                    end = content.index("---", 3)
                    fm = content[3:end]
                    for line in fm.strip().split("\n"):
                        if line.startswith("name:"):
                            name = line.split(":", 1)[1].strip()
                            break
                except (ValueError, IndexError):
                    pass
            skills.append({"folder_name": folder, "name": name, "content_length": len(content)})
    return skills


# ── Templates (for creating new agents) ──────────────────────────────────

@router.get("/templates")
async def list_templates(request: Request, category: str | None = None):
    """List available agent templates, optionally filtered by category."""
    tenant_id = await _get_tenant_id(request)
    async with async_session() as db:
        stmt = select(AgentTemplate).where(AgentTemplate.is_builtin == True)  # noqa: E712
        if category:
            stmt = stmt.where(AgentTemplate.category == category)
        r = await db.execute(stmt.order_by(AgentTemplate.name))
        templates = r.scalars().all()
        return [
            {
                "id": str(t.id),
                "name": t.name,
                "description": t.description,
                "icon": t.icon,
                "category": t.category,
                "capability_bullets": t.capability_bullets or [],
            }
            for t in templates
        ]


class AgentCreate(BaseModel):
    name: str
    template_id: str | None = None
    role_description: str = ""
    bio: str = ""
    welcome_message: str = ""
    primary_model_id: str | None = None


@router.post("/agents")
async def create_agent(body: AgentCreate, request: Request):
    """Create a new agent in the same tenant.

    If template_id is provided, the agent is created from that template
    (soul.md is populated from the template's soul_template).
    """
    tenant_id = await _get_tenant_id(request)
    # Use the calling agent as creator — find a real user in the tenant
    async with async_session() as db:
        from app.models.user import User
        ur = await db.execute(select(User).where(User.tenant_id == tenant_id).order_by(User.created_at).limit(1))
        user = ur.scalar_one_or_none()
        if not user:
            raise HTTPException(400, "No user found in tenant to set as creator")

        template = None
        soul_content = f"# Personality\n\n{body.role_description}\n"
        if body.template_id:
            tr = await db.execute(select(AgentTemplate).where(AgentTemplate.id == uuid.UUID(body.template_id)))
            template = tr.scalar_one_or_none()
            if template and template.soul_template:
                soul_content = template.soul_template

        new_agent_id = uuid.uuid4()
        agent = Agent(
            id=new_agent_id,
            name=body.name,
            role_description=body.role_description or (template.description if template else ""),
            bio=body.bio,
            welcome_message=body.welcome_message or f"你好！我是{body.name}，有什么可以帮你的？",
            creator_id=user.id,
            tenant_id=tenant_id,
            agent_type="native",
            status="idle",
            autonomy_policy=template.default_autonomy_policy if template else {},
            access_mode="company",
            tokens_used_today=0, tokens_used_month=0, tokens_used_total=0,
            cache_read_tokens_today=0, cache_read_tokens_month=0, cache_read_tokens_total=0,
            cache_creation_tokens_today=0, cache_creation_tokens_month=0, cache_creation_tokens_total=0,
            context_window_size=100, max_tool_rounds=50, max_triggers=20,
            min_poll_interval_min=5, webhook_rate_limit=5,
            is_expired=False, is_system=False,
            llm_calls_today=0, max_llm_calls_per_day=1000,
            heartbeat_enabled=False, heartbeat_interval_minutes=30, heartbeat_active_hours="9-18",
            company_access_level="use",
        )
        if body.primary_model_id:
            try:
                agent.primary_model_id = uuid.UUID(body.primary_model_id)
            except (ValueError, TypeError):
                pass
        db.add(agent)

        # Grant full access to the creating user
        from app.models.agent import AgentPermission
        db.add(AgentPermission(
            agent_id=new_agent_id,
            scope_type="user",
            scope_id=user.id,
            access_level="manage",
        ))

        await db.commit()

    # Initialize workspace files (soul.md, memory.md)
    storage = get_storage_backend()
    soul_key = f"{new_agent_id}/soul.md"
    if not await storage.is_file(soul_key):
        await storage.write_text(soul_key, soul_content, encoding="utf-8")
    mem_key = f"{new_agent_id}/memory/memory.md"
    if not await storage.is_file(mem_key):
        await storage.write_text(mem_key, "# Memory\n\n_记录重要信息和知识。_\n", encoding="utf-8")

    logger.info(f"[agent-admin] Created agent {new_agent_id} ({body.name}) in tenant {tenant_id}")
    return {
        "ok": True,
        "agent_id": str(new_agent_id),
        "name": body.name,
        "from_template": template.name if template else None,
    }


# ── Relationships (A2A) ──────────────────────────────────────────────────

@router.get("/agents/{agent_id}/relationships")
async def list_agent_relationships(agent_id: str, request: Request):
    """List A2A relationships of an agent."""
    from app.models.agent import AgentAgentRelationship
    tenant_id = await _get_tenant_id(request)
    await _get_target_agent(agent_id, tenant_id)
    async with async_session() as db:
        r = await db.execute(
            select(AgentAgentRelationship).where(
                AgentAgentRelationship.agent_id == uuid.UUID(agent_id)
            )
        )
        rels = r.scalars().all()
        results = []
        for rel in rels:
            # Get target agent name
            ar = await db.execute(select(Agent).where(Agent.id == rel.target_agent_id))
            target = ar.scalar_one_or_none()
            results.append({
                "id": str(rel.id),
                "target_agent_id": str(rel.target_agent_id),
                "target_agent_name": target.name if target else "unknown",
                "relation": rel.relation,
                "description": rel.description or "",
            })
        return results


class RelationshipCreate(BaseModel):
    target_agent_id: str
    relation: str  # "peer", "supervisor", "assistant", "collaborator", "other"
    description: str = ""


@router.put("/agents/{agent_id}/relationships")
async def set_agent_relationships(agent_id: str, body: list[RelationshipCreate], request: Request):
    """Replace all A2A relationships for an agent."""
    from app.models.agent import AgentAgentRelationship
    tenant_id = await _get_tenant_id(request)
    agent = await _get_target_agent(agent_id, tenant_id)
    if agent.is_system:
        raise HTTPException(403, "Cannot modify system agent relationships")
    async with async_session() as db:
        # Delete existing
        r = await db.execute(
            select(AgentAgentRelationship).where(
                AgentAgentRelationship.agent_id == uuid.UUID(agent_id)
            )
        )
        for old in r.scalars().all():
            await db.delete(old)
        # Add new
        for rel in body:
            target_id = uuid.UUID(rel.target_agent_id)
            # Verify target exists and is in same tenant
            tr = await db.execute(select(Agent).where(Agent.id == target_id))
            target = tr.scalar_one_or_none()
            if not target:
                raise HTTPException(404, f"Target agent {rel.target_agent_id} not found")
            if target.tenant_id and target.tenant_id != tenant_id:
                raise HTTPException(403, "Target agent belongs to another tenant")
            db.add(AgentAgentRelationship(
                agent_id=uuid.UUID(agent_id),
                target_agent_id=target_id,
                relation=rel.relation,
                description=rel.description,
            ))
        await db.commit()
    logger.info(f"[agent-admin] Set {len(body)} relationships for agent {agent_id}")
    return {"ok": True, "count": len(body)}
