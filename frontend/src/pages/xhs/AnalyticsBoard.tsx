/**
 * XHS Analytics — Data analytics dashboard with overview stats and charts.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { IconEye, IconHeart, IconMessage, IconBookmark, IconRefresh } from '@tabler/icons-react';

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    return (
        <div style={{
            background: '#ffffff', borderRadius: 12, padding: '16px',
            border: '1px solid #e8ecf1', display: 'flex', alignItems: 'center', gap: 12,
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{(value || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
            </div>
        </div>
    );
}

/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#fff', padding: '8px 12px', borderRadius: 8,
            border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: 12,
        }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#1e293b' }}>{label}</div>
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 500 }}>{p.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

/* ─── Main ─── */
export default function AnalyticsBoard() {
    const [activeTab, setActiveTab] = useState<'overview' | 'live'>('overview');

    const { data: overview, isLoading: overviewLoading } = useQuery({
        queryKey: ['xhs-analytics-overview'],
        queryFn: () => fetchJson('/xhs/analytics/overview'),
        staleTime: 60_000,
    });

    const { data: liveData, isLoading: liveLoading, refetch: refetchLive } = useQuery({
        queryKey: ['xhs-analytics-live'],
        queryFn: () => fetchJson('/xhs/analytics/live'),
        staleTime: 300_000,
    });

    const { data: notesData } = useQuery({
        queryKey: ['xhs-analytics-notes'],
        queryFn: () => fetchJson('/xhs/analytics/notes'),
    });

    const ov = overview as any || {};
    const rows = (liveData as any)?.rows || [];
    const noteItems = (notesData as any)?.items || [];

    // Prepare pie chart data from content status
    const STATUS_PIE_DATA = Object.entries(ov.content_status || {}).map(([key, val]) => ({
        name: ({ draft: '草稿', scheduled: '排期中', publishing: '发布中', published: '已发布', failed: '失败' } as any)[key] || key,
        value: val as number,
    })).filter(d => d.value > 0);

    const PIE_COLORS = ['#94a3b8', '#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

    // Prepare bar chart from live data
    const barData = rows.slice(0, 10).map((r: any) => ({
        name: (r['标题'] || '').slice(0, 8),
        曝光: r['曝光'] || 0,
        点赞: r['点赞'] || 0,
        评论: r['评论'] || 0,
        收藏: r['收藏'] || 0,
    }));

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                    { key: 'overview' as const, label: '数据概览' },
                    { key: 'live' as const, label: '创作者中心' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        border: `1px solid ${activeTab === tab.key ? '#ff2442' : '#e2e8f0'}`,
                        background: activeTab === tab.key ? '#ff244210' : '#fff',
                        color: activeTab === tab.key ? '#ff2442' : '#64748b',
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                        <StatCard icon={<IconEye size={20} />} label="总曝光" value={ov.total_views} color="#3b82f6" />
                        <StatCard icon={<IconHeart size={20} />} label="总点赞" value={ov.total_likes} color="#ff2442" />
                        <StatCard icon={<IconMessage size={20} />} label="总评论" value={ov.total_comments} color="#f59e0b" />
                        <StatCard icon={<IconBookmark size={20} />} label="总收藏" value={ov.total_bookmarks} color="#10b981" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        {/* Content Status Pie */}
                        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ecf1' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>内容状态分布</h3>
                            {STATUS_PIE_DATA.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={STATUS_PIE_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                            paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            labelLine={false} style={{ fontSize: 11 }}>
                                            {STATUS_PIE_DATA.map((_, i) => (
                                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                                    暂无内容数据
                                </div>
                            )}
                        </div>

                        {/* Bar chart from notes */}
                        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ecf1' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>笔记数据分析</h3>
                            {noteItems.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={noteItems.slice(0, 8).map((n: any) => ({
                                        name: (n.title || '').slice(0, 6),
                                        views: n.views || 0, likes: n.likes || 0,
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" style={{ fontSize: 10 }} />
                                        <YAxis style={{ fontSize: 10 }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="views" name="曝光" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="likes" name="点赞" fill="#ff2442" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                                    暂无笔记数据
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top notes table */}
                    {noteItems.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ecf1' }}>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>笔记排行</h3>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e8ecf1', background: '#f8fafc' }}>
                                        {['标题', '曝光', '点赞', '评论', '收藏', '分享', '采集时间'].map(h => (
                                            <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 12 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {noteItems.map((n: any, i: number) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {n.title || '-'}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{(n.views || 0).toLocaleString()}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ff2442' }}>{n.likes || 0}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{n.comments || 0}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f59e0b' }}>{n.bookmarks || 0}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{n.shares || 0}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                                                {n.collected_at ? new Date(n.collected_at).toLocaleDateString('zh-CN') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'live' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <button onClick={() => refetchLive()} style={{
                            padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0',
                            background: '#fff', cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <IconRefresh size={14} /> 刷新数据
                        </button>
                    </div>

                    {/* Bar chart */}
                    {barData.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ecf1', marginBottom: 16 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>笔记数据对比</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" style={{ fontSize: 11 }} />
                                    <YAxis style={{ fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend />
                                    <Bar dataKey="曝光" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="点赞" fill="#ff2442" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="评论" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="收藏" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Live data table */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ecf1' }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>笔记数据（来自小红书创作者中心）</h3>
                        </div>
                        {liveLoading ? (
                            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
                        ) : rows.length === 0 ? (
                            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                                <div>暂无数据，请确保 Chrome 已登录小红书</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #e8ecf1', background: '#f8fafc' }}>
                                            {['标题', '发布时间', '曝光', '观看', '点击率', '点赞', '评论', '收藏', '涨粉', '分享'].map(h => (
                                                <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row: any, i: number) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px 12px', textAlign: 'left', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{row['标题'] || '-'}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>{row['发布时间'] || '-'}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{(row['曝光'] || 0).toLocaleString()}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{(row['观看'] || 0).toLocaleString()}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row['封面点击率'] || '-'}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ff2442' }}>{row['点赞'] || 0}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row['评论'] || 0}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f59e0b' }}>{row['收藏'] || 0}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981' }}>{row['涨粉'] || 0}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row['分享'] || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
