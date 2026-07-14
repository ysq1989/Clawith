/**
 * ERP Layout — Dedicated ERP sidebar + content area with company switcher dropdown.
 * Sidebar uses two-level grouped navigation with module visibility controlled by settings.
 */

import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../../stores';
import { fetchJson } from '../../services/api';
import {
    IconLayoutDashboard,
    IconFolder,
    IconCoin,
    IconShoppingCart,
    IconTool,
    IconPackages,
    IconChartBar,
    IconSettings,
    IconArrowLeft,
    IconBell,
    IconUserCircle,
    IconCheck,
    IconBuilding,
    IconChevronRight,
} from '@tabler/icons-react';

/* ─── Navigation data structures ─── */
interface NavItem {
    to: string;
    labelKey: string;
    labelDefault: string;
    end?: boolean;
}

interface NavGroup {
    key: string;
    labelKey: string;
    labelDefault: string;
    icon: React.ReactNode;
    children: NavItem[];
    moduleFlag?: string;
}

const NAV_GROUPS: NavGroup[] = [
    {
        key: 'base',
        labelKey: 'erp.nav.group.base',
        labelDefault: '基础数据',
        icon: <IconFolder size={18} stroke={1.5} />,
        children: [
            { to: '/erp/customers',   labelKey: 'erp.nav.customers',       labelDefault: '客户管理' },
            { to: '/erp/suppliers',   labelKey: 'erp.nav.suppliers',       labelDefault: '供应商' },
            { to: '/erp/products',    labelKey: 'erp.nav.products',        labelDefault: '产品管理' },
            { to: '/erp/materials',   labelKey: 'erp.nav.materials',       labelDefault: '物料管理' },
            { to: '/erp/warehouse',   labelKey: 'erp.nav.warehouse',       labelDefault: '仓库管理' },
            { to: '/erp/bom',         labelKey: 'erp.nav.bom',             labelDefault: 'BOM 管理' },
        ],
    },
    {
        key: 'sales',
        labelKey: 'erp.nav.group.sales',
        labelDefault: '销售',
        icon: <IconCoin size={18} stroke={1.5} />,
        children: [
            { to: '/erp/sales-orders', labelKey: 'erp.nav.salesOrders',    labelDefault: '销售订单' },
            { to: '/erp/payments',     labelKey: 'erp.nav.payments',       labelDefault: '销售回款' },
        ],
    },
    {
        key: 'purchase',
        labelKey: 'erp.nav.group.purchase',
        labelDefault: '采购',
        icon: <IconShoppingCart size={18} stroke={1.5} />,
        children: [
            { to: '/erp/purchase-orders', labelKey: 'erp.nav.purchaseOrders', labelDefault: '采购订单' },
            { to: '/erp/payments',        labelKey: 'erp.nav.purchasePayments', labelDefault: '采购付款' },
        ],
    },
    {
        key: 'production',
        labelKey: 'erp.nav.group.production',
        labelDefault: '生产',
        icon: <IconTool size={18} stroke={1.5} />,
        children: [
            { to: '/erp/production', labelKey: 'erp.nav.production', labelDefault: '生产工单' },
        ],
        moduleFlag: 'module_production',
    },
    {
        key: 'inventory',
        labelKey: 'erp.nav.group.inventory',
        labelDefault: '库存',
        icon: <IconPackages size={18} stroke={1.5} />,
        children: [
            { to: '/erp/outbound',  labelKey: 'erp.nav.outbound',  labelDefault: '出库管理' },
            { to: '/erp/inbound',   labelKey: 'erp.nav.inbound',   labelDefault: '入库管理' },
            { to: '/erp/inventory', labelKey: 'erp.nav.inventory', labelDefault: '库存总览' },
        ],
    },
    {
        key: 'finance',
        labelKey: 'erp.nav.group.finance',
        labelDefault: '财务',
        icon: <IconChartBar size={18} stroke={1.5} />,
        children: [
            { to: '/erp/finance', labelKey: 'erp.nav.finance', labelDefault: '财务记录' },
            { to: '/erp/reports', labelKey: 'erp.nav.reports', labelDefault: '数据报表' },
        ],
    },
    {
        key: 'settings',
        labelKey: 'erp.nav.group.settings',
        labelDefault: '系统设置',
        icon: <IconSettings size={18} stroke={1.5} />,
        children: [
            { to: '/erp/settings/customer-categories',    labelKey: 'erp.nav.settings.customerCategories',    labelDefault: '客户分类' },
            { to: '/erp/settings/supplier-categories',    labelKey: 'erp.nav.settings.supplierCategories',    labelDefault: '供应商分类' },
            { to: '/erp/settings/warehouse-categories',   labelKey: 'erp.nav.settings.warehouseCategories',   labelDefault: '仓库分类' },
            { to: '/erp/settings/outbound-categories',    labelKey: 'erp.nav.settings.outboundCategories',    labelDefault: '出库分类' },
            { to: '/erp/settings/inbound-categories',     labelKey: 'erp.nav.settings.inboundCategories',     labelDefault: '入库分类' },
            { to: '/erp/settings/production-statuses',    labelKey: 'erp.nav.settings.productionStatuses',    labelDefault: '生产状态' },
            { to: '/erp/settings/code-settings',          labelKey: 'erp.nav.settings.codeSettings',          labelDefault: '编码设置' },
            { to: '/erp/settings/module-config',          labelKey: 'erp.nav.settings.moduleConfig',          labelDefault: '模块配置' },
        ],
    },
];

