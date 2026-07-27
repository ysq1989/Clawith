/**
 * Product Hub Layout — Dedicated 选品中心 sidebar + content area.
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores';
import { fetchJson } from '../../services/api';
import {
    IconLayoutDashboard,
    IconShoppingBag,
    IconPool,
    IconCloudUpload,
    IconCategory,
    IconArrowLeft,
    IconBell,
    IconUserCircle,
    IconChevronRight,
    IconBuilding,
    IconCheck,
} from '@tabler/icons-react';

/* ─── Navigation ─── */
interface NavItem {
    to: string;
    labelKey: string;
    labelDefault: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    { to: '/product-hub', labelKey: 'productHub.nav.dashboard', labelDefault: '仪表盘', icon: <IconLayoutDashboard size={18} stroke={1.5} /> },
    { to: '/product-hub/products', labelKey: 'productHub.nav.products', labelDefault: '选品池', icon: <IconShoppingBag size={18} stroke={1.5} /> },
    { to: '/product-hub/my-pools', labelKey: 'productHub.nav.myPools', labelDefault: '我的货池', icon: <IconPool size={18} stroke={1.5} /> },
    { to: '/product-hub/crawl-tasks', labelKey: 'productHub.nav.crawlTasks', labelDefault: '采集任务', icon: <IconCloudUpload size={18} stroke={1.5} /> },
    { to: '/product-hub/categories', labelKey: 'productHub.nav.categories', labelDefault: '分类管理', icon: <IconCategory size={18} stroke={1.5} /> },
];

export default function ProductHubLayout() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const isChinese = i18n.language?.startsWith('zh');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="xhs-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: sidebarCollapsed ? 60 : 220,
                    background: 'var(--bg-primary)',
                    borderRight: '1px solid var(--border-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.2s ease',
                    flexShrink: 0,
                }}
            >
                {/* Header */}
                <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: 4,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        title={isChinese ? '返回主界面' : 'Back to main'}
                    >
                        <IconArrowLeft size={18} stroke={1.5} />
                    </button>
                    {!sidebarCollapsed && (
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                            {t('productHub.title', '选品中心')}
                        </span>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <IconChevronRight
                            size={16}
                            stroke={1.5}
                            style={{
                                transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                                transition: 'transform 0.2s',
                            }}
                        />
                    </button>
                </div>

                {/* Nav items */}
                <nav style={{ flex: 1, padding: '0 8px' }}>
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/product-hub'}
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: sidebarCollapsed ? '10px 0' : '10px 12px',
                                borderRadius: 8,
                                marginBottom: 2,
                                textDecoration: 'none',
                                color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                                background: isActive ? 'var(--bg-active)' : 'transparent',
                                fontWeight: isActive ? 500 : 400,
                                fontSize: 14,
                                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                transition: 'background 0.15s, color 0.15s',
                            })}
                            title={sidebarCollapsed ? item.labelDefault : undefined}
                        >
                            {item.icon}
                            {!sidebarCollapsed && (
                                <span>{t(item.labelKey, item.labelDefault)}</span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User info */}
                <div
                    ref={userMenuRef}
                    style={{
                        padding: '12px',
                        borderTop: '1px solid var(--border-primary)',
                        position: 'relative',
                    }}
                >
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 8,
                            borderRadius: 8,
                            color: 'var(--text-secondary)',
                        }}
                    >
                        <IconUserCircle size={20} stroke={1.5} />
                        {!sidebarCollapsed && (
                            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.username || user?.email || 'User'}
                            </span>
                        )}
                    </button>
                    {showUserMenu && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 12,
                                right: 12,
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 8,
                                padding: 4,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                zIndex: 100,
                            }}
                        >
                            <button
                                onClick={() => { navigate('/dashboard'); setShowUserMenu(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    width: '100%',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    fontSize: 13,
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <IconArrowLeft size={16} stroke={1.5} />
                                {isChinese ? '返回主界面' : 'Back to main'}
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-secondary)' }}>
                <Outlet />
            </main>
        </div>
    );
}
