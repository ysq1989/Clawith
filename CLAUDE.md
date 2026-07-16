# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clawith is an open-source multi-agent collaboration platform — a "digital employee" system where AI agents have persistent identity (`soul.md`), long-term memory (`memory.md`), autonomous awareness (cron/interval/webhook triggers), and can communicate with each other (A2A) and with humans via omni-channel integrations (Feishu, DingTalk, WeCom, Slack, Discord).

## Commands

### Backend (Python / FastAPI)

```bash
cd backend

# Install dependencies
pip install -e ".[dev]"

# Run dev server (proxied by Vite at :3008)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run all tests (asyncio_mode = "auto" — no manual decorators needed)
pytest

# Run a single test file
pytest tests/test_auth.py -v

# Run a single test
pytest tests/test_auth.py::test_login -v

# Lint & format (ruff: line-length 120, target py311)
ruff check .
ruff format .

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend (React / TypeScript / Vite)

```bash
cd frontend

# Install dependencies
npm install

# Dev server (http://localhost:3008, proxies /api → :8000, /ws → ws://:8000)
npm run dev

# Type-check + build
npm run build

# Preview production build
npm run preview
```

### Full Stack

```bash
# One-command setup (creates .env, PostgreSQL, installs deps)
bash setup.sh          # Runtime deps only (~1 min)
bash setup.sh --dev    # Also installs pytest & test tools (~3 min)

# Start all services → http://localhost:3008
bash restart.sh

