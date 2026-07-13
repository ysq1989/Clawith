"""ERP REST API — customers, suppliers, products, materials, orders, inventory, finance, reports.

All endpoints are tenant-scoped: data is filtered by the requesting user's
tenant_id so cross-tenant leakage is impossible.

Route summary
─────────────
Customers      GET/POST /customers, GET/PATCH/DELETE /customers/{id}
Suppliers      GET/POST /suppliers, GET/PATCH/DELETE /suppliers/{id}
Products       GET/POST /products,  GET/PATCH/DELETE /products/{id}
Materials      GET/POST /materials, GET/PATCH/DELETE /materials/{id}
Warehouses     GET/POST /warehouses, GET/PATCH/DELETE /warehouses/{id}
Sales orders   GET/POST /sales-orders, GET/PATCH/DELETE /sales-orders/{id},
               POST /sales-orders/{id}/status
Purchase orders GET/POST /purchase-orders, GET/PATCH/DELETE /purchase-orders/{id},
               POST /purchase-orders/{id}/status
Stock          GET /stock, POST /stock/{inbound,outbound,transfer},
               GET /stock/alerts, GET /stock/records
Finance        GET/POST /financials, GET /financials/summary
Reports        GET /reports/{sales,purchase,inventory,customers,profit-loss}
Settings       GET/PUT /settings
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import String, select, func, or_

from app.api.auth import get_current_user
from app.database import async_session
from app.models.erp import (
    ERPCustomer,
    ERPFinancialRecord,
    ERPMaterial,
    ERPPurchaseOrder,
    ERPPurchaseOrderItem,
    ERPProduct,
    ERPSettings,
    ERPSalesOrder,
    ERPSalesOrderItem,
    ERPStockRecord,
    ERPSupplier,
    ERPWarehouse,
)

router = APIRouter(prefix="/api/erp", tags=["erp"])


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _to_str(val) -> str | None:
    return str(val) if val is not None else None


def _to_f(val) -> float:
    return float(val) if val is not None else 0.0


async def _generate_order_no(db, Model, prefix: str, today: date) -> str:
    """Generate sequential order_no: e.g. SO202607130001."""
    date_str = today.strftime("%Y%m%d")
    like_pattern = f"{prefix}{date_str}%"
    result = await db.execute(
        select(func.count()).select_from(Model).where(Model.order_no.like(like_pattern))
    )
    seq = (result.scalar() or 0) + 1
    return f"{prefix}{date_str}{seq:04d}"


# Valid status transitions
_SALES_STATUS_FLOW = {
    "draft":     {"confirmed", "cancelled"},
    "confirmed": {"processing", "cancelled"},
    "processing": {"shipped", "cancelled"},
    "shipped":   {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}

_PURCHASE_STATUS_FLOW = {
    "draft":     {"confirmed", "cancelled"},
    "confirmed": {"receiving", "cancelled"},
    "receiving": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _validate_transition(current: str, new: str, flow: dict[str, set[str]]) -> None:
    allowed = flow.get(current, set())
    if new not in allowed:
        raise HTTPException(
            400,
            f"Cannot transition from '{current}' to '{new}'. "
            f"Allowed: {', '.join(sorted(allowed)) or 'none'}",
        )


async def _get_or_create_settings(db, tenant_id: uuid.UUID) -> ERPSettings:
    result = await db.execute(
        select(ERPSettings).where(ERPSettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = ERPSettings(tenant_id=tenant_id)
        db.add(settings)
        await db.flush()
    return settings


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


class CustomerCreate(BaseModel):
    name: str
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    status: str | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    status: str
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    name: str
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    payment_terms: str | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    payment_terms: str | None = None
    notes: str | None = None
    status: str | None = None


class SupplierOut(BaseModel):
    id: str
    name: str
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    payment_terms: str | None = None
    notes: str | None = None
    status: str
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    sku: str | None = None
    category: str | None = None
    unit: str | None = "pcs"
    unit_price: float | None = None
    stock_qty: int = 0
    min_stock: int = 0
    description: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category: str | None = None
    unit: str | None = None
    unit_price: float | None = None
    stock_qty: int | None = None
    min_stock: int | None = None
    description: str | None = None
    status: str | None = None


class ProductOut(BaseModel):
    id: str
    name: str
    sku: str | None = None
    category: str | None = None
    unit: str | None = None
    unit_price: float | None = None
    stock_qty: int
    min_stock: int
    description: str | None = None
    status: str
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


# ─── 物料 Schemas ─────────────────────────────────────────────────────────────

class MaterialCreate(BaseModel):
    name: str
    sku: str | None = None
    category: str | None = None
    unit: str | None = "pcs"
    cost_price: float | None = None
    stock_qty: int = 0
    min_stock: int = 0
    description: str | None = None


class MaterialUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category: str | None = None
    unit: str | None = None
    cost_price: float | None = None
    stock_qty: int | None = None
    min_stock: int | None = None
    description: str | None = None
    status: str | None = None


class MaterialOut(BaseModel):
    id: str
    name: str
    sku: str | None = None
    category: str | None = None
    unit: str | None = None
    cost_price: float | None = None
    stock_qty: int
    min_stock: int
    description: str | None = None
    status: str
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class WarehouseCreate(BaseModel):
    name: str
    code: str | None = None
    address: str | None = None
    manager: str | None = None
    notes: str | None = None


class WarehouseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    manager: str | None = None
    notes: str | None = None
    status: str | None = None


class WarehouseOut(BaseModel):
    id: str
    name: str
    code: str | None = None
    address: str | None = None
    manager: str | None = None
    notes: str | None = None
    status: str
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class SalesOrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_price: float | None = None
    notes: str | None = None


class SalesOrderItemOut(BaseModel):
    id: str
    product_id: str
    product_name: str | None = None
    quantity: int
    unit_price: float
    subtotal: float
    notes: str | None = None

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    customer_id: str
    order_date: str  # YYYY-MM-DD
    due_date: str | None = None
    discount: float = 0
    tax_amount: float = 0
    notes: str | None = None
    items: list[SalesOrderItemCreate]


class SalesOrderUpdate(BaseModel):
    customer_id: str | None = None
    due_date: str | None = None
    discount: float | None = None
    tax_amount: float | None = None
    notes: str | None = None
    items: list[SalesOrderItemCreate] | None = None


class SalesOrderOut(BaseModel):
    id: str
    order_no: str
    customer_id: str
    customer_name: str | None = None
    status: str
    total_amount: float
    discount: float
    tax_amount: float
    net_amount: float
    order_date: str
    due_date: str | None = None
    notes: str | None = None
    items: list[SalesOrderItemOut] = []
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class PurchaseOrderItemCreate(BaseModel):
    material_id: str
    quantity: int
    unit_price: float | None = None
    notes: str | None = None


class PurchaseOrderItemOut(BaseModel):
    id: str
    material_id: str
    material_name: str | None = None
    quantity: int
    unit_price: float
    subtotal: float
    notes: str | None = None

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    order_date: str  # YYYY-MM-DD
    due_date: str | None = None
    discount: float = 0
    tax_amount: float = 0
    notes: str | None = None
    items: list[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseModel):
    supplier_id: str | None = None
    due_date: str | None = None
    discount: float | None = None
    tax_amount: float | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] | None = None


class PurchaseOrderOut(BaseModel):
    id: str
    order_no: str
    supplier_id: str
    supplier_name: str | None = None
    status: str
    total_amount: float
    discount: float
    tax_amount: float
    net_amount: float
    order_date: str
    due_date: str | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemOut] = []
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    new_status: str


class StockOperation(BaseModel):
    record_source: str  # 'product' | 'material'
    product_id: str | None = None
    material_id: str | None = None
    warehouse_id: str
    quantity: int
    reason: str | None = None


class StockTransfer(BaseModel):
    record_source: str  # 'product' | 'material'
    product_id: str | None = None
    material_id: str | None = None
    from_warehouse_id: str
    to_warehouse_id: str
    quantity: int


class StockRecordOut(BaseModel):
    id: str
    record_source: str | None = None  # 'product' | 'material'
    product_id: str | None = None
    material_id: str | None = None
    warehouse_id: str
    record_type: str
    quantity: int
    related_order_id: str | None = None
    reason: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class FinancialCreate(BaseModel):
    record_type: str  # 'income' | 'expense'
    amount: float
    category: str | None = None
    description: str | None = None
    related_order_id: str | None = None
    customer_id: str | None = None
    supplier_id: str | None = None
    record_date: str  # YYYY-MM-DD
    payment_method: str | None = None
    status: str = "pending"


class FinancialRecordOut(BaseModel):
    id: str
    record_type: str
    category: str | None = None
    amount: float
    related_order_id: str | None = None
    customer_id: str | None = None
    supplier_id: str | None = None
    description: str | None = None
    record_date: str
    payment_method: str | None = None
    status: str
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class FinancialSummary(BaseModel):
    total_income: float
    total_expense: float
    receivable: float
    payable: float
    profit: float


class SalesReportItem(BaseModel):
    period_label: str
    order_count: int
    total_amount: float


class InventoryReportItem(BaseModel):
    product_id: str
    product_name: str
    sku: str | None = None
    stock_qty: int
    cost_price: float
    stock_value: float


class CustomerReportItem(BaseModel):
    customer_id: str
    customer_name: str
    total_amount: float
    order_count: int


class ERPSettingsUpdate(BaseModel):
    company_name: str | None = None
    currency: str | None = None
    fiscal_year_start: int | None = None
    auto_stock_deduct: bool | None = None
    default_payment_terms: str | None = None


class ERPSettingsOut(BaseModel):
    id: str
    company_name: str | None = None
    currency: str
    fiscal_year_start: int
    auto_stock_deduct: bool
    default_payment_terms: str | None = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
#  CUSTOMERS
# ═══════════════════════════════════════════════════════════════════════════════


def _customer_to_out(c):
    return CustomerOut(
        id=str(c.id), name=c.name,
        contact_name=c.contact_name, phone=c.phone,
        email=c.email, address=c.address, tax_id=c.tax_id,
        notes=c.notes, status=c.status,
        created_at=c.created_at.isoformat() if c.created_at else None,
        updated_at=c.updated_at.isoformat() if c.updated_at else None,
    )


@router.get("/customers")
async def list_customers(
    search: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPCustomer).where(ERPCustomer.tenant_id == user.tenant_id)
        if search:
            like = f"%{search}%"
            q = q.where(
                or_(
                    ERPCustomer.name.ilike(like),
                    ERPCustomer.contact_name.ilike(like),
                    ERPCustomer.email.ilike(like),
                )
            )
        if status:
            q = q.where(ERPCustomer.status == status)
        # Total count
        from sqlalchemy import func as sqlfunc
        count_q = select(sqlfunc.count()).select_from(q.subquery())
        total = (await db.execute(count_q)).scalar() or 0
        # Paginated results
        result = await db.execute(
            q.order_by(ERPCustomer.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )
        items = [_customer_to_out(c) for c in result.scalars().all()]
        return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/customers", response_model=CustomerOut)
async def create_customer(body: CustomerCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        obj = ERPCustomer(tenant_id=user.tenant_id, **body.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return _customer_to_out(obj)


@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPCustomer).where(
                ERPCustomer.id == customer_id,
                ERPCustomer.tenant_id == user.tenant_id,
            )
        )
        c = result.scalar_one_or_none()
        if not c:
            raise HTTPException(404, "Customer not found")
        return _customer_to_out(c)


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str, body: CustomerUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPCustomer).where(
                ERPCustomer.id == customer_id,
                ERPCustomer.tenant_id == user.tenant_id,
            )
        )
        c = result.scalar_one_or_none()
        if not c:
            raise HTTPException(404, "Customer not found")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(c, k, v)
        await db.commit()
        await db.refresh(c)
        return _customer_to_out(c)


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user=Depends(get_current_user)):
    """Soft-delete: set status to 'inactive'."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPCustomer).where(
                ERPCustomer.id == customer_id,
                ERPCustomer.tenant_id == user.tenant_id,
            )
        )
        c = result.scalar_one_or_none()
        if not c:
            raise HTTPException(404, "Customer not found")
        c.status = "inactive"
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  SUPPLIERS
# ═══════════════════════════════════════════════════════════════════════════════


