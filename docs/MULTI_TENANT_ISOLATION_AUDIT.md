# 多租户隔离架构分析

> 审计日期：2026-07-19
> 审计范围：Clawith 核心平台 + ERP 模块
> 状态：仅记录，待修复

---

## 一、整体架构

Clawith 采用 **共享数据库 + 行级隔离** 模式。所有租户数据在同一张表中，通过 `tenant_id` 列区分。

### 认证链路

```
登录 → JWT(sub=user_id, role) → get_current_user() → User.tenant_id → 业务查询过滤
         ↑
    Token 不含 tenant_id，每次请求从 DB 获取
```

### 身份模型

```
Identity (全局跨租户)
  └─ User (per-tenant, 一个人可有多个 User 分属不同租户)
       └─ Agent (per-tenant)
            ├─ ChatSession / ChatMessage
            ├─ AgentTrigger / AgentSchedule
            ├─ AgentTool / Skill
            └─ ERP数据 (per-tenant)
```

---

## 二、tenant_id 覆盖矩阵

### 有 tenant_id 的模型（正确隔离）

| 模型 | 文件 | nullable | 索引 | 级联 |
|------|------|----------|------|------|
| `User` | user.py | Yes | FK | - |
| `Agent` | agent.py | Yes | FK | - |
| `OrgDepartment` | org.py | Yes | FK | - |
| `OrgMember` | org.py | Yes | FK | - |
| `LLMModel` | llm.py | Yes | FK | - |
| `Tool` | tool.py | Yes | 无 | - |
| `Skill` | skill.py | Yes | FK | - |
| `PlazaPost` | plaza.py | Yes | 无 | - |
| `InvitationCode` | invitation_code.py | Yes | FK | - |
| `PublishedPage` | published_page.py | Yes | FK | - |
| `IdentityProvider` | identity.py | Yes | 无 | - |
| `ERPCustomer` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPSupplier` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPProduct` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPMaterial` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPWarehouse` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPSalesOrder` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPPurchaseOrder` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPStockRecord` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPFinancialRecord` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPSettings` | erp.py | **No** | 唯一索引 | CASCADE |
| `ERPContact` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPAttachment` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPCategory` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPBOM` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPProductionOrder` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPProductionStatus` | erp.py | **No** | FK+索引 | CASCADE |
| `ERPPayment` | erp.py | **No** | FK+索引 | CASCADE |
| `OKRObjective` | okr.py | No | 索引 | - |
| `TenantSetting` | tenant_setting.py | No | PK | - |

### 无 tenant_id 的模型（通过 FK 间接隔离）

| 模型 | 隔离方式 | 风险 |
|------|----------|------|
| `AgentPermission` | agent_id FK → Agent | 低 |
| `Task` / `TaskLog` | agent_id FK → Agent | 低 |
| `ChatMessage` | agent_id FK → Agent | 低 |
| `ChatSession` | agent_id + user_id FK | 低 |
| `AuditLog` | user_id + agent_id FK | 低 |
| `ApprovalRequest` | agent_id FK | 低 |
| `AgentActivityLog` | agent_id FK | 低 |
| `AgentTrigger` | agent_id FK | 低 |
| `AgentSchedule` | agent_id FK | 低 |
| `AgentFocusItem` | agent_id FK | 低 |
| `AgentRelationship` | agent_id + member_id FK | 低 |
| `AgentAgentRelationship` | agent_id + target_agent_id FK | 低 |
| `AgentCredential` | agent_id FK | 低 |
| `WorkspaceFileRevision` | agent_id FK | 低 |
| `Notification` | user_id / agent_id FK | 低 |
| `GatewayMessage` | agent_id FK | 低 |
| `ChannelConfig` | agent_id FK | 低 |
| `ERPSalesOrderItem` | order_id FK → ERPSalesOrder | 低 |
| `ERPPurchaseOrderItem` | order_id FK → ERPPurchaseOrder | 低 |
| `SkillFile` | skill_id FK → Skill | 低 |

### 无 tenant_id 且无 FK 的模型（全局共享）

| 模型 | 说明 | 风险 |
|------|------|------|
| `Identity` | 全局身份，跨租户设计 | 设计如此 |
| `Tenant` | 租户本身 | 设计如此 |
| `SystemSetting` | 全局平台配置 | 设计如此 |
| `EnterpriseInfo` | 企业信息，所有租户共享 | **中** — 应加 tenant_id |
| `AgentTemplate` | 全局模板 | 低 — 设计为共享 |
| `OKRAlignment` | OKR 对齐关系 | 低 |

---

## 三、认证机制详解

### JWT 认证流程（`core/security.py`）

1. 登录时生成 JWT：`{sub: user_id, role: role, exp: expiry}`
2. **Token 不含 tenant_id**
3. 每次请求：`get_current_user()` 从 Token 提取 user_id → 查询 User 表 → 获取 tenant_id
4. 切换租户时生成新 JWT

### Agent 内部认证（`X-Agent-Tenant-Id`）

```python
# erp.py:47-53, agent_admin.py:28-36
agent_tid = request.headers.get("X-Agent-Tenant-Id")
if agent_tid:
    class _AgentUser:
        tenant_id = uuid.UUID(agent_tid)
        id = uuid.UUID(int=0)
```

- 仅用于 agent 调用内部 API（`call_erp_api`, `call_agent_admin_api`）
- **完全信任 header 值，无签名验证**
- 依赖网络隔离（只监听 127.0.0.1）保证安全

### 角色层级（`security.py:208`）

```
member < agent_admin < org_admin < platform_admin
```

`is_platform_admin`（Identity 级别）可绕过所有角色检查。

---

## 四、ERP vs Clawith 核心平台对比

