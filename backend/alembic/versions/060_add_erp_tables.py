"""add_erp_tables

Revision ID: add_erp_tables
Revises: add_title_to_agent_focus_items
Create Date: 2026-07-13 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_erp_tables'
down_revision: Union[str, None] = 'add_title_to_agent_focus_items'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- erp_customers ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_customers (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            contact_name VARCHAR(100),
            phone VARCHAR(50),
            email VARCHAR(200),
            address TEXT,
            tax_id VARCHAR(50),
            notes TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_customers ADD CONSTRAINT fk_erp_customers_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_customers_tenant_id ON erp_customers(tenant_id)")

    # --- erp_suppliers ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_suppliers (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            contact_name VARCHAR(100),
            phone VARCHAR(50),
            email VARCHAR(200),
            address TEXT,
            tax_id VARCHAR(50),
            payment_terms VARCHAR(100),
            notes TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_suppliers ADD CONSTRAINT fk_erp_suppliers_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_suppliers_tenant_id ON erp_suppliers(tenant_id)")

    # --- erp_products ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_products (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            sku VARCHAR(100),
            category VARCHAR(100),
            unit VARCHAR(20),
            unit_price NUMERIC(14, 2),
            cost_price NUMERIC(14, 2),
            min_stock INTEGER DEFAULT 0,
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_products ADD CONSTRAINT fk_erp_products_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_products_tenant_id ON erp_products(tenant_id)")

    # --- erp_warehouses ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_warehouses (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(50),
            address TEXT,
            description TEXT,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_warehouses ADD CONSTRAINT fk_erp_warehouses_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_warehouses_tenant_id ON erp_warehouses(tenant_id)")

    # --- erp_sales_orders ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_sales_orders (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            order_no VARCHAR(50),
            customer_id UUID NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            total_amount NUMERIC(14, 2),
            discount NUMERIC(14, 2) DEFAULT 0,
            tax_amount NUMERIC(14, 2) DEFAULT 0,
            net_amount NUMERIC(14, 2),
            order_date DATE NOT NULL,
            due_date DATE,
            notes TEXT,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_sales_orders ADD CONSTRAINT fk_erp_sales_orders_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE erp_sales_orders ADD CONSTRAINT fk_erp_sales_orders_customer_id_erp_customers FOREIGN KEY (customer_id) REFERENCES erp_customers(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_sales_orders_tenant_id ON erp_sales_orders(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_sales_orders_customer_id ON erp_sales_orders(customer_id)")

    # --- erp_sales_order_items ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_sales_order_items (
            id UUID NOT NULL PRIMARY KEY,
            order_id UUID NOT NULL,
            product_id UUID NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price NUMERIC(14, 2),
            subtotal NUMERIC(14, 2),
            notes TEXT
        )
    """)
    op.execute("ALTER TABLE erp_sales_order_items ADD CONSTRAINT fk_erp_sales_order_items_order_id_erp_sales_orders FOREIGN KEY (order_id) REFERENCES erp_sales_orders(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE erp_sales_order_items ADD CONSTRAINT fk_erp_sales_order_items_product_id_erp_products FOREIGN KEY (product_id) REFERENCES erp_products(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_sales_order_items_order_id ON erp_sales_order_items(order_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_sales_order_items_product_id ON erp_sales_order_items(product_id)")

    # --- erp_purchase_orders ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_purchase_orders (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            order_no VARCHAR(50),
            supplier_id UUID NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            total_amount NUMERIC(14, 2),
            discount NUMERIC(14, 2) DEFAULT 0,
            tax_amount NUMERIC(14, 2) DEFAULT 0,
            net_amount NUMERIC(14, 2),
            order_date DATE NOT NULL,
            due_date DATE,
            notes TEXT,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_purchase_orders ADD CONSTRAINT fk_erp_purchase_orders_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE erp_purchase_orders ADD CONSTRAINT fk_erp_purchase_orders_supplier_id_erp_suppliers FOREIGN KEY (supplier_id) REFERENCES erp_suppliers(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_purchase_orders_tenant_id ON erp_purchase_orders(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_purchase_orders_supplier_id ON erp_purchase_orders(supplier_id)")

    # --- erp_purchase_order_items ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_purchase_order_items (
            id UUID NOT NULL PRIMARY KEY,
            order_id UUID NOT NULL,
            product_id UUID NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price NUMERIC(14, 2),
            subtotal NUMERIC(14, 2),
            notes TEXT
        )
    """)
    op.execute("ALTER TABLE erp_purchase_order_items ADD CONSTRAINT fk_erp_purchase_order_items_order_id_erp_purchase_orders FOREIGN KEY (order_id) REFERENCES erp_purchase_orders(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE erp_purchase_order_items ADD CONSTRAINT fk_erp_purchase_order_items_product_id_erp_products FOREIGN KEY (product_id) REFERENCES erp_products(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_purchase_order_items_order_id ON erp_purchase_order_items(order_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_purchase_order_items_product_id ON erp_purchase_order_items(product_id)")

    # --- erp_stock_records ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_stock_records (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            product_id UUID NOT NULL,
            warehouse_id UUID NOT NULL,
            record_type VARCHAR(20) NOT NULL,
            quantity INTEGER NOT NULL,
            related_order_id UUID,
            reason VARCHAR(500),
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_stock_records ADD CONSTRAINT fk_erp_stock_records_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE erp_stock_records ADD CONSTRAINT fk_erp_stock_records_product_id_erp_products FOREIGN KEY (product_id) REFERENCES erp_products(id)")
    op.execute("ALTER TABLE erp_stock_records ADD CONSTRAINT fk_erp_stock_records_warehouse_id_erp_warehouses FOREIGN KEY (warehouse_id) REFERENCES erp_warehouses(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_stock_records_tenant_id ON erp_stock_records(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_stock_records_product_id ON erp_stock_records(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_stock_records_warehouse_id ON erp_stock_records(warehouse_id)")

    # --- erp_financial_records ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_financial_records (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            record_type VARCHAR(20) NOT NULL,
            category VARCHAR(100),
            amount NUMERIC(14, 2),
            related_order_id UUID,
            customer_id UUID,
            supplier_id UUID,
            description TEXT,
            record_date DATE NOT NULL,
            payment_method VARCHAR(30),
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_financial_records ADD CONSTRAINT fk_erp_financial_records_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_financial_records_tenant_id ON erp_financial_records(tenant_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS erp_financial_records")
    op.execute("DROP TABLE IF EXISTS erp_stock_records")
    op.execute("DROP TABLE IF EXISTS erp_purchase_order_items")
    op.execute("DROP TABLE IF EXISTS erp_purchase_orders")
    op.execute("DROP TABLE IF EXISTS erp_sales_order_items")
    op.execute("DROP TABLE IF EXISTS erp_sales_orders")
    op.execute("DROP TABLE IF EXISTS erp_warehouses")
    op.execute("DROP TABLE IF EXISTS erp_products")
    op.execute("DROP TABLE IF EXISTS erp_suppliers")
    op.execute("DROP TABLE IF EXISTS erp_customers")