def _supplier_to_out(s):
    return SupplierOut(
        id=str(s.id), name=s.name,
        contact_name=s.contact_name, phone=s.phone,
        email=s.email, address=s.address, tax_id=s.tax_id,
        payment_terms=s.payment_terms, notes=s.notes, status=s.status,
        created_at=s.created_at.isoformat() if s.created_at else None,
        updated_at=s.updated_at.isoformat() if s.updated_at else None,
    )


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(
    search: str | None = None,
    status: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPSupplier).where(ERPSupplier.tenant_id == user.tenant_id)
        if search:
            like = f"%{search}%"
            q = q.where(
                or_(
                    ERPSupplier.name.ilike(like),
                    ERPSupplier.contact_name.ilike(like),
                    ERPSupplier.email.ilike(like),
                )
            )
        if status:
            q = q.where(ERPSupplier.status == status)
        result = await db.execute(q.order_by(ERPSupplier.created_at.desc()))
        return [_supplier_to_out(s) for s in result.scalars().all()]


@router.post("/suppliers", response_model=SupplierOut)
async def create_supplier(body: SupplierCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        obj = ERPSupplier(tenant_id=user.tenant_id, **body.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return _supplier_to_out(obj)


@router.get("/suppliers/{supplier_id}", response_model=SupplierOut)
async def get_supplier(supplier_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPSupplier).where(
                ERPSupplier.id == supplier_id,
                ERPSupplier.tenant_id == user.tenant_id,
            )
        )
        s = result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Supplier not found")
        return _supplier_to_out(s)


@router.patch("/suppliers/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: str, body: SupplierUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPSupplier).where(
                ERPSupplier.id == supplier_id,
                ERPSupplier.tenant_id == user.tenant_id,
            )
        )
        s = result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Supplier not found")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(s, k, v)
        await db.commit()
        await db.refresh(s)
        return _supplier_to_out(s)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user=Depends(get_current_user)):
    """Soft-delete: set status to 'inactive'."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPSupplier).where(
                ERPSupplier.id == supplier_id,
                ERPSupplier.tenant_id == user.tenant_id,
            )
        )
        s = result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Supplier not found")
        s.status = "inactive"
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  PRODUCTS
# ═══════════════════════════════════════════════════════════════════════════════


def _product_to_out(p):
    return ProductOut(
        id=str(p.id), name=p.name, sku=p.sku, category=p.category,
        unit=p.unit,
        unit_price=_to_f(p.unit_price),
        stock_qty=p.stock_qty, min_stock=p.min_stock,
        description=p.description, status=p.status,
        created_at=p.created_at.isoformat() if p.created_at else None,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
    )


@router.get("/products", response_model=list[ProductOut])
async def list_products(
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPProduct).where(ERPProduct.tenant_id == user.tenant_id)
        if search:
            like = f"%{search}%"
            q = q.where(
                or_(
                    ERPProduct.name.ilike(like),
                    ERPProduct.sku.ilike(like),
                )
            )
        if status:
            q = q.where(ERPProduct.status == status)
        if category:
            q = q.where(ERPProduct.category == category)
        result = await db.execute(q.order_by(ERPProduct.created_at.desc()))
        return [_product_to_out(p) for p in result.scalars().all()]


@router.post("/products", response_model=ProductOut)
async def create_product(body: ProductCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        obj = ERPProduct(tenant_id=user.tenant_id, **body.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return _product_to_out(obj)


@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPProduct).where(
                ERPProduct.id == product_id,
                ERPProduct.tenant_id == user.tenant_id,
            )
        )
        p = result.scalar_one_or_none()
        if not p:
            raise HTTPException(404, "Product not found")
        return _product_to_out(p)


@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str, body: ProductUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPProduct).where(
                ERPProduct.id == product_id,
                ERPProduct.tenant_id == user.tenant_id,
            )
        )
        p = result.scalar_one_or_none()
        if not p:
            raise HTTPException(404, "Product not found")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(p, k, v)
        await db.commit()
        await db.refresh(p)
        return _product_to_out(p)


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    """Soft-delete: set status to 'inactive'."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPProduct).where(
                ERPProduct.id == product_id,
                ERPProduct.tenant_id == user.tenant_id,
            )
        )
        p = result.scalar_one_or_none()
        if not p:
            raise HTTPException(404, "Product not found")
        p.status = "inactive"
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  物料 (MATERIALS)
# ═══════════════════════════════════════════════════════════════════════════════


