/**
 * XHS Content List — Manage Xiaohongshu content (drafts, published, scheduled).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS: Record<string, string> = {
    draft: '#94a3b8',
    scheduled: '#f59e0b',
    publishing: '#3b82f6',
    published: '#10b981',
    failed: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
    draft: '草稿',
    scheduled: '排期中',
    publishing: '发布中',
    published: '已发布',
    failed: '失败',
};

export default function ContentList() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['xhs-content', statusFilter],
        queryFn: () => fetchJson(`/xhs/content?${statusFilter ? `status=${statusFilter}` : ''}`),
    });

    const createMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-content'] });
            setShowCreate(false);
            setNewTitle('');
            setNewContent('');
        },
    });

    const items = (data as any)?.items || [];

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['', 'draft', 'scheduled', 'published'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: '1px solid',
                                borderColor: statusFilter === s ? '#ff2442' : '#e2e8f0',
                                background: statusFilter === s ? '#ff244210' : '#ffffff',
                                color: statusFilter === s ? '#ff2442' : '#64748b',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 500,
                            }}
                        >
                            {s ? STATUS_LABELS[s] || s : '全部'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #ff2442, #ff6b81)',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    + 新建内容
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: 24,
                    border: '1px solid #e8ecf1',
                    marginBottom: 20,
                }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>新建小红书内容</h3>
                    <input
                        placeholder="标题"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                    />
                    <textarea
                        placeholder="正文内容..."
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        rows={6}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>取消</button>
                        <button
                            onClick={() => createMutation.mutate({ title: newTitle, content: newContent })}
                            disabled={!newTitle}
                            style={{
                                padding: '8px 16px', borderRadius: 6, border: 'none',
                                background: newTitle ? '#ff2442' : '#ccc', color: '#fff',
                                cursor: newTitle ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
                            }}
                        >
                            保存草稿
                        </button>
                    </div>
                </div>
            )}

            {/* Content list */}
            <div style={{
                background: '#ffffff',
                borderRadius: 12,
                border: '1px solid #e8ecf1',
                overflow: 'hidden',
            }}>
                {isLoading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                        <div style={{ fontSize: 14 }}>暂无内容，点击"新建内容"开始创作</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e8ecf1', background: '#f8fafc' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>标题</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>类型</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>状态</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>创建时间</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.title}</td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.note_type === 'video' ? '🎬 视频' : '📷 图文'}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                                            background: `${STATUS_COLORS[item.status] || '#94a3b8'}15`,
                                            color: STATUS_COLORS[item.status] || '#94a3b8',
                                            fontSize: 12, fontWeight: 500,
                                        }}>
                                            {STATUS_LABELS[item.status] || item.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                                        {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        {item.status === 'draft' && (
                                            <button style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #ff2442', background: 'transparent', color: '#ff2442', cursor: 'pointer', fontSize: 12 }}>
                                                发布
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