/* ─── Route-to-title mapping for top bar ─── */
const ROUTE_TITLES: Record<string, { key: string; fallback: string }> = {
    '/erp':                         { key: 'erp.nav.dashboard',                   fallback: '首页概览' },
    '/erp/customers':               { key: 'erp.nav.customers',                   fallback: '客户管理' },
    '/erp/suppliers':               { key: 'erp.nav.suppliers',                   fallback: '供应商' },
    '/erp/products':                { key: 'erp.nav.products',                    fallback: '产品管理' },
    '/erp/materials':               { key: 'erp.nav.materials',                   fallback: '物料管理' },
    '/erp/warehouse':               { key: 'erp.nav.warehouse',                   fallback: '仓库管理' },
    '/erp/bom':                     { key: 'erp.nav.bom',                         fallback: 'BOM 管理' },
    '/erp/sales-orders':            { key: 'erp.nav.salesOrders',                 fallback: '销售订单' },
    '/erp/payments':                { key: 'erp.nav.payments',                    fallback: '收付款' },
    '/erp/purchase-orders':         { key: 'erp.nav.purchaseOrders',              fallback: '采购订单' },
    '/erp/production':              { key: 'erp.nav.production',                  fallback: '生产工单' },
    '/erp/outbound':                { key: 'erp.nav.outbound',                    fallback: '出库管理' },
    '/erp/inbound':                 { key: 'erp.nav.inbound',                     fallback: '入库管理' },
    '/erp/inventory':               { key: 'erp.nav.inventory',                   fallback: '库存总览' },
    '/erp/finance':                 { key: 'erp.nav.finance',                     fallback: '财务记录' },
    '/erp/reports':                 { key: 'erp.nav.reports',                     fallback: '数据报表' },
    '/erp/settings':                { key: 'erp.nav.settings',                    fallback: '系统设置' },
    '/erp/settings/customer-categories':  { key: 'erp.nav.settings.customerCategories',  fallback: '客户分类' },
    '/erp/settings/supplier-categories':  { key: 'erp.nav.settings.supplierCategories',  fallback: '供应商分类' },
    '/erp/settings/warehouse-categories': { key: 'erp.nav.settings.warehouseCategories', fallback: '仓库分类' },
    '/erp/settings/outbound-categories':  { key: 'erp.nav.settings.outboundCategories',  fallback: '出库分类' },
    '/erp/settings/inbound-categories':   { key: 'erp.nav.settings.inboundCategories',   fallback: '入库分类' },
    '/erp/settings/production-statuses':  { key: 'erp.nav.settings.productionStatuses',  fallback: '生产状态' },
    '/erp/settings/code-settings':        { key: 'erp.nav.settings.codeSettings',        fallback: '编码设置' },
    '/erp/settings/module-config':        { key: 'erp.nav.settings.moduleConfig',        fallback: '模块配置' },
};