def _material_to_out(m):
    return MaterialOut(
        id=str(m.id), name=m.name, sku=m.sku, category=m.category,
        unit=m.unit,
        cost_price=_to_f(m.cost_price),
        stock_qty=m.stock_qty, min_stock=m.min_stock,
        description=m.description, status=m.status,
        created_at=m.created_at.isoformat() if m.created_at else None,
        updated_at=m.updated_at.isoformat() if m.updated_at else None,
    )


@router.get("/materials", response_model=list[MaterialOut])
async def list_materials(
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPMaterial).where(ERPMaterial.tenant_id == user.tenant_id)
        if search:
            like = f"%{search}%"
            q = q.where(
                or_(
                    ERPMaterial.name.ilike(like),
                    ERPMaterial.sku.ilike(like),
                )
            )
        if status:
            q = q.where(ERPMaterial.status == status)
        if category:
            q = q.where(ERPMaterial.category == category)
        result = await db.execute(q.order_by(ERPMaterial.created_at.desc()))
        return [_material_to_out(m) for m in result.scalars().all()]


@router.post("/materials", response_model=MaterialOut)
async def create_material(body: MaterialCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        obj = ERPMaterial(tenant_id=user.tenant_id, **body.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return _material_to_out(obj)


@router.get("/materials/{material_id}", response_model=MaterialOut)
async def get_material(material_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPMaterial).where(
                ERPMaterial.id == material_id,
                ERPMaterial.tenant_id == user.tenant_id,
            )
        )
        m = result.scalar_one_or_none()
        if not m:
            raise HTTPException(404, "Material not found")
        return _material_to_out(m)


@router.patch("/materials/{material_id}", response_model=MaterialOut)
async def update_material(
    material_id: str, body: MaterialUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPMaterial).where(
                ERPMaterial.id == material_id,
                ERPMaterial.tenant_id == user.tenant_id,
            )
        )
        m = result.scalar_one_or_none()
        if not m:
            raise HTTPException(404, "Material not found")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(m, k, v)
        await db.commit()
        await db.refresh(m)
        return _material_to_out(m)


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user=Depends(get_current_user)):
    """Soft-delete: set status to 'inactive'."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPMaterial).where(
                ERPMaterial.id == material_id,
                ERPMaterial.tenant_id == user.tenant_id,
            )
        )
        m = result.scalar_one_or_none()
        if not m:
            raise HTTPException(404, "Material not found")
        m.status = "inactive"
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  WAREHOUSES
# ═══════════════════════════════════════════════════════════════════════════════


def _warehouse_to_out(w):
    return WarehouseOut(
        id=str(w.id), name=w.name, code=w.code,
        address=w.address, manager=w.manager, notes=w.notes,
        status=w.status,
        created_at=w.created_at.isoformat() if w.created_at else None,
        updated_at=w.updated_at.isoformat() if w.updated_at else None,
    )


@router.get("/warehouses", response_model=list[WarehouseOut])
async def list_warehouses(
    search: str | None = None,
    status: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPWarehouse).where(ERPWarehouse.tenant_id == user.tenant_id)
        if search:
            like = f"%{search}%"
            q = q.where(
                or_(
                    ERPWarehouse.name.ilike(like),
                    ERPWarehouse.code.ilike(like),
                )
            )
        if status:
            q = q.where(ERPWarehouse.status == status)
        result = await db.execute(q.order_by(ERPWarehouse.created_at.desc()))
        return [_warehouse_to_out(w) for w in result.scalars().all()]


@router.post("/warehouses", response_model=WarehouseOut)
async def create_warehouse(body: WarehouseCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        obj = ERPWarehouse(tenant_id=user.tenant_id, **body.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return _warehouse_to_out(obj)


@router.get("/warehouses/{warehouse_id}", response_model=WarehouseOut)
async def get_warehouse(warehouse_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPWarehouse).where(
                ERPWarehouse.id == warehouse_id,
                ERPWarehouse.tenant_id == user.tenant_id,
            )
        )
        w = result.scalar_one_or_none()
        if not w:
            raise HTTPException(404, "Warehouse not found")
        return _warehouse_to_out(w)


@router.patch("/warehouses/{warehouse_id}", response_model=WarehouseOut)
async def update_warehouse(
    warehouse_id: str, body: WarehouseUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPWarehouse).where(
                ERPWarehouse.id == warehouse_id,
                ERPWarehouse.tenant_id == user.tenant_id,
            )
        )
        w = result.scalar_one_or_none()
        if not w:
            raise HTTPException(404, "Warehouse not found")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(w, k, v)
        await db.commit()
        await db.refresh(w)
        return _warehouse_to_out(w)


@router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(warehouse_id: str, user=Depends(get_current_user)):
    """Soft-delete: set status to 'inactive'."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPWarehouse).where(
                ERPWarehouse.id == warehouse_id,
                ERPWarehouse.tenant_id == user.tenant_id,
            )
        )
        w = result.scalar_one_or_none()
        if not w:
            raise HTTPException(404, "Warehouse not found")
        w.status = "inactive"
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  SALES ORDERS
# ═══════════════════════════════════════════════════════════════════════════════


def _sales_order_to_out(order, items, customer_name):
    return SalesOrderOut(
        id=str(order.id),
        order_no=order.order_no,
        customer_id=str(order.customer_id),
        customer_name=customer_name,
        status=order.status,
        total_amount=_to_f(order.total_amount),
        discount=_to_f(order.discount),
        tax_amount=_to_f(order.tax_amount),
        net_amount=_to_f(order.net_amount),
        order_date=order.order_date.isoformat() if order.order_date else "",
        due_date=order.due_date.isoformat() if order.due_date else None,
        notes=order.notes,
        items=items,
        created_at=order.created_at.isoformat() if order.created_at else None,
        updated_at=order.updated_at.isoformat() if order.updated_at else None,
    )


async def _resolve_product_names(db, product_ids):
    """Batch-resolve product names for order items."""
    names: dict[uuid.UUID, str] = {}
    if product_ids:
        result = await db.execute(
            select(ERPProduct.id, ERPProduct.name).where(ERPProduct.id.in_(product_ids))
        )
        names = {row.id: row.name for row in result.fetchall()}
    return names


async def _resolve_material_names(db, material_ids):
    """Batch-resolve material names for purchase order items."""
    names: dict[uuid.UUID, str] = {}
    if material_ids:
        result = await db.execute(
            select(ERPMaterial.id, ERPMaterial.name).where(ERPMaterial.id.in_(material_ids))
        )
        names = {row.id: row.name for row in result.fetchall()}
    return names


@router.get("/sales-orders", response_model=list[SalesOrderOut])
async def list_sales_orders(
    status: str | None = None,
    customer_id: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPSalesOrder).where(ERPSalesOrder.tenant_id == user.tenant_id)
        if status:
            q = q.where(ERPSalesOrder.status == status)
        if customer_id:
            q = q.where(ERPSalesOrder.customer_id == customer_id)
        result = await db.execute(q.order_by(ERPSalesOrder.created_at.desc()))
        orders = result.scalars().all()

        customer_ids = list({o.customer_id for o in orders})
        customer_names: dict[uuid.UUID, str] = {}
        if customer_ids:
            c_result = await db.execute(
                select(ERPCustomer.id, ERPCustomer.name).where(ERPCustomer.id.in_(customer_ids))
            )
            customer_names = {row.id: row.name for row in c_result.fetchall()}

        return [
            _sales_order_to_out(o, [], customer_names.get(o.customer_id))
            for o in orders
        ]


