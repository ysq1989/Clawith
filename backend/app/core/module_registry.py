"""Module registry — central definition of all platform modules and tenant-level access control."""

from __future__ import annotations

from enum import Enum
from typing import Any


class ModuleID(str, Enum):
    """Available platform modules."""

    AGENT = "agent"
    ERP = "erp"
    XHS = "xhs"
    PRODUCT_HUB = "product_hub"


# Module metadata — used by both backend (guard) and frontend (sidebar/routes)
MODULE_REGISTRY: dict[str, dict[str, Any]] = {
    "agent": {
        "label": "Agent",
        "label_zh": "数字员工",
        "icon": "robot",
        "path": "/dashboard",
        "required": True,  # Core module — cannot be disabled
    },
    "erp": {
        "label": "ERP",
        "label_zh": "ERP",
        "icon": "receipt",
        "path": "/erp",
        "required": False,
    },
    "xhs": {
        "label": "Xiaohongshu",
        "label_zh": "小红书",
        "icon": "brand-instagram",
        "path": "/xhs",
        "required": False,
    },
    "product_hub": {
        "label": "Product Hub",
        "label_zh": "选品中心",
        "icon": "shopping-bag",
        "path": "/product-hub",
        "required": False,
    },
}

# API path prefixes that each module owns — used by the module guard middleware
MODULE_API_PREFIXES: dict[str, str] = {
    "erp": "/api/erp",
    "xhs": "/api/xhs",
    "product_hub": "/api/product-hub",
}

# Paths that bypass module guard (auth, health, websockets, etc.)
MODULE_GUARD_WHITELIST = [
    "/api/auth",
    "/api/ws",
    "/api/health",
    "/api/version",
    "/api/enterprise",
    "/api/organization",
    "/api/admin",
    "/api/agents",
    "/api/gateway",
    "/api/edge-nodes",
    "/api/agent-admin",
    "/api/notification",
    "/api/webhooks",
    "/api/pages",
    "/api/okr",
]


def get_tenant_modules(enabled_modules: list[str] | None) -> list[str]:
    """Resolve the full module list for a tenant.

    Args:
        enabled_modules: The tenant's ``enabled_modules`` JSON field value.
                         ``None`` or empty list means *all modules enabled* (backward compat).

    Returns:
        List of module IDs the tenant can access.
    """
    if not enabled_modules:
        # null / empty = all modules enabled (backward compatibility)
        return list(MODULE_REGISTRY.keys())

    # Core (required) modules are always included
    base = [mid for mid, meta in MODULE_REGISTRY.items() if meta.get("required")]
    # + explicitly enabled optional modules
    optional = [m for m in enabled_modules if m in MODULE_REGISTRY and not MODULE_REGISTRY[m].get("required")]
    return base + optional
