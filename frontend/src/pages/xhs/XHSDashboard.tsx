/**
 * XHS Dashboard — Xiaohongshu operations overview.
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import {
    IconEye,
    IconHeart,
    IconMessage,
    IconBookmark,
    IconTrendingUp,
    IconNotes,
    IconUsers,
    IconCalendar,
} from '@tabler/icons-react';

interface AnalyticsOverview {
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_bookmarks: number;
    note_count: number;
    content_status: Record<string, number>;
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
    return (
        <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '20px 16px',
            border: '1px solid #e8ecf1',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            transition: 'box-shadow 0.2s',
        }}>
            <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{label}</div>
            </div>
        </div>
    );
}

/* ─── Content Status Bar ─── */
function ContentStatusBar({ status }: { status: Record<string, number> }) {
    const { t } = useTranslation();
    const items = [
        { key: 'draft', label: t('xhs.status.draft', '草稿'), color: '#94a3b8' },
        { key: 'scheduled', label: t('xhs.status.scheduled', '排期中'), color: '#f59e0b' },
        { key: 'publishing', label: t('xhs.status.publishing', '发布中'), color: '#3b82f6' },
        { key: 'published', label: t('xhs.status.published', '已发布'), color: '#10b981' },
        { key: 'failed', label: t('xhs.status.failed', '失败'), color: '#ef4444' },
    ];

    const total = Object.values(status).reduce((a, b) => a + b, 0) || 1;

    return (
        <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid #e8ecf1',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                {t('xhs.dashboard.contentStatus', '内容状态分布')}
            </h3>
            <div style={{ display: 'flex', gap: 4, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                {items.map(item => {
                    const count = status[item.key] || 0;
                    const pct = (count / total) * 100;
                    return pct > 0 ? (
                        <div key={item.key} style={{ width: `${pct}%`, background: item.color }} />
                    ) : null;
                })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {items.map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                        {item.label}: {status[item.key] || 0}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Quick Actions ─── */
function QuickActions() {
    const { t } = useTranslation();
    const actions = [
        { icon: <IconNotes size={20} />, label: t('xhs.dashboard.newContent', '新建内容'), color: '#ff2442', href: '/xhs/content' },
        { icon: <IconCalendar size={20} />, label: t('xhs.dashboard.schedule', '排期管理'), color: '#f59e0b', href: '/xhs/content/calendar' },
        { icon: <IconUsers size={20} />, label: t('xhs.dashboard.accounts', '账号管理'), color: '#3b82f6', href: '/xhs/accounts' },
        { icon: <IconTrendingUp size={20} />, label: t('xhs.dashboard.analytics', '数据看板'), color: '#10b981', href: '/xhs/analytics' },
    ];

    return (
        <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid #e8ecf1',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                {t('xhs.dashboard.quickActions', '快捷操作')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {actions.map(action => (
                    <a
                        key={action.href}
                        href={action.href}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                            padding: '16px 12px',
                            borderRadius: 10,
                            border: '1px solid #e8ecf1',
                            textDecoration: 'none',
                            color: '#1e293b',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.borderColor = action.color;
                            (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${action.color}20`;
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#e8ecf1';
                            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ color: action.color }}>{action.icon}</div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Dashboard ─── */
export default function XHSDashboard() {
    const { t } = useTranslation();

    const { data: overview, isLoading } = useQuery<AnalyticsOverview>({
        queryKey: ['xhs-analytics-overview'],
        queryFn: () => fetchJson('/xhs/analytics/overview'),
        staleTime: 60_000,
    });

    const { data: liveData } = useQuery({
        queryKey: ['xhs-analytics-live'],
        queryFn: () => fetchJson('/xhs/analytics/live'),
        staleTime: 300_000,
    });

    const stats = (overview as any) || { total_views: 0, total_likes: 0, total_comments: 0, total_bookmarks: 0, note_count: 0, content_status: {} as Record<string, number> };

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard icon={<IconEye size={22} />} label={t('xhs.dashboard.totalViews', '总曝光')} value={stats.total_views || 0} color="#3b82f6" />
                <StatCard icon={<IconHeart size={22} />} label={t('xhs.dashboard.totalLikes', '总点赞')} value={stats.total_likes || 0} color="#ff2442" />
                <StatCard icon={<IconMessage size={22} />} label={t('xhs.dashboard.totalComments', '总评论')} value={stats.total_comments || 0} color="#f59e0b" />
                <StatCard icon={<IconBookmark size={22} />} label={t('xhs.dashboard.totalBookmarks', '总收藏')} value={stats.total_bookmarks || 0} color="#10b981" />
            </div>

            {/* Content status + Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <ContentStatusBar status={(stats.content_status || {}) as Record<string, number>} />
                <QuickActions />
            </div>

            {/* Live data from creator center */}
            {liveData && typeof liveData === 'object' && 'rows' in liveData && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: '20px',
                    border: '1px solid #e8ecf1',
                }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                        {t('xhs.dashboard.recentNotes', '最近笔记数据（来自创作者中心）')}
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e8ecf1' }}>
                                    {['标题', '发布时间', '曝光', '观看', '点击率', '点赞', '评论', '收藏'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(liveData as any).rows.map((row: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row['标题'] || '-'}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{row['发布时间'] || '-'}</td>
                                        <td style={{ padding: '10px 12px' }}>{(row['曝光'] || 0).toLocaleString()}</td>
                                        <td style={{ padding: '10px 12px' }}>{(row['观看'] || 0).toLocaleString()}</td>
                                        <td style={{ padding: '10px 12px' }}>{row['封面点击率'] || '-'}</td>
                                        <td style={{ padding: '10px 12px', color: '#ff2442' }}>{row['点赞'] || 0}</td>
                                        <td style={{ padding: '10px 12px' }}>{row['评论'] || 0}</td>
                                        <td style={{ padding: '10px 12px', color: '#f59e0b' }}>{row['收藏'] || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