# Docker Compose (alternative)
docker compose up -d
```

## Windows Development Notes

- Set `PYTHONUTF8=1` environment variable to avoid `UnicodeEncodeError` / GBK encoding issues
- Run `chcp 65001` in terminal before starting backend if encoding errors persist
- Set `NO_PROXY=*` or unset `HTTP_PROXY`/`HTTPS_PROXY` if system proxy intercepts LLM API calls
- If `uvicorn --reload` crashes, install `watchfiles`: `pip install watchfiles`
- Use `pathlib.Path` for file operations — the codebase already does this in most places
- PostgreSQL and Redis via Docker recommended over native installs on Windows

## Architecture

### Monorepo Layout

- `backend/` — Python 3.11+ FastAPI app
- `frontend/` — React 19 TypeScript app (Vite 6)
- `helm/` — Kubernetes Helm charts
- `deploy/` — Deployment scripts

### Backend Structure (`backend/app/`)

| Directory | Purpose |
|-----------|---------|
| `api/` | ~30 FastAPI route modules (one per domain) |
| `services/` | Business logic (~30+ modules) |
| `models/` | SQLAlchemy 2.0 async ORM entities |
| `schemas/` | Pydantic request/response schemas |
| `dao/` | Data access layer |
| `core/` | Auth (`security.py`), events, middleware, logging, permissions |
| `templates/` | Email/document templates |
| `scripts/` | Utility/migration scripts |
| `alembic/` | Database migrations (SQLAlchemy async with asyncpg) |

**Critical files:**
- `api/websocket.py` — Tool-calling loop (up to 50 iterations: LLM → Tool → Context reassembly), LLM streaming
- `api/gateway.py` — OpenClaw edge node protocol (poll/report/send for local agents)
- `services/agent_tools.py` — All file-based tools (`read_file`, `write_file`, `send_message_to_agent`, etc.)
- `services/agent_context.py` — Assembles LLM context from `soul.md`, system prompts, `memory.md`
- `services/trigger_daemon.py` — Background scheduler for the Aware Engine (cron/interval/poll/on_message triggers)
- `services/llm/` — Unified LLM abstraction (`client.py`, `caller.py`, `failover.py`)
- `config.py` — Pydantic-settings based configuration (reads `.env`)

### Frontend Structure (`frontend/src/`)

| Directory | Purpose |
|-----------|---------|
| `pages/` | Page components (19+ pages) |
| `pages/agent-detail/` | Agent chat UI extracted sub-modules |
| `pages/enterprise-settings/` | Enterprise config sub-modules |
| `pages/erp/` | **ERP module** (15 page components, independent dashboard) |
| `components/` | Reusable UI components |
| `stores/` | Zustand global state (auth, permissions, i18n) |
| `services/` | Axios API client |
| `hooks/` | Custom React hooks |
| `i18n/` | Internationalization (en, zh, ja, ko, es, ar) |
| `types/` | Shared TypeScript types |
| `utils/` | Utility functions |

**Path alias:** `@/` maps to `src/` (configured in `tsconfig.json` and `vite.config.ts`).

**Critical files:**
- `App.tsx` — Main router with protected routes
- `pages/AgentDetail.tsx` — Agent chat UI, settings, triggers, relationships (~427KB)
- `pages/EnterpriseSettings.tsx` — Enterprise config, channels, auth providers (~256KB)
- `pages/Dashboard.tsx` — Main dashboard after login
- `pages/Layout.tsx` — App shell with sidebar navigation

### Key Data Models

- `Agent` — Digital employee entity (native or OpenClaw edge node)
- `Participant` — Multi-party communication routing anchor (determines left/right bubble rendering)
- `ChatSession` / `ChatMessage` — Full audit trail including tool_call snapshots
- `AgentTrigger` — Aware Engine scheduling (cron, interval, poll, webhook, on_message)
- `AgentAgentRelationship` — Strict A2A access control (agents must have explicit relationship to communicate)
- `Tenant` / `OrgDepartment` / `OrgMember` — Multi-tenant isolation (all entities carry `tenant_id`)

### Multi-Tenant Pattern

Every database entity includes `tenant_id`. All queries must filter by tenant. The `OrgMember` table maps external channel users (Feishu/DingTalk/WeCom) to internal users.

### WebSocket Tool-Calling Loop

The core LLM execution in `api/websocket.py` runs up to 50 iterations. Each iteration: call LLM → parse tool calls → execute tools → reassemble context → repeat. Resource warnings fire at 80% of the round limit. High-risk tools (`write_file`, `delete_file`) have hard parameter validation.

### Agent Workspace

Each agent has a private file workspace under `agent_template/`. The files `soul.md` (personality) and `memory.md` (long-term memory) are injected into every LLM context via `services/agent_context.py`. Workspace data persists in `backend/agent_data/<agent-uuid>/`.

### Process Roles

The `PROCESS_ROLE` env var controls which subsystems a backend instance runs. Values: `all` (default), `web`, `worker`, `scheduler`. Useful for horizontal scaling.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 15+ / SQLite (dev), Redis 7+
- **Frontend**: React 19, TypeScript (strict), Vite 6, Zustand 5, TanStack Query 5, React Router 7, i18next, Recharts, Tabler Icons
- **LLM**: Unified abstraction in `services/llm/` supporting OpenAI, Anthropic Claude, DeepSeek, and others
- **Integrations**: Feishu/Lark, DingTalk, WeCom, Slack, Discord, Jira/Confluence, Microsoft Teams
- **Linting**: Ruff (Python, line-length 120, target py311), TypeScript strict mode
- **Testing**: pytest + pytest-asyncio (asyncio_mode = "auto")

## LLM Provider System

### Adding a New Provider

New providers are registered in `backend/app/services/llm/client.py`:

1. **`ProviderSpec` dataclass** (line ~1900) — Define provider metadata:
   - `provider`: internal name (e.g. `"agnes"`)
   - `display_name`: UI display name
   - `protocol`: `"openai_compatible"` / `"anthropic"` / `"gemini"` / `"openai_responses"`
   - `default_base_url`: API endpoint
   - `default_max_tokens`: max output tokens
   - `default_timeout`: request timeout in seconds (default 120)
   - `model_max_tokens`: per-model token limits (e.g. `{"agnes-2.0-flash": 65536}`)
   - `extra_body`: extra JSON body injected into every request (e.g. `{"chat_template_kwargs": {"enable_thinking": True}}`)

2. **Frontend fallback** — Add entry in `frontend/src/pages/enterprise-settings/tabs/LlmTab.tsx` `FALLBACK_LLM_PROVIDERS` array.

3. **LLM client factory** — `create_llm_client()` auto-resolves protocol, base URL, timeout, and `extra_body` from `PROVIDER_REGISTRY`. No additional wiring needed for `openai_compatible` providers.

### Thinking Mode (Reasoning Content)

Models like DeepSeek R1 and Agnes 2.0 Flash return `reasoning_content` alongside `content`:

- **Streaming**: `reasoning_content` chunks are captured via `on_thinking` callback and stored in `LLMResponse.reasoning_content`
- **Non-streaming**: Extracted from both `msg.reasoning_content` and `msg.provider_specific_fields.reasoning_content`
- **Tool calling loop**: `caller.py` preserves `reasoning_content` in `LLMMessage` across iterations

To enable thinking for a provider, add `extra_body={"chat_template_kwargs": {"enable_thinking": True}}` to its `ProviderSpec`.

### Registered Providers

Current providers in `PROVIDER_REGISTRY`: agnes, anthropic, openai, openai-response, azure, deepseek, qwen, minimax, openrouter, zhipu, baidu, gemini, kimi, vllm, ollama, sglang, custom.

## Deployment

### Server Info

- Server: `8.134.178.82`
- Deploy path: `/www/wwwroot/Clawith`
- Deploy method: 宝塔自动化部署 (`D:\开发工作区\宝塔自动化部署\scripts\deploy.sh`)
- Config: `baota.config.json` in project root
- Identity file: `scripts/bt/8.134.178.82_id_ed25519`

### Deploy Steps

```bash
# 1. Commit changes locally
# 2. Deploy via baota script (requires jq on local machine)
cd D:\开发工作区\Clawith
../宝塔自动化部署/scripts/deploy.sh main "描述"

