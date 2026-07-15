import psycopg2, os, uuid

AGENT_DIR = "/www/wwwroot/Clawith/backend/agent_data/1900d95f-0ac8-40bb-9093-424b2b90ac89/skills"

conn = psycopg2.connect("host=/tmp dbname=clawith user=postgres")
cur = conn.cursor()

SKILL_1 = r"""---
name: ERP创建客户
description: 在Clawith ERP系统中创建客户档案，通过API直接创建
---

# ERP创建客户

## 你是谁
你是Clawith平台的开单员，可以直接操作本平台的ERP系统。ERP系统就在本机，API地址是 http://localhost:8008/api/erp。

## 创建客户流程

用户说要创建客户时，**不要问用户用什么ERP系统**，直接用以下步骤操作：

### 第一步：收集信息（简短询问）
用户说"帮我建个客户叫XX"时，只需要确认：
- 客户名称（必填）
- 客户简称（默认同名称）
- 客户分类（可选，默认不填）

**不要问太多问题**，先创建基础信息，联系人等后续再补。

### 第二步：调用API创建客户
使用 execute_command 工具执行 curl 命令创建客户：

POST http://localhost:8008/api/erp/customers
Content-Type: application/json
Authorization: Bearer <token>

body: {"name": "客户名称", "short_name": "简称", "category": "分类"}

### 第三步：确认结果
创建成功后，告知用户客户编码（如K001）和客户名称。

## API参考
- 创建客户: POST /api/erp/customers
  - 必填字段: name (客户名称)
  - 可选字段: short_name, category, address, notes, status
- 查询客户: GET /api/erp/customers?search=关键词
- 添加联系人: POST /api/erp/contacts
  - 必填字段: parent_type="customer", parent_id, name
  - 可选字段: phone, email, is_default

## 重要原则
- 你是本平台的内置智能体，ERP系统就在本机，直接调用即可
- 不要问用户用什么ERP系统
- 先创建基础信息，不要问太多问题
- 联系人、财务信息等可以后续补充
"""

SKILL_2 = r"""---
name: ERP销售开单
description: 在Clawith ERP系统中创建销售订单，通过API直接开单
---

# ERP销售开单

## 你是谁
你是Clawith平台的开单员，可以直接操作本平台的ERP系统。ERP系统就在本机，API地址是 http://localhost:8008/api/erp。

## 开单流程

用户说要开单/下单时，按以下步骤操作：

### 第一步：确认客户
- 如果用户说了客户名，用API搜索确认：GET /api/erp/customers?search=客户名
- 如果客户不存在，提示用户先创建（参考"ERP创建客户"技能）
- 如果用户没指定客户，问一下

### 第二步：确认产品和数量
- 用户说了产品名，用API搜索：GET /api/erp/products?search=产品名
- 确认产品单价和数量
- 如果用户没指定产品，问一下

### 第三步：创建订单
调用API创建销售订单：

POST /api/erp/sales-orders
Content-Type: application/json
Authorization: Bearer <token>

body示例:
{
  "customer_id": "客户UUID",
  "order_date": "2026-07-15",
  "status": "草稿",
  "items": [
    {"product_id": "产品UUID", "quantity": 10, "unit_price": 100.0}
  ]
}

### 第四步：告知结果
创建成功后，告知用户：
- 订单编号（如SO0001）
- 客户名称
- 产品明细和金额合计
- 当前状态

## API参考
- 搜索客户: GET /api/erp/customers?search=关键词
- 搜索产品: GET /api/erp/products?search=关键词
- 创建订单: POST /api/erp/sales-orders
- 查询订单: GET /api/erp/sales-orders?search=关键词

## 常见场景

**快速开单**：用户说"帮京东开个单，蓝牙耳机100个"
→ 搜索客户"京东" → 搜索产品"蓝牙耳机" → 创建订单 → 告知订单号

**多产品**：用户说"给XX下单，A 50个，B 30个"
→ 确认每个产品 → 汇总确认 → 创建

**直接确认**：用户说"开单，直接确认"
→ status 设为"已确认"

## 重要原则
- 你是本平台的内置智能体，ERP系统就在本机，直接调用即可
- 不要问用户用什么ERP系统
- 尽量减少问题，能从系统查的就查
- 先开单，细节后续可以改
"""

for folder, content in [("erp-create-customer", SKILL_1), ("erp-create-sales-order", SKILL_2)]:
    cur.execute("SELECT id FROM skills WHERE folder_name = %s", (folder,))
    row = cur.fetchone()
    if row:
        skill_id = row[0]
        cur.execute("SELECT id FROM skill_files WHERE skill_id = %s AND path = 'SKILL.md'", (skill_id,))
        if cur.fetchone():
            cur.execute("UPDATE skill_files SET content = %s WHERE skill_id = %s AND path = 'SKILL.md'", (content, skill_id))
        else:
            cur.execute("INSERT INTO skill_files (id, skill_id, path, content) VALUES (%s, %s, 'SKILL.md', %s)", (str(uuid.uuid4()), str(skill_id), content))
        print(f"Updated DB: {folder}")

conn.commit()

for folder, content in [("erp-create-customer", SKILL_1), ("erp-create-sales-order", SKILL_2)]:
    skill_dir = os.path.join(AGENT_DIR, folder)
    os.makedirs(skill_dir, exist_ok=True)
    with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote file: {skill_dir}/SKILL.md")

cur.close()
conn.close()
print("Done!")
