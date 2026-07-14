"""ERP system models.

Core tables powering the ERP feature:
  - ERPCustomer         : Customer master data
  - ERPSupplier         : Supplier master data
  - ERPProduct           : Product / finished goods (sales-related)
  - ERPMaterial          : Material / raw material (purchase-related)
  - ERPWarehouse         : Warehouse locations
  - ERPSalesOrder        : Sales order header
  - ERPSalesOrderItem    : Sales order line items
  - ERPPurchaseOrder     : Purchase order header
  - ERPPurchaseOrderItem : Purchase order line items
  - ERPStockRecord       : Inventory movement ledger
  - ERPFinancialRecord   : Income / expense / receivable / payable ledger
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ERPCustomer(Base):
    """Customer master data, scoped per tenant."""

    __tablename__ = "erp_customers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # 客户编码，如 K001
    short_name: Mapped[str | None] = mapped_column(String(100))  # 简称
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    contact_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text)
    tax_id: Mapped[str | None] = mapped_column(String(50))
    salesperson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # 业务员
    company_name: Mapped[str | None] = mapped_column(String(200))  # 公司名称
    bank_name: Mapped[str | None] = mapped_column(String(200))  # 银行名称
    bank_account_name: Mapped[str | None] = mapped_column(String(200))  # 银行账户名
    bank_account_number: Mapped[str | None] = mapped_column(String(100))  # 银行账号
    bank_branch: Mapped[str | None] = mapped_column(String(200))  # 开户银行
    credit_code: Mapped[str | None] = mapped_column(String(50))  # 统一社会信用代码
    legal_representative: Mapped[str | None] = mapped_column(String(100))  # 法人代表
    legal_rep_phone: Mapped[str | None] = mapped_column(String(50))  # 法人电话
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | inactive | archived

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPSupplier(Base):
    """Supplier master data, scoped per tenant."""

    __tablename__ = "erp_suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # 供应商编码，如 G001
    short_name: Mapped[str | None] = mapped_column(String(100))  # 简称
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    contact_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text)
    tax_id: Mapped[str | None] = mapped_column(String(50))
    payment_terms: Mapped[str | None] = mapped_column(String(100))
    salesperson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # 业务员
    company_name: Mapped[str | None] = mapped_column(String(200))  # 公司名称
    bank_name: Mapped[str | None] = mapped_column(String(200))  # 银行名称
    bank_account_name: Mapped[str | None] = mapped_column(String(200))  # 银行账户名
    bank_account_number: Mapped[str | None] = mapped_column(String(100))  # 银行账号
    bank_branch: Mapped[str | None] = mapped_column(String(200))  # 开户银行
    credit_code: Mapped[str | None] = mapped_column(String(50))  # 统一社会信用代码
    legal_representative: Mapped[str | None] = mapped_column(String(100))  # 法人代表
    legal_rep_phone: Mapped[str | None] = mapped_column(String(50))  # 法人电话
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | inactive | archived

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPProduct(Base):
    """Product / finished-goods master data (sales-related), scoped per tenant."""

    __tablename__ = "erp_products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # 产品编码，如 P001
    sku: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str | None] = mapped_column(String(20))
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | inactive | archived

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPMaterial(Base):
    """Material / raw-material master data (purchase-related), scoped per tenant."""

    __tablename__ = "erp_materials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # 物料编码，如 M001
    sku: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str | None] = mapped_column(String(20))
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | inactive | archived

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPWarehouse(Base):
    """Warehouse / storage location, scoped per tenant."""

    __tablename__ = "erp_warehouses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    manager: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | inactive | archived

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPSalesOrder(Base):
    """Sales order header, scoped per tenant."""

    __tablename__ = "erp_sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_no: Mapped[str | None] = mapped_column(String(50))
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_customers.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft | confirmed | shipped | completed | cancelled
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPSalesOrderItem(Base):
    """Individual line item within a sales order."""

    __tablename__ = "erp_sales_order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_sales_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_products.id"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    subtotal: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    notes: Mapped[str | None] = mapped_column(Text)


class ERPPurchaseOrder(Base):
    """Purchase order header, scoped per tenant."""

    __tablename__ = "erp_purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_no: Mapped[str | None] = mapped_column(String(50))
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_suppliers.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft | confirmed | received | completed | cancelled
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPPurchaseOrderItem(Base):
    """Individual line item within a purchase order (references material)."""

    __tablename__ = "erp_purchase_order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_materials.id"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    subtotal: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    notes: Mapped[str | None] = mapped_column(Text)


class ERPStockRecord(Base):
    """Inventory movement ledger (in / out / transfer).

    Tracks every stock change with optional links back to the originating
    sales or purchase order.
    """

    __tablename__ = "erp_stock_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    record_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # 出入库单号
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_products.id"),
        nullable=True,
        index=True,
    )
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_materials.id"),
        nullable=True,
        index=True,
    )
    record_source: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # 'product' | 'material'
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_warehouses.id"),
        nullable=False,
        index=True,
    )
    record_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # in | out | transfer
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    related_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    production_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_production_orders.id"),
        nullable=True,
        index=True,
    )  # 关联生产工单
    reason: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ERPFinancialRecord(Base):
    """Financial ledger covering income, expense, receivable and payable.

    Links to customers, suppliers and originating orders where applicable.
    """

    __tablename__ = "erp_financial_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    record_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # 财务记录编号
    record_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # income | expense | receivable | payable
    category: Mapped[str | None] = mapped_column(String(100))
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    related_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    description: Mapped[str | None] = mapped_column(Text)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | confirmed | cancelled
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPSettings(Base):
    """Per-tenant ERP configuration (single row per tenant).

    auto_stock_deduct: when True, confirming a sales order automatically
                       deducts stock; confirming a purchase order adds stock.
    """
    __tablename__ = "erp_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    company_name: Mapped[str | None] = mapped_column(String(200))
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="CNY")
    fiscal_year_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    auto_stock_deduct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_payment_terms: Mapped[str | None] = mapped_column(String(200))
    customer_code_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="K")
    customer_code_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    supplier_code_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="G")
    supplier_code_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    product_code_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="P")
    product_code_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    material_code_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="M")
    material_code_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    sales_order_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="SO")
    sales_order_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    purchase_order_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="PO")
    purchase_order_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    outbound_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="OUT")
    outbound_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    inbound_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="IN")
    inbound_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    transfer_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="TR")
    transfer_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    financial_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="FIN")
    financial_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)

    # 生产工单编码
    production_order_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="PRD")
    production_order_digits: Mapped[int] = mapped_column(Integer, nullable=False, default=4)

    # 模块开关
    module_customers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_suppliers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_products: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_materials: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_inventory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_production: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    module_finance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_payments: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 分类（JSON 字段存储列表）
    warehouse_categories: Mapped[str | None] = mapped_column(Text)   # JSON: ["成品仓","原料仓","退货仓"]
    outbound_categories: Mapped[str | None] = mapped_column(Text)    # JSON: ["销售出库","生产领料","退货出库","调拨出库"]
    inbound_categories: Mapped[str | None] = mapped_column(Text)     # JSON: ["采购入库","生产入库","退货入库","调拨入库"]

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


# ─── 联系人与附件 ────────────────────────────────────────────────────────────


class ERPContact(Base):
    """客户/供应商联系人，通过 parent_type + parent_id 区分归属。"""

    __tablename__ = "erp_contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'customer' or 'supplier'
    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ERPAttachment(Base):
    """客户/供应商附件，通过 parent_type + parent_id 区分归属。"""

    __tablename__ = "erp_attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'customer' or 'supplier'
    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str | None] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ERPCategory(Base):
    """客户/供应商分类，通过 type 区分。"""

    __tablename__ = "erp_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'customer' or 'supplier'
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ─── 生产模块 ────────────────────────────────────────────────────────────────


class ERPBOM(Base):
    """物料清单（Bill of Materials）—— 记录生产一个成品需要哪些原料及其用量。"""

    __tablename__ = "erp_boms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_products.id"),
        nullable=False,
        index=True,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_materials.id"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=1)
    unit: Mapped[str | None] = mapped_column(String(20))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ERPProductionOrder(Base):
    """生产工单 —— 记录一次生产任务及其状态。"""

    __tablename__ = "erp_production_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_products.id"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("erp_warehouses.id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft | confirmed | completed | cancelled
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ERPProductionStatus(Base):
    """生产状态自定义 —— 允许租户自定义生产工单的可用状态。"""

    __tablename__ = "erp_production_statuses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ─── 收付款模块 ──────────────────────────────────────────────────────────────


class ERPPayment(Base):
    """收付款记录 —— 记录客户/供应商的每一笔收款或付款。"""

    __tablename__ = "erp_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    payment_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'payment' | 'receipt'
    related_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(30))
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
