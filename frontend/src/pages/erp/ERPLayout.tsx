/**
 * ERP Layout — Dedicated ERP sidebar + content area with company switcher dropdown.
 */

import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores';
import { fetchJson } from '../../services/api';
import {
    IconLayoutDashboard,
    IconUsers,
    IconTruckDelivery,
    IconBox,
    IconReceipt2,
    IconShoppingCart,
    IconPackages,
    IconCoin,
    IconChartBar,
    IconArrowLeft,
    IconBell,
    IconUserCircle,
    IconCheck,
    IconBuilding,
    IconPlus,
} from '@tabler/icons-react';

/* ─── Nav item definition ─── */
interface NavItem {
    to: string;
    icon: React.ReactNode;
    labelKey: string;
    labelDefault: string;
    end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { to: '/erp',              icon: <IconLayoutDashboard size={18} stroke={1.5} />, labelKey: 'erp.nav.dashboard',       labelDefault: '首页概览',    end: true },
    { to: '/erp/customers',    icon: <IconUsers size={18} stroke={1.5} />,          labelKey: 'erp.nav.customers',       labelDefault: '客户管理' },
    { to: '/erp/suppliers',    icon: <IconTruckDelivery size={18} stroke={1.5} />,  labelKey: 'erp.nav.suppliers',       labelDefault: '供应商' },
    { to: '/erp/products',     icon: <IconBox size={18} stroke={1.5} />,            labelKey: 'erp.nav.products',        labelDefault: '产品管理' },
    { to: '/erp/sales-orders', icon: <IconReceipt2 size={18} stroke={1.5} />,       labelKey: 'erp.nav.salesOrders',     labelDefault: '销售订单' },
    { to: '/erp/purchase-orders', icon: <IconShoppingCart size={18} stroke={1.5} />, labelKey: 'erp.nav.purchaseOrders', labelDefault: '采购订单' },
    { to: '/erp/inventory',    icon: <IconPackages size={18} stroke={1.5} />,       labelKey: 'erp.nav.inventory',       labelDefault: '库存管理' },
    { to: '/erp/finance',      icon: <IconCoin size={18} stroke={1.5} />,           labelKey: 'erp.nav.finance',         labelDefault: '财务管理' },
    { to: '/erp/reports',      icon: <IconChartBar size={18} stroke={1.5} />,       labelKey: 'erp.nav.reports',         labelDefault: '数据报表' },
];

/* ─── Route-to-title mapping for top bar ─── */
const ROUTE_TITLES: Record<string, { key: string; fallback: string }> = {
    '/erp':                { key: 'erp.nav.dashboard',       fallback: '首页概览' },
    '/erp/customers':      { key: 'erp.nav.customers',       fallback: '客户管理' },
    '/erp/suppliers':      { key: 'erp.nav.suppliers',       fallback: '供应商' },
    '/erp/products':       { key: 'erp.nav.products',        fallback: '产品管理' },
    '/erp/sales-orders':   { key: 'erp.nav.salesOrders',     fallback: '销售订单' },
    '/erp/purchase-orders':{ key: 'erp.nav.purchaseOrders',  fallback: '采购订单' },
    '/erp/inventory':      { key: 'erp.nav.inventory',       fallback: '库存管理' },
    '/erp/finance':        { key: 'erp.nav.finance',         fallback: '财务管理' },
    '/erp/reports':        { key: 'erp.nav.reports',         fallback: '数据报表' },
};

function resolvePageTitle(pathname: string, t: (key: string, fallback: string) => string): string {
    if (ROUTE_TITLES[pathname]) return t(ROUTE_TITLES[pathname].key, ROUTE_TITLES[pathname].fallback);
    for (const [route, meta] of Object.entries(ROUTE_TITLES)) {
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
                    {NAV_ITEMS.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
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
                            {item.icon}
                            <span>{t(item.labelKey, item.labelDefault)}</span>
                        </NavLink>
                    ))}
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
                                    <div style={{ borderTop: '1px solid #e2e8f0', padding: 4 }}>
                                        <button
                                            onClick={() => { setShowMenu(false); navigate('/'); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                width: '100%', padding: '10px 14px',
                                                background: 'transparent', border: 'none',
                                                cursor: 'pointer', fontSize: 13, color: '#3b82f6',
                                                fontWeight: 500, borderRadius: 6,
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f7ff'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <IconPlus size={16} stroke={1.6} />
                                            <span>{isChinese ? '创建或加入新公司' : 'Create or join company'}</span>
                                        </button>
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
