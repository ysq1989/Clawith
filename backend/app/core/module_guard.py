"""Module guard middleware — blocks API access to modules not enabled for the tenant."""

from __future__ import annotations

import uuid

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.module_registry import MODULE_API_PREFIXES, MODULE_GUARD_WHITELIST, get_tenant_modules


def _extract_tenant_id(request: Request) -> uuid.UUID | None:
    """Extract tenant_id from JWT or X-Agent-Tenant-Id header."""
    # Method 1: X-Agent-Tenant-Id header (agent internal calls)
    agent_tid = request.headers.get("X-Agent-Tenant-Id")
    if agent_tid:
        try:
            return uuid.UUID(agent_tid)
        except ValueError:
            return None

    # Method 2: Decode JWT from Authorization header
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            from jose import jwt as jose_jwt
            from app.config import get_settings
            settings = get_settings()
            payload = jose_jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
            tid = payload.get("tenant_id")
            if tid:
                return uuid.UUID(tid)
        except Exception:
            pass

    return None


class ModuleGuardMiddleware(BaseHTTPMiddleware):
    """Middleware that checks if the requesting tenant has access to the target module's API."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # Whitelisted paths — no module check needed
        for prefix in MODULE_GUARD_WHITELIST:
            if path.startswith(prefix):
                return await call_next(request)

        # Check if path matches a module's API prefix
        for module_id, api_prefix in MODULE_API_PREFIXES.items():
            if path.startswith(api_prefix):
                tenant_id = _extract_tenant_id(request)
                if tenant_id is None:
                    # Can't determine tenant — let the route-level auth handle it
                    return await call_next(request)

                # Load tenant's enabled modules
                from app.database import async_session
                from app.models.tenant import Tenant
                from sqlalchemy import select

                async with async_session() as db:
                    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
                    tenant = result.scalar_one_or_none()

                if tenant is None:
                    raise HTTPException(status_code=404, detail="Tenant not found")

                enabled = get_tenant_modules(tenant.enabled_modules)
                if module_id not in enabled:
                    module_label = module_id.replace("_", " ").title()
                    raise HTTPException(
                        status_code=403,
                        detail=f"您的企业未开通 {module_label} 模块，请联系管理员开通",
                    )

                break

        return await call_next(request)