@router.post("/sales-orders", response_model=SalesOrderOut)
async def create_sales_order(body: SalesOrderCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        # Validate customer
        cust_result = await db.execute(
            select(ERPCustomer).where(
                ERPCustomer.id == body.customer_id,
                ERPCustomer.tenant_id == user.tenant_id,
            )
        )
        customer = cust_result.scalar_one_or_none()
        if not customer:
            raise HTTPException(400, "Customer not found")
        customer_name = customer.name

        today = date.today()
        order_no = await _generate_order_no(db, ERPSalesOrder, "SO", today)

        total_amount = 0.0
        order_items: list[ERPSalesOrderItem] = []
        for item in body.items:
            price = item.unit_price
            if price is None:
                p_result = await db.execute(
                    select(ERPProduct.unit_price).where(ERPProduct.id == item.product_id)
                )
                p_row = p_result.first()
                price = float(p_row[0]) if p_row and p_row[0] is not None else 0.0
            subtotal = item.quantity * price
            total_amount += subtotal
            order_items.append(
                ERPSalesOrderItem(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=price,
                    subtotal=subtotal,
                    notes=item.notes,
                )
            )

        net_amount = total_amount - body.discount + body.tax_amount

        order = ERPSalesOrder(
            tenant_id=user.tenant_id,
            order_no=order_no,
            customer_id=body.customer_id,
            order_date=date.fromisoformat(body.order_date),
            due_date=date.fromisoformat(body.due_date) if body.due_date else None,
            status="draft",
            total_amount=total_amount,
            discount=body.discount,
            tax_amount=body.tax_amount,
            net_amount=net_amount,
            notes=body.notes,
        )
        db.add(order)
        await db.flush()
        for oi in order_items:
            oi.order_id = order.id
            db.add(oi)
        await db.commit()
        await db.refresh(order)

        item_outs = [
            SalesOrderItemOut(
                id=str(oi.id), product_id=str(oi.product_id),
                quantity=oi.quantity, unit_price=_to_f(oi.unit_price),
                subtotal=_to_f(oi.subtotal), notes=oi.notes,
            )
            for oi in order_items
        ]
        return _sales_order_to_out(order, item_outs, customer_name)


@router.get("/sales-orders/{order_id}", response_model=SalesOrderOut)
async def get_sales_order(order_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPSalesOrder).where(
                ERPSalesOrder.id == order_id,
                ERPSalesOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Sales order not found")

        cust_result = await db.execute(
            select(ERPCustomer.name).where(ERPCustomer.id == order.customer_id)
        )
        customer_name = cust_result.scalar_one_or_none()

        items_result = await db.execute(
            select(ERPSalesOrderItem).where(ERPSalesOrderItem.order_id == order.id)
        )
        items = items_result.scalars().all()
        product_names = await _resolve_product_names(db, list({i.product_id for i in items}))

        item_outs = [
            SalesOrderItemOut(
                id=str(i.id), product_id=str(i.product_id),
                product_name=product_names.get(i.product_id),
                quantity=i.quantity, unit_price=_to_f(i.unit_price),
                subtotal=_to_f(i.subtotal), notes=i.notes,
            )
            for i in items
        ]
        return _sales_order_to_out(order, item_outs, customer_name)


@router.patch("/sales-orders/{order_id}", response_model=SalesOrderOut)
async def update_sales_order(
    order_id: str, body: SalesOrderUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPSalesOrder).where(
                ERPSalesOrder.id == order_id,
                ERPSalesOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Sales order not found")

        update_data = body.model_dump(exclude_unset=True)
        items_data = update_data.pop("items", None)

        if "customer_id" in update_data:
            order.customer_id = update_data["customer_id"]
        if "due_date" in update_data:
            order.due_date = date.fromisoformat(update_data["due_date"]) if update_data["due_date"] else None
        if "discount" in update_data:
            order.discount = update_data["discount"]
        if "tax_amount" in update_data:
            order.tax_amount = update_data["tax_amount"]
        if "notes" in update_data:
            order.notes = update_data["notes"]

        if items_data is not None:
            # Remove old items
            old_items = await db.execute(
                select(ERPSalesOrderItem).where(ERPSalesOrderItem.order_id == order.id)
            )
            for old in old_items.scalars().all():
                await db.delete(old)

            total_amount = 0.0
            for item in items_data:
                price = item.unit_price
                if price is None:
                    p_result = await db.execute(
                        select(ERPProduct.unit_price).where(ERPProduct.id == item.product_id)
                    )
                    p_row = p_result.first()
                    price = float(p_row[0]) if p_row and p_row[0] is not None else 0.0
                subtotal = item.quantity * price
                total_amount += subtotal
                db.add(ERPSalesOrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=price,
                    subtotal=subtotal,
                    notes=item.notes,
                ))
            order.total_amount = total_amount
            order.net_amount = total_amount - float(order.discount) + float(order.tax_amount)
        elif "discount" in update_data or "tax_amount" in update_data:
            order.net_amount = float(order.total_amount or 0) - float(order.discount) + float(order.tax_amount)

        await db.commit()
        await db.refresh(order)

        # Reload items
        items_result = await db.execute(
            select(ERPSalesOrderItem).where(ERPSalesOrderItem.order_id == order.id)
        )
        items = items_result.scalars().all()
        cust_result = await db.execute(
            select(ERPCustomer.name).where(ERPCustomer.id == order.customer_id)
        )
        customer_name = cust_result.scalar_one_or_none()
        product_names = await _resolve_product_names(db, list({i.product_id for i in items}))

        item_outs = [
            SalesOrderItemOut(
                id=str(i.id), product_id=str(i.product_id),
                product_name=product_names.get(i.product_id),
                quantity=i.quantity, unit_price=_to_f(i.unit_price),
                subtotal=_to_f(i.subtotal), notes=i.notes,
            )
            for i in items
        ]
        return _sales_order_to_out(order, item_outs, customer_name)


@router.post("/sales-orders/{order_id}/status")
async def update_sales_order_status(
    order_id: str, body: StatusUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPSalesOrder).where(
                ERPSalesOrder.id == order_id,
                ERPSalesOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Sales order not found")

        _validate_transition(order.status, body.new_status, _SALES_STATUS_FLOW)
        order.status = body.new_status

        # Auto-deduct stock on confirmation
        if body.new_status == "confirmed":
            settings = await _get_or_create_settings(db, user.tenant_id)
            if settings.auto_stock_deduct:
                items_result = await db.execute(
                    select(ERPSalesOrderItem).where(ERPSalesOrderItem.order_id == order.id)
                )
                items = items_result.scalars().all()
                for item in items:
                    prod_result = await db.execute(
                        select(ERPProduct).where(ERPProduct.id == item.product_id)
                    )
                    product = prod_result.scalar_one_or_none()
                    if product:
                        if product.stock_qty < item.quantity:
                            raise HTTPException(
                                400,
                                f"Insufficient stock for '{product.name}': "
                                f"available {product.stock_qty}, required {item.quantity}",
                            )
                        product.stock_qty -= item.quantity
                        db.add(ERPStockRecord(
                            tenant_id=user.tenant_id,
                            product_id=product.id,
                            record_source="product",
                            warehouse_id=uuid.UUID(int=0),
                            related_order_id=order.id,
                            record_type="out",
                            quantity=item.quantity,
                            reason=f"Sales order {order.order_no} confirmed",
                        ))

        await db.commit()
        await db.refresh(order)
        cust_result = await db.execute(
            select(ERPCustomer.name).where(ERPCustomer.id == order.customer_id)
        )
        customer_name = cust_result.scalar_one_or_none()
        return _sales_order_to_out(order, [], customer_name)


@router.delete("/sales-orders/{order_id}")
async def delete_sales_order(order_id: str, user=Depends(get_current_user)):
    """Only draft orders can be deleted."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPSalesOrder).where(
                ERPSalesOrder.id == order_id,
                ERPSalesOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Sales order not found")
        if order.status != "draft":
            raise HTTPException(400, "Only draft orders can be deleted")
        items_result = await db.execute(
            select(ERPSalesOrderItem).where(ERPSalesOrderItem.order_id == order.id)
        )
        for item in items_result.scalars().all():
            await db.delete(item)
        await db.delete(order)
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  PURCHASE ORDERS
# ═══════════════════════════════════════════════════════════════════════════════


def _purchase_order_to_out(order, items, supplier_name):
    return PurchaseOrderOut(
        id=str(order.id),
        order_no=order.order_no,
        supplier_id=str(order.supplier_id),
        supplier_name=supplier_name,
        status=order.status,
        total_amount=_to_f(order.total_amount),
        discount=_to_f(order.discount),
        tax_amount=_to_f(order.tax_amount),
        net_amount=_to_f(order.net_amount),
        order_date=order.order_date.isoformat() if order.order_date else "",
        due_date=order.due_date.isoformat() if order.due_date else None,
        notes=order.notes,
        items=items,
        created_at=order.created_at.isoformat() if order.created_at else None,
        updated_at=order.updated_at.isoformat() if order.updated_at else None,
    )


@router.get("/purchase-orders", response_model=list[PurchaseOrderOut])
async def list_purchase_orders(
    status: str | None = None,
    supplier_id: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPPurchaseOrder).where(
            ERPPurchaseOrder.tenant_id == user.tenant_id
        )
        if status:
            q = q.where(ERPPurchaseOrder.status == status)
        if supplier_id:
            q = q.where(ERPPurchaseOrder.supplier_id == supplier_id)
        result = await db.execute(q.order_by(ERPPurchaseOrder.created_at.desc()))
        orders = result.scalars().all()

        supplier_ids = list({o.supplier_id for o in orders})
        supplier_names: dict[uuid.UUID, str] = {}
        if supplier_ids:
            s_result = await db.execute(
                select(ERPSupplier.id, ERPSupplier.name).where(
                    ERPSupplier.id.in_(supplier_ids)
                )
            )
            supplier_names = {row.id: row.name for row in s_result.fetchall()}

        return [
            _purchase_order_to_out(o, [], supplier_names.get(o.supplier_id))
            for o in orders
        ]


@router.post("/purchase-orders", response_model=PurchaseOrderOut)
async def create_purchase_order(body: PurchaseOrderCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        # Validate supplier
        sup_result = await db.execute(
            select(ERPSupplier).where(
                ERPSupplier.id == body.supplier_id,
                ERPSupplier.tenant_id == user.tenant_id,
            )
        )
        supplier = sup_result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(400, "Supplier not found")
        supplier_name = supplier.name

        today = date.today()
        order_no = await _generate_order_no(db, ERPPurchaseOrder, "PO", today)

        total_amount = 0.0
        order_items: list[ERPPurchaseOrderItem] = []
        for item in body.items:
            price = item.unit_price
            if price is None:
                # 物料默认价格：从 erp_materials.cost_price 获取
                p_result = await db.execute(
                    select(ERPMaterial.cost_price).where(ERPMaterial.id == item.material_id)
                )
                p_row = p_result.first()
                price = float(p_row[0]) if p_row and p_row[0] is not None else 0.0
            subtotal = item.quantity * price
            total_amount += subtotal
            order_items.append(
                ERPPurchaseOrderItem(
                    material_id=item.material_id,
                    quantity=item.quantity,
                    unit_price=price,
                    subtotal=subtotal,
                    notes=item.notes,
                )
            )

        net_amount = total_amount - body.discount + body.tax_amount

        order = ERPPurchaseOrder(
            tenant_id=user.tenant_id,
            order_no=order_no,
            supplier_id=body.supplier_id,
            order_date=date.fromisoformat(body.order_date),
            due_date=date.fromisoformat(body.due_date) if body.due_date else None,
            status="draft",
            total_amount=total_amount,
            discount=body.discount,
            tax_amount=body.tax_amount,
            net_amount=net_amount,
            notes=body.notes,
        )
        db.add(order)
        await db.flush()
        for oi in order_items:
            oi.order_id = order.id
            db.add(oi)
        await db.commit()
        await db.refresh(order)

        item_outs = [
            PurchaseOrderItemOut(
                id=str(oi.id), material_id=str(oi.material_id),
                quantity=oi.quantity, unit_price=_to_f(oi.unit_price),
                subtotal=_to_f(oi.subtotal), notes=oi.notes,
            )
            for oi in order_items
        ]
        return _purchase_order_to_out(order, item_outs, supplier_name)


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderOut)
async def get_purchase_order(order_id: str, user=Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            select(ERPPurchaseOrder).where(
                ERPPurchaseOrder.id == order_id,
                ERPPurchaseOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Purchase order not found")

        sup_result = await db.execute(
            select(ERPSupplier.name).where(ERPSupplier.id == order.supplier_id)
        )
        supplier_name = sup_result.scalar_one_or_none()

        items_result = await db.execute(
            select(ERPPurchaseOrderItem).where(ERPPurchaseOrderItem.order_id == order.id)
        )
        items = items_result.scalars().all()
        material_names = await _resolve_material_names(db, list({i.material_id for i in items}))

        item_outs = [
            PurchaseOrderItemOut(
                id=str(i.id), material_id=str(i.material_id),
                material_name=material_names.get(i.material_id),
                quantity=i.quantity, unit_price=_to_f(i.unit_price),
                subtotal=_to_f(i.subtotal), notes=i.notes,
            )
            for i in items
        ]
        return _purchase_order_to_out(order, item_outs, supplier_name)


@router.patch("/purchase-orders/{order_id}", response_model=PurchaseOrderOut)
async def update_purchase_order(
    order_id: str, body: PurchaseOrderUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPPurchaseOrder).where(
                ERPPurchaseOrder.id == order_id,
                ERPPurchaseOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Purchase order not found")

        update_data = body.model_dump(exclude_unset=True)
        items_data = update_data.pop("items", None)

        if "supplier_id" in update_data:
            order.supplier_id = update_data["supplier_id"]
        if "due_date" in update_data:
            order.due_date = date.fromisoformat(update_data["due_date"]) if update_data["due_date"] else None
        if "discount" in update_data:
            order.discount = update_data["discount"]
        if "tax_amount" in update_data:
            order.tax_amount = update_data["tax_amount"]
        if "notes" in update_data:
            order.notes = update_data["notes"]

        if items_data is not None:
            old_items = await db.execute(
                select(ERPPurchaseOrderItem).where(ERPPurchaseOrderItem.order_id == order.id)
            )
            for old in old_items.scalars().all():
                await db.delete(old)

            total_amount = 0.0
            for item in items_data:
                price = item.unit_price
                if price is None:
                    # 物料默认价格：从 erp_materials.cost_price 获取
                    p_result = await db.execute(
                        select(ERPMaterial.cost_price).where(ERPMaterial.id == item.material_id)
                    )
                    p_row = p_result.first()
                    price = float(p_row[0]) if p_row and p_row[0] is not None else 0.0
                subtotal = item.quantity * price
                total_amount += subtotal
                db.add(ERPPurchaseOrderItem(
                    order_id=order.id,
                    material_id=item.material_id,
                    quantity=item.quantity,
                    unit_price=price,
                    subtotal=subtotal,
                    notes=item.notes,
                ))
            order.total_amount = total_amount
            order.net_amount = total_amount - float(order.discount) + float(order.tax_amount)
        elif "discount" in update_data or "tax_amount" in update_data:
            order.net_amount = float(order.total_amount or 0) - float(order.discount) + float(order.tax_amount)

        await db.commit()
        await db.refresh(order)

        items_result = await db.execute(
            select(ERPPurchaseOrderItem).where(ERPPurchaseOrderItem.order_id == order.id)
        )
        items = items_result.scalars().all()
        sup_result = await db.execute(
            select(ERPSupplier.name).where(ERPSupplier.id == order.supplier_id)
        )
        supplier_name = sup_result.scalar_one_or_none()
        material_names = await _resolve_material_names(db, list({i.material_id for i in items}))

        item_outs = [
            PurchaseOrderItemOut(
                id=str(i.id), material_id=str(i.material_id),
                material_name=material_names.get(i.material_id),
                quantity=i.quantity, unit_price=_to_f(i.unit_price),
                subtotal=_to_f(i.subtotal), notes=i.notes,
            )
            for i in items
        ]
        return _purchase_order_to_out(order, item_outs, supplier_name)


@router.post("/purchase-orders/{order_id}/status")
async def update_purchase_order_status(
    order_id: str, body: StatusUpdate, user=Depends(get_current_user)
):
    async with async_session() as db:
        result = await db.execute(
            select(ERPPurchaseOrder).where(
                ERPPurchaseOrder.id == order_id,
                ERPPurchaseOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Purchase order not found")

        _validate_transition(order.status, body.new_status, _PURCHASE_STATUS_FLOW)
        order.status = body.new_status

        # Auto-add stock on confirmation
        if body.new_status == "confirmed":
            settings = await _get_or_create_settings(db, user.tenant_id)
            if settings.auto_stock_deduct:
                items_result = await db.execute(
                    select(ERPPurchaseOrderItem).where(ERPPurchaseOrderItem.order_id == order.id)
                )
                items = items_result.scalars().all()
                for item in items:
                    mat_result = await db.execute(
                        select(ERPMaterial).where(ERPMaterial.id == item.material_id)
                    )
                    material = mat_result.scalar_one_or_none()
                    if material:
                        material.stock_qty += item.quantity
                        db.add(ERPStockRecord(
                            tenant_id=user.tenant_id,
                            material_id=material.id,
                            record_source="material",
                            warehouse_id=uuid.UUID(int=0),
                            related_order_id=order.id,
                            record_type="in",
                            quantity=item.quantity,
                            reason=f"Purchase order {order.order_no} confirmed",
                        ))

        await db.commit()
        await db.refresh(order)
        sup_result = await db.execute(
            select(ERPSupplier.name).where(ERPSupplier.id == order.supplier_id)
        )
        supplier_name = sup_result.scalar_one_or_none()
        return _purchase_order_to_out(order, [], supplier_name)


@router.delete("/purchase-orders/{order_id}")
async def delete_purchase_order(order_id: str, user=Depends(get_current_user)):
    """Only draft orders can be deleted."""
    async with async_session() as db:
        result = await db.execute(
            select(ERPPurchaseOrder).where(
                ERPPurchaseOrder.id == order_id,
                ERPPurchaseOrder.tenant_id == user.tenant_id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(404, "Purchase order not found")
        if order.status != "draft":
            raise HTTPException(400, "Only draft orders can be deleted")
        items_result = await db.execute(
            select(ERPPurchaseOrderItem).where(ERPPurchaseOrderItem.order_id == order.id)
        )
        for item in items_result.scalars().all():
            await db.delete(item)
        await db.delete(order)
        await db.commit()
        return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  STOCK
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/stock")
async def list_stock(
    warehouse_id: str | None = None,
    product_id: str | None = None,
    material_id: str | None = None,
    record_source: str | None = None,
    user=Depends(get_current_user),
):
    """Return current stock levels. record_source='product'|'material' 筛选来源。"""
    async with async_session() as db:
        # 产品库存
        if record_source != "material":
            prod_q = select(ERPProduct).where(
                ERPProduct.tenant_id == user.tenant_id,
                ERPProduct.status != "inactive",
            )
            if product_id:
                prod_q = prod_q.where(ERPProduct.id == product_id)
            prod_result = await db.execute(prod_q.order_by(ERPProduct.name))
            products = prod_result.scalars().all()
        else:
            products = []

        # 物料库存
        if record_source != "product":
            mat_q = select(ERPMaterial).where(
                ERPMaterial.tenant_id == user.tenant_id,
                ERPMaterial.status != "inactive",
            )
            if material_id:
                mat_q = mat_q.where(ERPMaterial.id == material_id)
            mat_result = await db.execute(mat_q.order_by(ERPMaterial.name))
            materials = mat_result.scalars().all()
        else:
            materials = []

        result = []
        for p in products:
            result.append({
                "record_source": "product",
                "product_id": str(p.id),
                "name": p.name,
                "sku": p.sku,
                "stock_qty": p.stock_qty,
                "min_stock": p.min_stock,
                "unit": p.unit,
            })
        for m in materials:
            result.append({
                "record_source": "material",
                "material_id": str(m.id),
                "name": m.name,
                "sku": m.sku,
                "stock_qty": m.stock_qty,
                "min_stock": m.min_stock,
                "unit": m.unit,
            })
        return result


def _stock_record_to_out(r):
    return StockRecordOut(
        id=str(r.id),
        record_source=r.record_source,
        product_id=_to_str(r.product_id),
        material_id=_to_str(r.material_id),
        warehouse_id=str(r.warehouse_id),
        record_type=r.record_type,
        quantity=r.quantity,
        related_order_id=_to_str(r.related_order_id),
        reason=r.reason,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


@router.post("/stock/inbound", response_model=StockRecordOut)
async def stock_inbound(body: StockOperation, user=Depends(get_current_user)):
    async with async_session() as db:
        if body.record_source == "material":
            # 物料入库
            if not body.material_id:
                raise HTTPException(400, "material_id is required for material stock")
            mat_result = await db.execute(
                select(ERPMaterial).where(
                    ERPMaterial.id == body.material_id,
                    ERPMaterial.tenant_id == user.tenant_id,
                )
            )
            material = mat_result.scalar_one_or_none()
            if not material:
                raise HTTPException(404, "Material not found")
            material.stock_qty += body.quantity
            record = ERPStockRecord(
                tenant_id=user.tenant_id,
                material_id=material.id,
                record_source="material",
                warehouse_id=body.warehouse_id,
                record_type="in",
                quantity=body.quantity,
                reason=body.reason,
            )
        else:
            # 产品入库
            if not body.product_id:
                raise HTTPException(400, "product_id is required for product stock")
            prod_result = await db.execute(
                select(ERPProduct).where(
                    ERPProduct.id == body.product_id,
                    ERPProduct.tenant_id == user.tenant_id,
                )
            )
            product = prod_result.scalar_one_or_none()
            if not product:
                raise HTTPException(404, "Product not found")
            product.stock_qty += body.quantity
            record = ERPStockRecord(
                tenant_id=user.tenant_id,
                product_id=product.id,
                record_source="product",
                warehouse_id=body.warehouse_id,
                record_type="in",
                quantity=body.quantity,
                reason=body.reason,
            )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return _stock_record_to_out(record)


@router.post("/stock/outbound", response_model=StockRecordOut)
async def stock_outbound(body: StockOperation, user=Depends(get_current_user)):
    async with async_session() as db:
        if body.record_source == "material":
            # 物料出库
            if not body.material_id:
                raise HTTPException(400, "material_id is required for material stock")
            mat_result = await db.execute(
                select(ERPMaterial).where(
                    ERPMaterial.id == body.material_id,
                    ERPMaterial.tenant_id == user.tenant_id,
                )
            )
            material = mat_result.scalar_one_or_none()
            if not material:
                raise HTTPException(404, "Material not found")
            if material.stock_qty < body.quantity:
                raise HTTPException(
                    400,
                    f"Insufficient stock: available {material.stock_qty}, requested {body.quantity}",
                )
            material.stock_qty -= body.quantity
            record = ERPStockRecord(
                tenant_id=user.tenant_id,
                material_id=material.id,
                record_source="material",
                warehouse_id=body.warehouse_id,
                record_type="out",
                quantity=body.quantity,
                reason=body.reason,
            )
        else:
            # 产品出库
            if not body.product_id:
                raise HTTPException(400, "product_id is required for product stock")
            prod_result = await db.execute(
                select(ERPProduct).where(
                    ERPProduct.id == body.product_id,
                    ERPProduct.tenant_id == user.tenant_id,
                )
            )
            product = prod_result.scalar_one_or_none()
            if not product:
                raise HTTPException(404, "Product not found")
            if product.stock_qty < body.quantity:
                raise HTTPException(
                    400,
                    f"Insufficient stock: available {product.stock_qty}, requested {body.quantity}",
                )
            product.stock_qty -= body.quantity
            record = ERPStockRecord(
                tenant_id=user.tenant_id,
                product_id=product.id,
                record_source="product",
                warehouse_id=body.warehouse_id,
                record_type="out",
                quantity=body.quantity,
                reason=body.reason,
            )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return _stock_record_to_out(record)


@router.post("/stock/transfer")
async def stock_transfer(body: StockTransfer, user=Depends(get_current_user)):
    async with async_session() as db:
        if body.record_source == "material":
            # 物料转移
            if not body.material_id:
                raise HTTPException(400, "material_id is required for material stock")
            mat_result = await db.execute(
                select(ERPMaterial).where(
                    ERPMaterial.id == body.material_id,
                    ERPMaterial.tenant_id == user.tenant_id,
                )
            )
            material = mat_result.scalar_one_or_none()
            if not material:
                raise HTTPException(404, "Material not found")
            if material.stock_qty < body.quantity:
                raise HTTPException(
                    400,
                    f"Insufficient stock: available {material.stock_qty}, requested {body.quantity}",
                )
            material.stock_qty -= body.quantity
            out_record = ERPStockRecord(
                tenant_id=user.tenant_id,
                material_id=material.id,
                record_source="material",
                warehouse_id=body.from_warehouse_id,
                record_type="out",
                quantity=body.quantity,
                reason=f"Transfer to warehouse {body.to_warehouse_id}",
            )
            db.add(out_record)
            material.stock_qty += body.quantity
            in_record = ERPStockRecord(
                tenant_id=user.tenant_id,
                material_id=material.id,
                record_source="material",
                warehouse_id=body.to_warehouse_id,
                record_type="in",
                quantity=body.quantity,
                reason=f"Transfer from warehouse {body.from_warehouse_id}",
            )
            db.add(in_record)
        else:
            # 产品转移
            if not body.product_id:
                raise HTTPException(400, "product_id is required for product stock")
            prod_result = await db.execute(
                select(ERPProduct).where(
                    ERPProduct.id == body.product_id,
                    ERPProduct.tenant_id == user.tenant_id,
                )
            )
            product = prod_result.scalar_one_or_none()
            if not product:
                raise HTTPException(404, "Product not found")
            if product.stock_qty < body.quantity:
                raise HTTPException(
                    400,
                    f"Insufficient stock: available {product.stock_qty}, requested {body.quantity}",
                )
            product.stock_qty -= body.quantity
            out_record = ERPStockRecord(
                tenant_id=user.tenant_id,
                product_id=product.id,
                record_source="product",
                warehouse_id=body.from_warehouse_id,
                record_type="out",
                quantity=body.quantity,
                reason=f"Transfer to warehouse {body.to_warehouse_id}",
            )
            db.add(out_record)
            product.stock_qty += body.quantity
            in_record = ERPStockRecord(
                tenant_id=user.tenant_id,
                product_id=product.id,
                record_source="product",
                warehouse_id=body.to_warehouse_id,
                record_type="in",
                quantity=body.quantity,
                reason=f"Transfer from warehouse {body.from_warehouse_id}",
            )
            db.add(in_record)

        await db.commit()
        return {
            "status": "ok",
            "outbound_record_id": str(out_record.id),
            "inbound_record_id": str(in_record.id),
        }


@router.get("/stock/alerts")
async def stock_alerts(user=Depends(get_current_user)):
    """Products and materials where stock_qty < min_stock."""
    async with async_session() as db:
        # 产品库存预警
        prod_result = await db.execute(
            select(ERPProduct).where(
                ERPProduct.tenant_id == user.tenant_id,
                ERPProduct.status == "active",
                ERPProduct.stock_qty < ERPProduct.min_stock,
                ERPProduct.min_stock > 0,
            ).order_by(ERPProduct.name)
        )
        products = prod_result.scalars().all()

        # 物料库存预警
        mat_result = await db.execute(
            select(ERPMaterial).where(
                ERPMaterial.tenant_id == user.tenant_id,
                ERPMaterial.status == "active",
                ERPMaterial.stock_qty < ERPMaterial.min_stock,
                ERPMaterial.min_stock > 0,
            ).order_by(ERPMaterial.name)
        )
        materials = mat_result.scalars().all()

        alerts = []
        for p in products:
            alerts.append({
                "record_source": "product",
                "product_id": str(p.id),
                "name": p.name,
                "sku": p.sku,
                "stock_qty": p.stock_qty,
                "min_stock": p.min_stock,
            })
        for m in materials:
            alerts.append({
                "record_source": "material",
                "material_id": str(m.id),
                "name": m.name,
                "sku": m.sku,
                "stock_qty": m.stock_qty,
                "min_stock": m.min_stock,
            })
        return alerts


@router.get("/stock/records", response_model=list[StockRecordOut])
async def list_stock_records(
    product_id: str | None = None,
    material_id: str | None = None,
    record_source: str | None = None,
    warehouse_id: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPStockRecord).where(ERPStockRecord.tenant_id == user.tenant_id)
        if product_id:
            q = q.where(ERPStockRecord.product_id == product_id)
        if material_id:
            q = q.where(ERPStockRecord.material_id == material_id)
        if record_source:
            q = q.where(ERPStockRecord.record_source == record_source)
        if warehouse_id:
            q = q.where(ERPStockRecord.warehouse_id == warehouse_id)
        result = await db.execute(q.order_by(ERPStockRecord.created_at.desc()))
        return [_stock_record_to_out(r) for r in result.scalars().all()]


# ═══════════════════════════════════════════════════════════════════════════════
#  FINANCIALS
# ═══════════════════════════════════════════════════════════════════════════════


def _financial_to_out(r):
    return FinancialRecordOut(
        id=str(r.id),
        record_type=r.record_type,
        category=r.category,
        amount=_to_f(r.amount),
        related_order_id=_to_str(r.related_order_id),
        customer_id=_to_str(getattr(r, "customer_id", None)),
        supplier_id=_to_str(getattr(r, "supplier_id", None)),
        description=r.description,
        record_date=r.record_date.isoformat() if r.record_date else "",
        payment_method=r.payment_method,
        status=r.status,
        created_at=r.created_at.isoformat() if r.created_at else None,
        updated_at=r.updated_at.isoformat() if r.updated_at else None,
    )


@router.get("/financials", response_model=list[FinancialRecordOut])
async def list_financials(
    record_type: str | None = None,
    status: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        q = select(ERPFinancialRecord).where(ERPFinancialRecord.tenant_id == user.tenant_id)
        if record_type:
            q = q.where(ERPFinancialRecord.record_type == record_type)
        if status:
            q = q.where(ERPFinancialRecord.status == status)
        result = await db.execute(q.order_by(ERPFinancialRecord.record_date.desc()))
        return [_financial_to_out(r) for r in result.scalars().all()]


@router.post("/financials", response_model=FinancialRecordOut)
async def create_financial(body: FinancialCreate, user=Depends(get_current_user)):
    async with async_session() as db:
        record = ERPFinancialRecord(
            tenant_id=user.tenant_id,
            record_type=body.record_type,
            amount=body.amount,
            category=body.category,
            description=body.description,
            related_order_id=body.related_order_id if body.related_order_id else None,
            customer_id=body.customer_id if body.customer_id else None,
            supplier_id=body.supplier_id if body.supplier_id else None,
            record_date=date.fromisoformat(body.record_date),
            payment_method=body.payment_method,
            status=body.status,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return _financial_to_out(record)


@router.get("/financials/summary", response_model=FinancialSummary)
async def financial_summary(
    start_date: str | None = None,
    end_date: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        conditions = [ERPFinancialRecord.tenant_id == user.tenant_id]
        if start_date:
            conditions.append(ERPFinancialRecord.record_date >= date.fromisoformat(start_date))
        if end_date:
            conditions.append(ERPFinancialRecord.record_date <= date.fromisoformat(end_date))

        inc_result = await db.execute(
            select(func.coalesce(func.sum(ERPFinancialRecord.amount), 0)).where(
                *conditions, ERPFinancialRecord.record_type == "income"
            )
        )
        total_income = float(inc_result.scalar() or 0)

        exp_result = await db.execute(
            select(func.coalesce(func.sum(ERPFinancialRecord.amount), 0)).where(
                *conditions, ERPFinancialRecord.record_type == "expense"
            )
        )
        total_expense = float(exp_result.scalar() or 0)

        recv_result = await db.execute(
            select(func.coalesce(func.sum(ERPSalesOrder.net_amount), 0)).where(
                ERPSalesOrder.tenant_id == user.tenant_id,
                ERPSalesOrder.status.in_(["confirmed", "processing", "shipped"]),
            )
        )
        receivable = float(recv_result.scalar() or 0)

        pay_result = await db.execute(
            select(func.coalesce(func.sum(ERPPurchaseOrder.net_amount), 0)).where(
                ERPPurchaseOrder.tenant_id == user.tenant_id,
                ERPPurchaseOrder.status.in_(["confirmed", "receiving"]),
            )
        )
        payable = float(pay_result.scalar() or 0)

        return FinancialSummary(
            total_income=total_income,
            total_expense=total_expense,
            receivable=receivable,
            payable=payable,
            profit=total_income - total_expense,
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  REPORTS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/reports/sales", response_model=list[SalesReportItem])
async def sales_report(
    period: str = "month",
    start_date: str | None = None,
    end_date: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        period_col = func.to_char(ERPSalesOrder.order_date, "YYYY-MM").label("period_label")
        if period == "quarter":
            period_col = func.concat(
                func.extract("year", ERPSalesOrder.order_date),
                "-Q",
                func.ceil(func.extract("month", ERPSalesOrder.order_date) / 3.0),
            ).label("period_label")
        elif period == "year":
            period_col = func.cast(func.extract("year", ERPSalesOrder.order_date), String).label("period_label")

        q = (
            select(
                period_col,
                func.count(ERPSalesOrder.id).label("cnt"),
                func.coalesce(func.sum(ERPSalesOrder.net_amount), 0).label("total"),
            )
            .where(
                ERPSalesOrder.tenant_id == user.tenant_id,
                ERPSalesOrder.status.notin_(["draft", "cancelled"]),
            )
            .group_by(period_col)
            .order_by(period_col)
        )
        if start_date:
            q = q.where(ERPSalesOrder.order_date >= date.fromisoformat(start_date))
        if end_date:
            q = q.where(ERPSalesOrder.order_date <= date.fromisoformat(end_date))

        result = await db.execute(q)
        return [
            SalesReportItem(
                period_label=str(row.period_label),
                order_count=row.cnt,
                total_amount=float(row.total),
            )
            for row in result.fetchall()
        ]


@router.get("/reports/purchase", response_model=list[SalesReportItem])
async def purchase_report(
    period: str = "month",
    start_date: str | None = None,
    end_date: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        period_col = func.to_char(ERPPurchaseOrder.order_date, "YYYY-MM").label("period_label")
        if period == "quarter":
            period_col = func.concat(
                func.extract("year", ERPPurchaseOrder.order_date),
                "-Q",
                func.ceil(func.extract("month", ERPPurchaseOrder.order_date) / 3.0),
            ).label("period_label")
        elif period == "year":
            period_col = func.cast(func.extract("year", ERPPurchaseOrder.order_date), String).label("period_label")

        q = (
            select(
                period_col,
                func.count(ERPPurchaseOrder.id).label("cnt"),
                func.coalesce(func.sum(ERPPurchaseOrder.net_amount), 0).label("total"),
            )
            .where(
                ERPPurchaseOrder.tenant_id == user.tenant_id,
                ERPPurchaseOrder.status.notin_(["draft", "cancelled"]),
            )
            .group_by(period_col)
            .order_by(period_col)
        )
        if start_date:
            q = q.where(ERPPurchaseOrder.order_date >= date.fromisoformat(start_date))
        if end_date:
            q = q.where(ERPPurchaseOrder.order_date <= date.fromisoformat(end_date))

        result = await db.execute(q)
        return [
            SalesReportItem(
                period_label=str(row.period_label),
                order_count=row.cnt,
                total_amount=float(row.total),
            )
            for row in result.fetchall()
        ]


@router.get("/reports/inventory", response_model=list[InventoryReportItem])
async def inventory_report(user=Depends(get_current_user)):
    """库存报表：物料成本库存（因为成本价属于物料）。"""
    async with async_session() as db:
        result = await db.execute(
            select(ERPMaterial).where(
                ERPMaterial.tenant_id == user.tenant_id,
                ERPMaterial.status == "active",
            ).order_by(ERPMaterial.name)
        )
        materials = result.scalars().all()
        return [
            InventoryReportItem(
                product_id=str(m.id),
                product_name=m.name,
                sku=m.sku,
                stock_qty=m.stock_qty,
                cost_price=_to_f(m.cost_price),
                stock_value=m.stock_qty * _to_f(m.cost_price),
            )
            for m in materials
        ]


@router.get("/reports/customers", response_model=list[CustomerReportItem])
async def customer_report(user=Depends(get_current_user)):
    """Customer contribution ranking: aggregated sales amount, descending."""
    async with async_session() as db:
        q = (
            select(
                ERPSalesOrder.customer_id,
                func.count(ERPSalesOrder.id).label("cnt"),
                func.coalesce(func.sum(ERPSalesOrder.net_amount), 0).label("total"),
            )
            .where(
                ERPSalesOrder.tenant_id == user.tenant_id,
                ERPSalesOrder.status.notin_(["draft", "cancelled"]),
            )
            .group_by(ERPSalesOrder.customer_id)
            .order_by(func.sum(ERPSalesOrder.net_amount).desc())
        )
        result = await db.execute(q)
        rows = result.fetchall()

        customer_ids = [row.customer_id for row in rows]
        customer_names: dict[uuid.UUID, str] = {}
        if customer_ids:
            c_result = await db.execute(
                select(ERPCustomer.id, ERPCustomer.name).where(ERPCustomer.id.in_(customer_ids))
            )
            customer_names = {r.id: r.name for r in c_result.fetchall()}

        return [
            CustomerReportItem(
                customer_id=str(row.customer_id),
                customer_name=customer_names.get(row.customer_id, ""),
                total_amount=float(row.total),
                order_count=row.cnt,
            )
            for row in rows
        ]


@router.get("/reports/profit-loss")
async def profit_loss_report(
    start_date: str | None = None,
    end_date: str | None = None,
    user=Depends(get_current_user),
):
    async with async_session() as db:
        conditions = [ERPFinancialRecord.tenant_id == user.tenant_id]
        if start_date:
            conditions.append(ERPFinancialRecord.record_date >= date.fromisoformat(start_date))
        if end_date:
            conditions.append(ERPFinancialRecord.record_date <= date.fromisoformat(end_date))

        inc_result = await db.execute(
            select(func.coalesce(func.sum(ERPFinancialRecord.amount), 0)).where(
                *conditions, ERPFinancialRecord.record_type == "income"
            )
        )
        total_income = float(inc_result.scalar() or 0)

        exp_result = await db.execute(
            select(func.coalesce(func.sum(ERPFinancialRecord.amount), 0)).where(
                *conditions, ERPFinancialRecord.record_type == "expense"
            )
        )
        total_expense = float(exp_result.scalar() or 0)

        return {
            "total_income": total_income,
            "total_expense": total_expense,
            "profit": total_income - total_expense,
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  SETTINGS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/settings", response_model=ERPSettingsOut)
async def get_erp_settings(user=Depends(get_current_user)):
    async with async_session() as db:
        settings = await _get_or_create_settings(db, user.tenant_id)
        await db.commit()
        return ERPSettingsOut(
            id=str(settings.id),
            company_name=settings.company_name,
            currency=settings.currency,
            fiscal_year_start=settings.fiscal_year_start,
            auto_stock_deduct=settings.auto_stock_deduct,
            default_payment_terms=settings.default_payment_terms,
        )


@router.put("/settings", response_model=ERPSettingsOut)
async def update_erp_settings(body: ERPSettingsUpdate, user=Depends(get_current_user)):
    async with async_session() as db:
        settings = await _get_or_create_settings(db, user.tenant_id)
        if body.company_name is not None:
            settings.company_name = body.company_name
        if body.currency is not None:
            settings.currency = body.currency
        if body.fiscal_year_start is not None:
            settings.fiscal_year_start = body.fiscal_year_start
        if body.auto_stock_deduct is not None:
            settings.auto_stock_deduct = body.auto_stock_deduct
        if body.default_payment_terms is not None:
            settings.default_payment_terms = body.default_payment_terms
        await db.commit()
        await db.refresh(settings)
        return ERPSettingsOut(
            id=str(settings.id),
            company_name=settings.company_name,
            currency=settings.currency,
            fiscal_year_start=settings.fiscal_year_start,
            auto_stock_deduct=settings.auto_stock_deduct,
            default_payment_terms=settings.default_payment_terms,
        )
