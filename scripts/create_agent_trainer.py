"""Create an Agent Trainer (调教师) agent.

Run on the server:
  cd /www/wwwroot/Clawith && python3 scripts/create_agent_trainer.py
"""
import psycopg2
import psycopg2.extras
import uuid
import json

conn = psycopg2.connect("host=/tmp dbname=clawith user=postgres")
cur = conn.cursor()

AGENT_ID = str(uuid.uuid4())
TENANT_ID = "5a913146-66f7-4984-ad4d-1f7b59c67504"  # Default tenant

# Get the call_agent_admin_api tool ID
cur.execute("SELECT id FROM tools WHERE name = 'call_agent_admin_api'")
tool_row = cur.fetchone()
if not tool_row:
    print("ERROR: call_agent_admin_api tool not found in DB. Was the tool seeder run?")
    conn.close()
    exit(1)
tool_id = tool_row[0]
print(f"Found tool call_agent_admin_api: {tool_id}")

# Get the first user as creator
cur.execute("SELECT id FROM users ORDER BY created_at LIMIT 1")
user_row = cur.fetchone()
if not user_row:
    print("ERROR: No users found in DB.")
    conn.close()
    exit(1)
creator_id = user_row[0]
print(f"Using creator: {creator_id}")

# Create the agent — include all NOT NULL columns
cur.execute("""
    INSERT INTO agents (
        id, name, role_description, bio, welcome_message,
        creator_id, tenant_id, agent_type, status,
        autonomy_policy, access_mode, is_expired, is_system,
        tokens_used_today, tokens_used_month, tokens_used_total,
        cache_read_tokens_today, cache_read_tokens_month, cache_read_tokens_total,
        cache_creation_tokens_today, cache_creation_tokens_month, cache_creation_tokens_total,
        context_window_size, max_tool_rounds, max_triggers,
        min_poll_interval_min, webhook_rate_limit,
        llm_calls_today, max_llm_calls_per_day,
        heartbeat_enabled, heartbeat_interval_minutes, heartbeat_active_hours,
        company_access_level
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, false, false,
        0, 0, 0,
        0, 0, 0,
        0, 0, 0,
        %s, %s, 20,
        5, 5,
        0, 1000,
        false, 30, '9-18',
        'use'
    )
""", (
    AGENT_ID,
    "调教师",
    "Agent Trainer — 专门用于管理和调教其他数字员工的AI助手",
    "我是调教师，负责管理平台上的所有数字员工。我可以查看和修改其他agent的性格（soul.md）、记忆（memory.md）、技能（skills）、工具配置、A2A关系、以及各项设置参数。",
    "你好！我是调教师 🎓\n\n我可以帮你管理和调教其他数字员工：\n- 📝 修改agent的性格和角色描述\n- 🧠 管理agent的记忆\n- 🛠️ 配置工具权限\n- 🔗 设置agent之间的协作关系\n- ⚙️ 调整运行参数（模型、轮次、上下文窗口等）\n\n告诉我你想调教哪个agent，以及要做什么调整。",
    creator_id,
    TENANT_ID,
    "native",
    "idle",
    psycopg2.extras.Json({}),  # autonomy_policy
    "company",
    200,    # context_window_size
    80,     # max_tool_rounds
))
print(f"Created agent: {AGENT_ID}")

# Enable call_agent_admin_api tool for this agent
cur.execute("""
    INSERT INTO agent_tools (id, agent_id, tool_id, enabled, source, config)
    VALUES (%s, %s, %s, %s, %s, %s)
""", (str(uuid.uuid4()), AGENT_ID, tool_id, True, "system", psycopg2.extras.Json({})))
print("Enabled call_agent_admin_api tool")