function resolvePageTitle(pathname: string, t: (key: string, fallback: string) => string): string {
    if (ROUTE_TITLES[pathname]) return t(ROUTE_TITLES[pathname].key, ROUTE_TITLES[pathname].fallback);
    // Match longest prefix (sort descending by route length)
    const sorted = Object.entries(ROUTE_TITLES).sort((a, b) => b[0].length - a[0].length);
    for (const [route, meta] of sorted) {
        if (pathname.startsWith(route) && route !== '/erp') return t(meta.key, meta.fallback);
    }
    return t('erp.nav.dashboard', '首页概览');
}

/* ─── Styles ─── */
const SIDEBAR_WIDTH = 220;

const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    background: '#0f2b4c',
    borderRight: '1px solid #1a3a5c',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    overflowY: 'auto',
};

const mainStyle: React.CSSProperties = {
    marginLeft: SIDEBAR_WIDTH,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
};

const topbarStyle: React.CSSProperties = {
    height: 56,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff',
    flexShrink: 0,
};

const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    background: '#f1f5f9',
};

const navLinkBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 16px',
    margin: '1px 8px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    color: '#8ab4e0',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
};

const navLinkActive: React.CSSProperties = {
    ...navLinkBase,
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#ffffff',
};

/* ─── Group header button style ─── */
const groupHeaderBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 16px',
    margin: '1px 8px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#8ab4e0',
    background: 'transparent',
    border: 'none',
    width: 'calc(100% - 16px)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textAlign: 'left',
};

/* ─── Sub-item link (indented, no icon) ─── */
const subLinkBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '7px 16px 7px 40px',
    margin: '1px 8px',
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 400,
    color: '#7ba7cc',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
};

const subLinkActive: React.CSSProperties = {
    ...subLinkBase,
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#ffffff',
    fontWeight: 500,
};

const chevronStyle = (expanded: boolean): React.CSSProperties => ({
    transition: 'transform 0.2s ease',
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    flexShrink: 0,
    marginLeft: 'auto',
});

/* ─── Helpers ─── */
/** Check if any child of a group matches the current pathname */
function groupMatchesPath(group: NavGroup, pathname: string): boolean {
    return group.children.some(child =>
        child.end ? pathname === child.to : pathname.startsWith(child.to)
    );
}

