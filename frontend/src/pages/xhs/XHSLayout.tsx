/**
 * XHS Layout — Dedicated Xiaohongshu operations sidebar + content area.
 */

import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../../stores';
import { fetchJson } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import {
    IconLayoutDashboard,
    IconNotes,
    IconCalendar,
    IconChartBar,
    IconUsers,
    IconMessageCircle,
    IconSettings,
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
    end?: boolean;
}

interface NavGroup {
    key: string;
    labelKey: string;
    labelDefault: string;
    icon: React.ReactNode;
    children: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        key: 'content',
        labelKey: 'xhs.nav.group.content',
        labelDefault: '内容管理',
        icon: <IconNotes size={18} stroke={1.5} />,
        children: [
            { to: '/xhs/content', labelKey: 'xhs.nav.content', labelDefault: '内容列表' },
            { to: '/xhs/content/calendar', labelKey: 'xhs.nav.calendar', labelDefault: '排期日历' },
        ],
    },
    {
        key: 'data',
        labelKey: 'xhs.nav.group.data',
        labelDefault: '数据分析',
        icon: <IconChartBar size={18} stroke={1.5} />,
        children: [
            { to: '/xhs/analytics', labelKey: 'xhs.nav.analytics', labelDefault: '数据看板' },
        ],
    },
    {
        key: 'ops',
        labelKey: 'xhs.nav.group.ops',
        labelDefault: '运营管理',
        icon: <IconMessageCircle size={18} stroke={1.5} />,
        children: [
            { to: '/xhs/accounts', labelKey: 'xhs.nav.accounts', labelDefault: '账号管理' },
            { to: '/xhs/interactions', labelKey: 'xhs.nav.interactions', labelDefault: '互动管理' },
        ],
    },
    {
        key: 'settings',
        labelKey: 'xhs.nav.group.settings',
        labelDefault: '模块设置',
        icon: <IconSettings size={18} stroke={1.5} />,
        children: [
            { to: '/xhs/settings', labelKey: 'xhs.nav.settings', labelDefault: '小红书设置' },
        ],
    },
];

const ROUTE_TITLES: Record<string, { key: string; fallback: string }> = {
    '/xhs':                      { key: 'xhs.nav.dashboard',    fallback: '运营看板' },
    '/xhs/content':              { key: 'xhs.nav.content',      fallback: '内容管理' },
    '/xhs/content/calendar':     { key: 'xhs.nav.calendar',     fallback: '排期日历' },
    '/xhs/analytics':            { key: 'xhs.nav.analytics',    fallback: '数据看板' },
    '/xhs/accounts':             { key: 'xhs.nav.accounts',     fallback: '账号管理' },
    '/xhs/interactions':         { key: 'xhs.nav.interactions', fallback: '互动管理' },
    '/xhs/settings':             { key: 'xhs.nav.settings',     fallback: '小红书设置' },
};

function resolvePageTitle(pathname: string, t: (key: string, fallback: string) => string): string {
    if (ROUTE_TITLES[pathname]) return t(ROUTE_TITLES[pathname].key, ROUTE_TITLES[pathname].fallback);
    const sorted = Object.entries(ROUTE_TITLES).sort((a, b) => b[0].length - a[0].length);
    for (const [route, meta] of sorted) {
        if (pathname.startsWith(route) && route !== '/xhs') return t(meta.key, meta.fallback);
    }
    return t('xhs.nav.dashboard', '运营看板');
}

/* ─── Styles ─── */
const SIDEBAR_WIDTH = 220;

const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    background: '#1a1a2e',
    borderRight: '1px solid #2d2d44',
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
    background: '#f8f9fa',
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
    color: '#a0a0c0',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
};

const navLinkActive: React.CSSProperties = {
    ...navLinkBase,
    background: 'rgba(255, 59, 80, 0.15)',
    color: '#ff3b50',
};

const groupHeaderBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 16px',
    margin: '1px 8px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#a0a0c0',
    background: 'transparent',
    border: 'none',
    width: 'calc(100% - 16px)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textAlign: 'left' as const,
};

const subLinkBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '7px 16px 7px 40px',
    margin: '1px 8px',
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 400,
    color: '#808098',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
};

const subLinkActive: React.CSSProperties = {
    ...subLinkBase,
    background: 'rgba(255, 59, 80, 0.15)',
    color: '#ff3b50',
    fontWeight: 500,
};

const chevronStyle = (expanded: boolean): React.CSSProperties => ({
    transition: 'transform 0.2s ease',
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    flexShrink: 0,
    marginLeft: 'auto',
});

function groupMatchesPath(group: NavGroup, pathname: string): boolean {
    return group.children.some(child =>
        child.end ? pathname === child.to : pathname.startsWith(child.to)
    );
}

/* ─── Component ─── */
export default function XHSLayout() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isChinese = i18n.language?.startsWith('zh');
    const pageTitle = resolvePageTitle(location.pathname, t);
    const user = useAuthStore((s) => s.user);

    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        for (const group of NAV_GROUPS) {
            if (groupMatchesPath(group, location.pathname)) {
                initial.add(group.key);
            }
        }
        return initial;
    });

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
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <style>{`
                [data-xhs-root] {
                    --xhs-accent: #ff2442;
                    --xhs-accent-hover: #e0203a;
                    color-scheme: light;
                }
            `}</style>
            <div data-xhs-root style={{ display: 'flex', width: '100%' }}>
            {/* Sidebar */}
            <aside style={sidebarStyle}>
                <div style={{
                    padding: '20px 16px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: '1px solid #2d2d44',
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #ff2442, #ff6b81)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#ffffff', fontWeight: 700, fontSize: 16, flexShrink: 0,
                    }}>📕</div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                            {t('xhs.title', '小红书运营')}
                        </div>
                        <div style={{ fontSize: 10, color: '#808098', marginTop: 2 }}>
                            RedNote Operations
                        </div>
                    </div>
                </div>

                <nav style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <NavLink
                        to="/xhs"
                        end
                        style={({ isActive }) => isActive ? navLinkActive : navLinkBase}
                    >
                        <IconLayoutDashboard size={18} stroke={1.5} />
                        <span>{t('xhs.nav.dashboard', '运营看板')}</span>
                    </NavLink>

                    {NAV_GROUPS.map(group => {
                        const expanded = expandedKeys.has(group.key);
                        const groupActive = groupMatchesPath(group, location.pathname);
                        return (
                            <div key={group.key}>
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    style={{
                                        ...groupHeaderBase,
                                        color: groupActive ? '#ff3b50' : '#a0a0c0',
                                    }}
                                >
                                    {group.icon}
                                    <span>{t(group.labelKey, group.labelDefault)}</span>
                                    <span style={chevronStyle(expanded)}>
                                        <IconChevronRight size={14} stroke={2} />
                                    </span>
                                </button>
                                {expanded && group.children.map(child => (
                                    <NavLink
                                        key={child.to}
                                        to={child.to}
                                        end={child.end}
                                        style={({ isActive }) => isActive ? subLinkActive : subLinkBase}
                                    >
                                        <span>{t(child.labelKey, child.labelDefault)}</span>
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div style={{ padding: '12px 8px 16px', borderTop: '1px solid #2d2d44' }}>
                    <NavLink
                        to="/"
                        style={{ ...navLinkBase, margin: 0, color: '#606080', fontSize: 12 }}
                    >
                        <IconArrowLeft size={16} stroke={1.5} />
                        <span>{isChinese ? '智能体' : 'Agents'}</span>
                    </NavLink>
                </div>
            </aside>

            {/* Main content */}
            <div style={mainStyle}>
                <header style={topbarStyle}>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>
                        {pageTitle}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button style={{ background: 'none', border: 'none', padding: 6, color: '#64748b', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                            <IconBell size={18} stroke={1.5} />
                        </button>
                        <button style={{ background: 'none', border: 'none', padding: 6, color: '#64748b', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
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