# Also enable finish, read_file, write_file, list_files as core tools
core_tool_names = ["finish", "read_file", "write_file", "list_files"]
for tname in core_tool_names:
    cur.execute("SELECT id FROM tools WHERE name = %s", (tname,))
    row = cur.fetchone()
    if row:
        cur.execute("""
            INSERT INTO agent_tools (id, agent_id, tool_id, enabled, source, config)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (str(uuid.uuid4()), AGENT_ID, row[0], True, "system", psycopg2.extras.Json({})))
        print(f"Enabled core tool: {tname}")

conn.commit()

# Write soul.md
soul_content = """# 调教师 — Agent Trainer

## 你是谁
你是 Clawith 平台的**调教师**，专门负责管理和调教其他数字员工（agent）。
你拥有 `call_agent_admin_api` 工具，可以通过内部 API 直接操作其他 agent 的配置。

## 你的能力
通过 `call_agent_admin_api` 工具，你可以：

### 查看和修改 Agent 基本信息
- `GET agents` — 列出所有 agent
- `GET agents/{id}` — 查看某个 agent 的详细信息
- `PATCH agents/{id}/settings` — 修改设置（名称、角色描述、模型、轮次等）

### 管理 Agent 性格（soul.md）
- `GET agents/{id}/files/soul.md` — 读取性格文件
- `PUT agents/{id}/files/soul.md` — 修改性格文件（body: {content: "新内容"}）

### 管理 Agent 记忆（memory.md）
- `GET agents/{id}/files/memory/memory.md` — 读取记忆文件
- `PUT agents/{id}/files/memory/memory.md` — 修改记忆文件

### 管理 Agent 技能（skills）
- `GET agents/{id}/files` — 列出 workspace 文件
- `GET agents/{id}/files/skills/{folder}/SKILL.md` — 读取技能内容
- `PUT agents/{id}/files/skills/{folder}/SKILL.md` — 修改技能内容

### 管理 Agent 工具
- `GET agents/{id}/tools` — 查看工具配置
- `PUT agents/{id}/tools` — 启用/禁用工具

### 管理 Agent 关系（A2A）
- `GET agents/{id}/relationships` — 查看协作关系
- `PUT agents/{id}/relationships` — 设置协作关系

## 工作原则
1. **先查后改** — 修改前先读取当前配置，了解现状
2. **最小改动** — 只修改用户要求的部分，不要大范围改动
3. **确认后再改** — 重要修改前先告诉用户当前状态和修改计划，等用户确认
4. **记住你的权限范围** — 你只能管理同一租户下的 agent，不能修改系统级 agent
5. **修改后验证** — 改完后再读一次确认修改成功

## 常见任务示例

**"帮我看看开单员的配置"**
→ GET agents → 找到开单员 → GET agents/{id}

**"把开单员的性格改成更专业"**
→ GET agents/{id}/files/soul.md → 告诉用户当前内容 → 用户确认后 → PUT agents/{id}/files/soul.md

**"给开单员增加 ERP 销售开单技能"**
→ GET agents/{id}/files → 查看现有技能 → PUT agents/{id}/files/skills/erp-create-sales-order/SKILL.md

**"让开单员和客服agent可以互相通信"**
→ GET agents → 找到客服agent → PUT agents/{id}/relationships

**"把开单员的模型换成 GPT-4o"**
→ GET agents/{id} → 查看当前模型 → PATCH agents/{id}/settings {primary_model_id: "模型ID"}
"""

import os
agent_data_dir = f"/www/wwwroot/Clawith/backend/agent_data/{AGENT_ID}"
os.makedirs(f"{agent_data_dir}/memory", exist_ok=True)
with open(f"{agent_data_dir}/soul.md", "w", encoding="utf-8") as f:
    f.write(soul_content)
with open(f"{agent_data_dir}/memory/memory.md", "w", encoding="utf-8") as f:
    f.write("# Memory\n\n_记录调教过程中发现的问题和改进方案。_\n")
print(f"Wrote soul.md and memory.md to {agent_data_dir}")

cur.close()
conn.close()
print(f"\n✅ Agent Trainer created! ID: {AGENT_ID}")
print("Restart the backend to pick up the new agent.")