/* ─── Component ─── */
export default function ERPLayout() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const isChinese = i18n.language?.startsWith('zh');
    const pageTitle = resolvePageTitle(location.pathname, t);
    const user = useAuthStore((s) => s.user);
    const currentTenantId = user?.tenant_id || '';

    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    /* ── Module settings query ── */
    const { data: erpSettings } = useQuery({
        queryKey: ['erp-settings'],
        queryFn: () => fetchJson<Record<string, any>>('/erp/settings'),
        staleTime: 5 * 60 * 1000,
    });

    /* ── Compute which groups are visible based on module flags ── */
    const visibleGroups = useMemo(() => {
        return NAV_GROUPS.filter(group => {
            if (!group.moduleFlag) return true;
            if (!erpSettings) return true; // show all until settings loaded
            const val = erpSettings[group.moduleFlag];
            return val !== false && val !== 'false';
        });
    }, [erpSettings]);

    /* ── Track expanded groups ── */
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
        // Initialize with the group that matches the current path
        const initial = new Set<string>();
        for (const group of NAV_GROUPS) {
            if (groupMatchesPath(group, location.pathname)) {
                initial.add(group.key);
            }
        }
        return initial;
    });

    // Auto-expand the group that matches the current route whenever it changes
    useEffect(() => {
        for (const group of NAV_GROUPS) {
            if (groupMatchesPath(group, location.pathname)) {
                setExpandedKeys(prev => {
                    if (prev.has(group.key)) return prev;
                    const next = new Set(prev);
                    next.add(group.key);
                    return next;
                });
                break;
            }
        }
    }, [location.pathname]);

    const toggleGroup = useCallback((key: string) => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const { data: tenantInfo } = useQuery({
        queryKey: ['erp-tenant-info'],
        queryFn: () => fetchJson<{ name?: string }>('/tenants/me'),
    });

    const { data: myTenants = [] } = useQuery({
        queryKey: ['erp-my-tenants'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/auth/my-tenants', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!res.ok) return [];
            return res.json() as Promise<any[]>;
        },
        enabled: !!user,
    });

    const companyName = tenantInfo?.name || user?.display_name || (isChinese ? '当前公司' : 'Current Company');
    const companyInitial = (Array.from(companyName.trim())[0] as string | undefined)?.toUpperCase() || 'C';

    const currentTenantObj = useMemo(() =>
        (myTenants as any[]).find((t: any) => t.tenant_id === currentTenantId),
        [myTenants, currentTenantId]
    );
    const displayName = currentTenantObj?.tenant_name || companyName;

    // Close menu on outside click
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMenu]);

    const handleSwitchTenant = async (tenantId: string) => {
        if (tenantId === currentTenantId) { setShowMenu(false); return; }
        const token = localStorage.getItem('token');
        const res = await fetch('/api/auth/switch-tenant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tenant_id: tenantId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
        }
        window.location.href = '/erp';
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Blue-white theme CSS variable overrides */}
            <style>{`
                [data-erp-root] {
                    --bg-primary: #ffffff;
                    --bg-secondary: #ffffff;
                    --bg-tertiary: #f1f5f9;
                    --text-primary: #1e293b;
                    --text-secondary: #475569;
                    --text-tertiary: #94a3b8;
                    --border-subtle: #e2e8f0;
                    --accent-primary: #3b82f6;
                    --accent-hover: #2563eb;
                    color-scheme: light;
                }
            `}</style>
            <div data-erp-root style={{ display: 'flex', width: '100%' }}>
            {/* ── Sidebar ── */}
            <aside style={sidebarStyle}>
                <div style={{
                    padding: '20px 16px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: '1px solid #1a3a5c',
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#ffffff', fontWeight: 700, fontSize: 14, flexShrink: 0,
                    }}>E</div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                            {t('erp.title', 'ERP 管理系统')}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b9ec9', marginTop: 2 }}>
                            {t('erp.subtitle', 'Enterprise Resource Planning')}
                        </div>
                    </div>
                </div>

                <nav style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Dashboard — standalone NavLink, not in a group */}
                    <NavLink
                        to="/erp"
                        end
                        style={({ isActive }) => isActive ? navLinkActive : navLinkBase}
                        onMouseEnter={e => {
                            if (!(e.currentTarget as HTMLElement).dataset.active) {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(59, 130, 246, 0.1)';
                                (e.currentTarget as HTMLElement).style.color = '#ffffff';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!(e.currentTarget as HTMLElement).dataset.active) {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = '#8ab4e0';
                            }
                        }}
                    >
                        <IconLayoutDashboard size={18} stroke={1.5} />
                        <span>{t('erp.nav.dashboard', '首页概览')}</span>
                    </NavLink>

                    {/* Grouped navigation */}
                    {visibleGroups.map(group => {
                        const expanded = expandedKeys.has(group.key);
                        const groupActive = groupMatchesPath(group, location.pathname);
                        return (
                            <div key={group.key}>
                                {/* Group header */}
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    style={{
                                        ...groupHeaderBase,
                                        color: groupActive ? '#ffffff' : '#8ab4e0',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.background = 'rgba(59, 130, 246, 0.1)';
                                        (e.currentTarget as HTMLElement).style.color = '#ffffff';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                                        (e.currentTarget as HTMLElement).style.color = groupActive ? '#ffffff' : '#8ab4e0';
                                    }}
                                >
                                    {group.icon}
                                    <span>{t(group.labelKey, group.labelDefault)}</span>
                                    <span style={chevronStyle(expanded)}>
                                        <IconChevronRight size={14} stroke={2} />
                                    </span>
                                </button>

                                {/* Sub-items */}
                                {expanded && group.children.map(child => (
                                    <NavLink
                                        key={child.to}
                                        to={child.to}
                                        end={child.end}
                                        style={({ isActive }) => isActive ? subLinkActive : subLinkBase}
                                        onMouseEnter={e => {
                                            if (!(e.currentTarget as HTMLElement).dataset.active) {
                                                (e.currentTarget as HTMLElement).style.background = 'rgba(59, 130, 246, 0.08)';
                                                (e.currentTarget as HTMLElement).style.color = '#ffffff';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!(e.currentTarget as HTMLElement).dataset.active) {
                                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                (e.currentTarget as HTMLElement).style.color = '#7ba7cc';
                                            }
                                        }}
                                    >
                                        <span>{t(child.labelKey, child.labelDefault)}</span>
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div style={{ padding: '12px 8px 16px', borderTop: '1px solid #1a3a5c' }}>
                    <NavLink
                        to="/"
                        style={{ ...navLinkBase, margin: 0, color: '#6b9ec9', fontSize: 12 }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = '#ffffff';
                            (e.currentTarget as HTMLElement).style.background = 'rgba(59, 130, 246, 0.15)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = '#6b9ec9';
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                    >
                        <IconArrowLeft size={16} stroke={1.5} />
                        <span>{t('erp.backToClawith', '返回 Clawith')}</span>
                    </NavLink>
                </div>
            </aside>

            {/* ── Main content ── */}
            <div style={mainStyle}>
                <header style={topbarStyle}>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>
                        {pageTitle}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Company Switcher */}
                        <div style={{ position: 'relative' }}>
                            <button
                                ref={triggerRef}
                                onClick={() => setShowMenu(!showMenu)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                                    padding: '6px 12px', borderRadius: 8,
                                    cursor: 'pointer', fontSize: 13, color: '#1e293b',
                                    transition: 'border-color 0.15s',
                                    borderColor: showMenu ? '#3b82f6' : '#e2e8f0',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
                                onMouseLeave={e => { if (!showMenu) (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
                            >
                                <span style={{
                                    width: 24, height: 24, borderRadius: 6,
                                    background: '#3b82f6', color: '#ffffff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                                }}>
                                    {companyInitial}
                                </span>
                                <span style={{ fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {displayName}
                                </span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.15s', transform: showMenu ? 'rotate(180deg)' : 'none' }}>
                                    <path d="M6 9l6 6 6-6"/>
                                </svg>
                            </button>

                            {/* Dropdown */}
                            {showMenu && (
                                <div
                                    ref={menuRef}
                                    style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: 6,
                                        width: 260, background: '#ffffff',
                                        border: '1px solid #e2e8f0', borderRadius: 10,
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                        zIndex: 200, overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px 8px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {isChinese ? '切换公司' : 'Switch company'}
                                    </div>
                                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        {(myTenants as any[]).map((tenant: any) => (
                                            <button
                                                key={tenant.tenant_id}
                                                onClick={() => handleSwitchTenant(tenant.tenant_id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    width: '100%', padding: '10px 14px',
                                                    background: tenant.tenant_id === currentTenantId ? '#eff6ff' : 'transparent',
                                                    border: 'none', cursor: 'pointer',
                                                    fontSize: 13, color: '#1e293b', textAlign: 'left',
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => { if (tenant.tenant_id !== currentTenantId) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = tenant.tenant_id === currentTenantId ? '#eff6ff' : 'transparent'; }}
                                            >
                                                <IconBuilding size={16} stroke={1.5} color="#64748b" />
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: tenant.tenant_id === currentTenantId ? 600 : 400 }}>
                                                    {tenant.tenant_name}
                                                </span>
                                                {tenant.tenant_id === currentTenantId && (
                                                    <IconCheck size={16} stroke={2} color="#3b82f6" />
                                                )}
                                            </button>
                                        ))}
                                        {(myTenants as any[]).length === 0 && (
                                            <div style={{ padding: '16px 14px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                                                {isChinese ? '暂无公司' : 'No companies'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            style={{
                                background: 'none', border: 'none', padding: 6,
                                color: '#64748b', cursor: 'pointer',
                                borderRadius: 6, display: 'flex', alignItems: 'center',
                            }}
                            title={t('erp.notifications', '通知')}
                        >
                            <IconBell size={18} stroke={1.5} />
                        </button>
                        <button
                            style={{
                                background: 'none', border: 'none', padding: 6,
                                color: '#64748b', cursor: 'pointer',
                                borderRadius: 6, display: 'flex', alignItems: 'center',
                            }}
                            title={t('erp.account', '账户')}
                        >
                            <IconUserCircle size={20} stroke={1.5} />
                        </button>
                    </div>
                </header>

                <main style={contentStyle}>
                    <Outlet />
                </main>
            </div>
            </div>
        </div>
    );
}