| 维度 | ERP 系统 | Clawith 核心平台 |
|------|----------|-----------------|
| **tenant_id 列** | 全部 NOT NULL | 部分 nullable |
| **索引** | 全部有索引 | 部分无索引（Tool, PlazaPost） |
| **查询过滤** | 每个 endpoint 显式过滤 | 通过 `check_agent_access()` 间接检查 |
| **一致性** | 高（4000 行代码统一模式） | 中（部分 endpoint 无显式过滤） |
| **子表隔离** | 明细表通过父表 FK | 同样模式 |
| **认证** | JWT + Agent header 双通道 | JWT + Agent header 双通道 |

---

## 五、已发现的安全问题

### 🔴 严重（P0）

#### 1. X-Agent-Tenant-Id 头部信任问题

**位置**：`erp.py:47-53`，`agent_admin.py:28-36`

**问题**：任何能访问 API 的客户端都可以伪造 `X-Agent-Tenant-Id` header，冒充任意租户读写数据。无签名、令牌或来源验证。

**当前缓解**：后端只监听 `127.0.0.1:8008`，外部无法直接访问。

**风险场景**：
- 部署反向代理时未 strip 此 header
- 服务器端口暴露到公网
- 同一网络内的其他服务可以访问

**建议修复**：对 header 值加 HMAC 签名验证，或改用内部 JWT 令牌。

---

### 🟡 高风险（P1）

#### 2. LLM 模型删除泄露跨租户数据

**位置**：`enterprise.py:262-267, 280-285`

```python
# 查引用时未过滤 tenant_id
ref_result = await db.execute(
    select(Agent.name).where(
        or_(Agent.primary_model_id == model_id, Agent.fallback_model_id == model_id)
    )
)
# 更新时也未过滤 — 修改了其他租户的 agent
```

**影响**：
- 删除模型时返回其他租户的 agent 名称（信息泄露）
- 清空模型引用时修改了其他租户的 agent 配置（数据篡改）

#### 3. LLM 模型设默认未验证所有权

**位置**：`enterprise.py:205`

```python
# 未加 tenant_id 过滤
result = await db.execute(select(LLMModel).where(LLMModel.id == model_id))
```

**影响**：org_admin 可以将其他租户的模型设为默认。

#### 4. Agent nullable tenant_id 绕过检查

**位置**：`agent_admin.py:50, 469`

```python
if agent.tenant_id and agent.tenant_id != tenant_id:  # tenant_id=None 时跳过！
```

**影响**：如果某个 Agent 的 tenant_id 为 NULL，跨租户访问检查被绕过。

---

### 🟠 中等（P2）

#### 5. 订单号生成器无租户感知

**位置**：`erp.py:94-106`

```python
# 全局计数，不按租户过滤
result = await db.execute(
    select(func.count()).select_from(Model).where(col.like(like_pattern))
)
```

**影响**：订单号序列是全局的，不同租户的序号会互相影响。非数据泄露，但违反隔离原则。

#### 6. EnterpriseInfo 无租户隔离

**位置**：`audit.py:67`

所有租户共享同一份企业信息数据（`org_structure`、`company_profile` 等）。

#### 7. Agent 创建允许跨租户指定

**位置**：`agents.py:440-443`

org_admin 可以在创建 Agent 时指定其他租户的 `tenant_id`。

---

### 🟢 低风险（P3）

#### 8. Redis key 无租户前缀

Key 格式如 `workspace-lock:{agent_id}:{path}`，通过 agent_id 间接隔离。违反纵深防御原则。

#### 9. Tool 和 AgentTemplate 全局可见

设计为共享平台资源，但如果未来支持租户级自定义工具，需要加隔离。

#### 10. PlazaPost.tenant_id 无 FK 约束和索引

软隔离，依赖应用层过滤。

---

## 六、隔离模式总结

```
┌─────────────────────────────────────────────────────┐
│                    认证层                             │
│  JWT → User.tenant_id (每次请求从 DB 获取)            │
│  Agent → X-Agent-Tenant-Id (信任 header，无签名)  ⚠️  │
├─────────────────────────────────────────────────────┤
│                    查询层                             │
│  ERP: 每个 .where() 显式过滤 tenant_id  ✅            │
│  Agent: check_agent_access() 权限检查  ✅             │
│  LLM: 部分 endpoint 缺少过滤  ⚠️                     │
├─────────────────────────────────────────────────────┤
│                    模型层                             │
│  ERP: 全部 NOT NULL + 索引 + CASCADE  ✅              │
│  Core: 部分 nullable，部分通过 FK 间接关联  ⚠️        │
├─────────────────────────────────────────────────────┤
│                    存储层                             │
│  按 agent_id (UUID) 隔离  ✅                          │
├─────────────────────────────────────────────────────┤
│                    缓存层                             │
│  Redis key 无租户前缀  ⚠️                             │
└─────────────────────────────────────────────────────┘
```

---

## 七、修复优先级路线图

| 优先级 | 修复项 | 文件 | 工作量 |
|--------|--------|------|--------|
| **P0** | X-Agent-Tenant-Id 加 HMAC 签名验证 | erp.py, agent_admin.py, agent_tools.py | 中 |
| **P1** | LLM 模型删除/设默认加 tenant_id 过滤 | enterprise.py | 小 |
| **P1** | agent_admin.py nullable tenant_id 改为严格比较 | agent_admin.py | 小 |
| **P2** | _generate_order_no 加 tenant_id 参数 | erp.py | 小 |
| **P2** | EnterpriseInfo 加 tenant_id（需数据迁移） | audit.py, erp.py | 大 |
| **P3** | Redis key 加租户前缀 | 各处 | 中 |
