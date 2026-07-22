/**
 * XHS Analytics — Data analytics dashboard.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';

export default function AnalyticsBoard() {
    const { data: liveData, isLoading } = useQuery({
        queryKey: ['xhs-analytics-live'],
        queryFn: () => fetchJson('/xhs/analytics/live'),
        staleTime: 300_000,
    });

    const rows = (liveData as any)?.rows || [];

    return (
        <div style={{ maxWidth: 1200 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ecf1' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>笔记数据（来自小红书创作者中心）</h3>
                </div>
                {isLoading ? (
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
        </div>
    );
}
