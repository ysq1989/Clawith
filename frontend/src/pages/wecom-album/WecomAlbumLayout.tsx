/**
 * WeChat Business Album Layout — Dedicated 微商相册 sidebar + content area.
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores';
import {
    IconLayoutDashboard,
    IconUsers,
    IconPackage,
    IconSettings,
    IconArrowLeft,
    IconChevronRight,
    IconUserCircle,
    IconCategory,
} from '@tabler/icons-react';

/* ─── Navigation ─── */
interface NavItem {
    to: string;
    labelKey: string;
    labelDefault: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    { to: '/wecom-album', labelKey: 'wecomAlbum.nav.dashboard', labelDefault: '仪表盘', icon: <IconLayoutDashboard size={18} stroke={1.5} /> },
    { to: '/wecom-album/suppliers', labelKey: 'wecomAlbum.nav.suppliers', labelDefault: '供应商', icon: <IconUsers size={18} stroke={1.5} /> },
    { to: '/wecom-album/products', labelKey: 'wecomAlbum.nav.products', labelDefault: '商品', icon: <IconPackage size={18} stroke={1.5} /> },
    { to: '/wecom-album/categories', labelKey: 'wecomAlbum.nav.categories', labelDefault: '分类设置', icon: <IconCategory size={18} stroke={1.5} /> },
    { to: '/wecom-album/config', labelKey: 'wecomAlbum.nav.config', labelDefault: '系统设置', icon: <IconSettings size={18} stroke={1.5} /> },
];

export default function WecomAlbumLayout() {
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
                            {t('wecomAlbum.title', '微商相册')}
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
                            end={item.to === '/wecom-album'}
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