# Alternative: manual scp + restart
scp -i scripts/bt/8.134.178.82_id_ed25519 backend/app/services/llm/client.py root@8.134.178.82:/www/wwwroot/Clawith/backend/app/services/llm/client.py
ssh -i scripts/bt/8.134.178.82_id_ed25519 root@8.134.178.82 "cd /www/wwwroot/Clawith && bash restart.sh --source"
```

### Server Architecture

- Frontend: Vite dev server on port 3008 (auto hot-reload)
- Backend: uvicorn on port 8008
- Database: PostgreSQL (宝塔内置)
- Restart: `bash restart.sh --source` on server

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (use `ssl=disable` for local dev) |
| `REDIS_URL` | Redis connection string |
| `SECRET_KEY` / `JWT_SECRET_KEY` | Auth secrets — change in production |
| `AGENT_DATA_DIR` | Agent workspace directory (default: `~/.clawith/data/agents`) |
| `STORAGE_BACKEND` | `local` or `s3` for file storage |
| `PROCESS_ROLE` | `all`, `web`, `worker`, or `scheduler` |
| `PUBLIC_BASE_URL` | Public URL for OAuth callbacks and email links |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | Feishu SSO integration |
| `CORS_ORIGINS` | Allowed CORS origins (JSON array string) |

## Code Guidelines

- **Python Imports**: Place at file top. Avoid inline imports unless necessary (e.g., circular dependency prevention).
- **Multi-tenant queries**: Always include `tenant_id` filter in database queries.
- **ERP status strings**: Order statuses are stored in Chinese (草稿, 已确认, 已完成, 已取消, etc.). All hardcoded status checks in `erp.py` must use Chinese strings. Do not mix English and Chinese status values.
- **ERP helper pattern**: Use `_xxx_to_out()` dict helpers (not Pydantic `model_validate()`) for ERP entity responses to avoid UUID/datetime serialization issues.
- **No `.agents/` directory in this fork**: The upstream `AGENTS.md` references `.agents/rules/` and `.agents/workflows/` — these directories do not exist in the forked repo. Do not attempt to read them.
- **ERP attachment parent_type**: Valid values are `customer`, `supplier`, `sales_order`, `purchase_order`. Validation exists in both `upload_attachment` and `list_attachments` endpoints.

## ERP Module

The ERP module is an independent sub-application within Clawith, accessible at `/erp`. It has its own layout (`ERPLayout.tsx`) with a separate sidebar, independent from the main Clawith navigation.

### Architecture

- **Frontend**: `frontend/src/pages/erp/` — 15 page components, each a default export
- **Backend**: `backend/app/api/erp.py` (~4000 lines, 48+ endpoints, Router prefix `/api/erp`)
- **Models**: `backend/app/models/erp.py` — 15 SQLAlchemy models (customers, suppliers, products, materials, warehouses, orders, stock, financial, BOM, production, payments, categories, settings)
- **Migrations**: `backend/alembic/versions/060-076_*.py`

### Key Design Decisions

- **Products vs Materials**: Products are finished goods (sales side), Materials are raw materials (purchase side). Separate tables, separate APIs, separate stock tracking.
- **Auto-coding**: All entities support auto-generated codes (e.g. K001, SO0001). Prefix and digit count configurable in Settings → Code Settings.
- **BOM is optional**: Production orders can work with or without a BOM. With BOM → deducts materials. Without BOM → only adds finished product.
- **Module flags**: `ERPSettings` has `module_production` and `module_payments` (default off). Sidebar groups are filtered by these flags.
- **Categories as JSON**: Warehouse/outbound/inbound categories stored as JSON arrays in `ERPSettings`, not separate tables.
- **Fulfillment mode**: Products have `fulfillment_mode` (`mts`=按计划生产 / `mto`=按订单生产 / `null`=inherit global default). Stored in `erp_products.fulfillment_mode` and `erp_settings.default_fulfillment_mode`. Currently informational — stock operations are Agent-guided, not auto-triggered on order confirmation.
- **Custom order statuses**: Sales/purchase/production statuses are user-defined per tenant in `erp_production_statuses` table (with `status_type` field: `sales`/`purchase`/`production`). Status names are in Chinese (草稿, 已确认, 处理中, etc.). Each type supports one `is_default` status. Status transitions are unrestricted — any enabled status can be selected.
- **Agent ERP integration**: The `call_erp_api` tool (in `agent_tools.py`) allows agents to call ERP endpoints directly using `X-Agent-Tenant-Id` header auth (no JWT needed). ERP API in `erp.py` accepts this header as an alternative to JWT.

### ERP Helper Pattern

All entity list/detail responses use `dict` (not Pydantic model) via `_xxx_to_out()` helpers:
```python
def _customer_to_out(c, category_name=None, salesperson_name=None):
    return {"id": str(c.id), "name": c.name, ...}
```
This avoids Pydantic `model_validate()` UUID/datetime serialization issues.

### ERP Frontend Patterns

- `SearchableSelect` component: reusable dropdown with API-backed search + pagination (used in Customers, Suppliers, SalesOrders, PurchaseOrders)
- `CategorySelect` component: simpler client-side filtered dropdown (used for categories in forms)
- Status toggle: inline clickable badge in list tables (PATCH to toggle active/inactive)
- Tab-based form dialogs: Basic Info / Financial / Contacts / Attachments tabs
- All API calls use `fetchJson` from `../../services/api`
- `Array.isArray(data) ? data : (data?.items ?? [])` pattern for list responses (backend returns plain arrays, frontend expects paginated)

### User Manual

Full user manual at `docs/ERP_USER_MANUAL.md` with business logic and case study.
