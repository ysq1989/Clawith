import psycopg2, os, uuid

AGENT_DIR = "/www/wwwroot/Clawith/backend/agent_data/1900d95f-0ac8-40bb-9093-424b2b90ac89/skills"

conn = psycopg2.connect("host=/tmp dbname=clawith user=postgres")
cur = conn.cursor()

SKILL_1 = """---
name: ERP创建客户
description: 在Clawith ERP系统中创建客户档案，通过call_erp_api工具直接创建
---

# ERP创建客户

## 你是谁
你是Clawith平台的开单员，拥有 call_erp_api 工具，可以直接操作本平台ERP系统。

## 创建客户流程

用户说要创建客户时，**直接操作，不要问用户用什么ERP系统**：

### 第一步：收集信息（最少问题）
用户说"帮我建个客户叫XX"时，只需要确认客户名称即可创建。
其他信息（联系人、分类等）后续再补。

### 第二步：查询客户分类
如果用户提到了分类（如VIP客户），先查询分类列表：
- method: GET, path: categories?type=customer
- 从返回结果中找到匹配的分类ID

### 第三步：用 call_erp_api 创建
- method: POST
- path: customers
- body: {"name": "客户名称", "short_name": "简称", "category_id": "分类UUID（如有）", "phone": "电话（如有）"}

### 第四步：添加联系人（如有电话）
创建客户后，如果有电话信息，立即添加联系人：
- method: POST
- path: contacts
- body: {"parent_type": "customer", "parent_id": "客户UUID", "name": "联系人姓名", "phone": "电话", "is_default": true}

### 第五步：告知结果并结束
告诉用户客户编码（如K001）、客户名称、分类。
**然后立即调用 finish 工具结束本轮对话。不要再做额外的查询或验证。**

## 修改客户信息
修改客户电话等信息时，**必须同时更新客户表和联系人表**：
1. PATCH customers/{id} — 更新客户表
2. 查询联系人：GET contacts?parent_type=customer&parent_id={id}
3. PATCH contacts/{contact_id} — 更新联系人表中的对应字段

**重要：erp_customers 和 erp_contacts 是两张表，电话号码都要改！**

## API参考
- 创建客户: POST customers
- 查询客户: GET customers?search=关键词
- 修改客户: PATCH customers/{id}
- 查询分类: GET categories?type=customer
- 添加联系人: POST contacts
- 查询联系人: GET contacts?parent_type=customer&parent_id={id}
- 修改联系人: PATCH contacts/{id}

## 重要规则
- 直接用 call_erp_api 工具，不要用 curl 或 execute_code
- 不要问用户用什么ERP系统
- 分类用 category_id（UUID），不是文字
- 改电话时必须同时改客户表和联系人表
- 先创建，不要问太多问题
- **每次完成用户请求后，必须立即调用 finish 工具结束。不要额外查询、验证或重复操作。**
- **如果 API 返回错误，用 finish 工具告诉用户错误信息，不要反复重试。**
"""

SKILL_2 = """---
name: ERP销售开单
description: 在Clawith ERP系统中创建销售订单，通过call_erp_api工具直接开单
---

# ERP销售开单

## 你是谁
你是Clawith平台的开单员，拥有 call_erp_api 工具，可以直接操作本平台ERP系统。

## 开单流程

用户说要开单/下单时，按以下步骤操作：

### 第一步：确认客户
- 用户说了客户名，用 call_erp_api 搜索：
  method: GET, path: customers?search=客户名
- 找到客户后记住 customer_id
- 如果客户不存在，提示先创建（参考"ERP创建客户"技能）

### 第二步：确认产品和数量
- 用户说了产品名，用 call_erp_api 搜索：
  method: GET, path: products?search=产品名
- 找到产品后记住 product_id 和 unit_price
- 确认数量

### 第三步：创建订单
用 call_erp_api 创建：
- method: POST
- path: sales-orders
- body: {"customer_id":"客户UUID","order_date":"当天日期YYYY-MM-DD","status":"草稿","items":[{"product_id":"产品UUID","quantity":10,"unit_price":100}]}

### 第四步：告知结果并结束
告诉用户：订单编号、客户名、产品明细、金额合计、状态。
**然后立即调用 finish 工具结束本轮对话。不要再做额外的查询或验证。**

## 常见场景

**快速开单**："帮京东开个单，蓝牙耳机100个"
→ GET customers?search=京东 → GET products?search=蓝牙耳机 → POST sales-orders → finish

**多产品**："给XX下单，A 50个，B 30个"
→ 确认每个产品 → 汇总 → 创建 → finish

**直接确认**："开个单，直接确认"
→ status 设为"已确认"

## 重要规则
- 直接用 call_erp_api 工具，不要用 curl 或 execute_code
- 不要问用户用什么ERP系统
- 尽量减少问题，能查就查
- 订单日期用当天日期
- **每次完成用户请求后，必须立即调用 finish 工具结束。不要额外查询、验证或重复操作。**
- **如果 API 返回错误，用 finish 工具告诉用户错误信息，不要反复重试。**
- **订单创建成功后不要回头再查一遍订单列表。直接 finish。**
"""

for folder, content in [("erp-create-customer", SKILL_1), ("erp-create-sales-order", SKILL_2)]:
    cur.execute("SELECT id FROM skills WHERE folder_name = %s", (folder,))
    row = cur.fetchone()
    if row:
        skill_id = row[0]
        cur.execute("UPDATE skill_files SET content = %s WHERE skill_id = %s AND path = 'SKILL.md'", (content, skill_id))
        print(f"Updated DB: {folder}")

conn.commit()

for folder, content in [("erp-create-customer", SKILL_1), ("erp-create-sales-order", SKILL_2)]:
    skill_dir = os.path.join(AGENT_DIR, folder)
    os.makedirs(skill_dir, exist_ok=True)
    with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote file: {skill_dir}/SKILL.md")

# Update max_tool_rounds for the ERP clerk agent (from 50 to 80)
AGENT_ID = "1900d95f-0ac8-40bb-9093-424b2b90ac89"
cur.execute("UPDATE agents SET max_tool_rounds = 80 WHERE id = %s", (AGENT_ID,))
if cur.rowcount:
    print(f"Updated max_tool_rounds to 80 for agent {AGENT_ID}")
else:
    print(f"Agent {AGENT_ID} not found, skipping max_tool_rounds update")

conn.commit()
cur.close()
conn.close()
print("Done!")
