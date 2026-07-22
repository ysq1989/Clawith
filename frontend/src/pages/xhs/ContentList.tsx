/**
 * XHS Content List — Manage Xiaohongshu content (drafts, published, scheduled).
 *
 * Features: status filter, create/edit with images/tags/persona/account,
 * publish, schedule, delete, detail modal.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useTranslation } from 'react-i18next';
import {
    IconEye, IconEdit, IconTrash, IconSend, IconCalendar,
    IconX, IconPlus, IconPhoto, IconTag, IconUser,
} from '@tabler/icons-react';

/* ─── Constants ─── */
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

const STATUS_FILTERS = [
    { key: '', label: '全部' },
    { key: 'draft', label: '草稿' },
    { key: 'scheduled', label: '排期中' },
    { key: 'publishing', label: '发布中' },
    { key: 'published', label: '已发布' },
    { key: 'failed', label: '失败' },
];

/* ─── Tag Input ─── */
function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
    const [input, setInput] = useState('');
    const addTag = () => {
        const tag = input.trim();
        if (tag && !value.includes(tag)) {
            onChange([...value, tag.startsWith('#') ? tag : `#${tag}`]);
        }
        setInput('');
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {value.map((tag, i) => (
                    <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 4,
                        background: '#ff244215', color: '#ff2442', fontSize: 12, fontWeight: 500,
                    }}>
                        {tag}
                        <button onClick={() => onChange(value.filter((_, j) => j !== i))} style={{
                            background: 'none', border: 'none', color: '#ff2442', cursor: 'pointer',
                            padding: 0, fontSize: 14, lineHeight: 1,
                        }}>×</button>
                    </span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="输入标签后回车"
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <button onClick={addTag} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>添加</button>
            </div>
        </div>
    );
}

/* ─── Content Form ─── */
interface ContentFormData {
    title: string;
    content: string;
    note_type: string;
    images: { url: string; local_path?: string }[];
    tags: string[];
    account_id: string;
    persona_id: string;
}

const EMPTY_FORM: ContentFormData = {
    title: '', content: '', note_type: 'image',
    images: [], tags: [], account_id: '', persona_id: '',
};

function ContentForm({
    initial, accounts, personas, onSubmit, onCancel, submitLabel,
}: {
    initial?: ContentFormData;
    accounts: any[];
    personas: any[];
    onSubmit: (data: ContentFormData) => void;
    onCancel: () => void;
    submitLabel: string;
}) {
    const [form, setForm] = useState<ContentFormData>(initial || EMPTY_FORM);
    const [imageInput, setImageInput] = useState('');

    const update = <K extends keyof ContentFormData>(key: K, val: ContentFormData[K]) => {
        setForm(prev => ({ ...prev, [key]: val }));
    };

    const addImage = () => {
        const url = imageInput.trim();
        if (url && !form.images.some(img => img.url === url)) {
            update('images', [...form.images, { url }]);
        }
        setImageInput('');
    };

    return (
        <div style={{
            background: '#ffffff', borderRadius: 12, padding: 24,
            border: '1px solid #e8ecf1', marginBottom: 20,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    {initial ? '编辑内容' : '新建小红书内容'}
                </h3>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                    <IconX size={18} />
                </button>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>标题 <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                    placeholder="笔记标题（最多200字）"
                    maxLength={200}
                    style={inputStyle}
                />
            </div>

            {/* Note type */}
            <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>内容类型</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[
                        { key: 'image', label: '📷 图文' },
                        { key: 'video', label: '🎬 视频' },
                    ].map(opt => (
                        <button key={opt.key} onClick={() => update('note_type', opt.key)} style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                            border: `1px solid ${form.note_type === opt.key ? '#ff2442' : '#e2e8f0'}`,
                            background: form.note_type === opt.key ? '#ff244210' : '#fff',
                            color: form.note_type === opt.key ? '#ff2442' : '#64748b',
                            fontWeight: 500,
                        }}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>正文内容</label>
                <textarea
                    value={form.content}
                    onChange={e => update('content', e.target.value)}
                    placeholder="笔记正文..."
                    rows={6}
                    style={{ ...inputStyle, resize: 'vertical' }}
                />
            </div>

            {/* Images */}
            <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}><IconPhoto size={14} style={{ marginRight: 4, verticalAlign: -2 }} />图片</label>
                {form.images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        {form.images.map((img, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 8px', borderRadius: 6, background: '#f8fafc',
                                border: '1px solid #e2e8f0', fontSize: 12, maxWidth: 200,
                            }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    {img.url.split('/').pop()}
                                </span>
                                <button onClick={() => update('images', form.images.filter((_, j) => j !== i))} style={{
                                    background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14,
                                }}>×</button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        value={imageInput}
                        onChange={e => setImageInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
                        placeholder="粘贴图片URL后回车"
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <button onClick={addImage} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>添加</button>
                </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}><IconTag size={14} style={{ marginRight: 4, verticalAlign: -2 }} />标签</label>
                <TagInput value={form.tags} onChange={tags => update('tags', tags)} />
            </div>

            {/* Account & Persona */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                    <label style={labelStyle}><IconUser size={14} style={{ marginRight: 4, verticalAlign: -2 }} />发布账号</label>
                    <select value={form.account_id} onChange={e => update('account_id', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">不指定</option>
                        {accounts.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name}{a.alias ? ` (${a.alias})` : ''}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>人设</label>
                    <select value={form.persona_id} onChange={e => update('persona_id', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">不指定</option>
                        {personas.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onCancel} style={btnSecondaryStyle}>取消</button>
                <button
                    onClick={() => form.title && onSubmit(form)}
                    disabled={!form.title}
                    style={{
                        ...btnPrimaryStyle,
                        background: form.title ? '#ff2442' : '#ccc',
                        cursor: form.title ? 'pointer' : 'not-allowed',
                    }}
                >
                    {submitLabel}
                </button>
            </div>
        </div>
    );
}

/* ─── Schedule Dialog ─── */
function ScheduleDialog({
    contentId, accounts, onClose,
}: {
    contentId: string;
    accounts: any[];
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [accountId, setAccountId] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');

    const scheduleMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/schedule', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-content'] });
            onClose();
        },
    });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>📅 排期发布</h3>
                <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>发布账号</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">选择账号</option>
                        {accounts.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>发布时间</label>
                    <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={e => setScheduledAt(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondaryStyle}>取消</button>
                    <button
                        onClick={() => accountId && scheduledAt && scheduleMutation.mutate({
                            content_id: contentId, account_id: accountId, scheduled_at: scheduledAt,
                        })}
                        disabled={!accountId || !scheduledAt}
                        style={{
                            ...btnPrimaryStyle,
                            background: (accountId && scheduledAt) ? '#ff2442' : '#ccc',
                            cursor: (accountId && scheduledAt) ? 'pointer' : 'not-allowed',
                        }}
                    >
                        确认排期
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Detail Modal ─── */
function ContentDetailModal({ contentId, onClose }: { contentId: string; onClose: () => void }) {
    const { data } = useQuery({
        queryKey: ['xhs-content-detail', contentId],
        queryFn: () => fetchJson(`/xhs/content/${contentId}`),
    });
    const c = data as any;
    if (!c) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh',
                overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{c.title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <IconX size={18} />
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        background: `${STATUS_COLORS[c.status] || '#94a3b8'}15`,
                        color: STATUS_COLORS[c.status] || '#94a3b8', fontSize: 12, fontWeight: 500,
                    }}>
                        {STATUS_LABELS[c.status] || c.status}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {c.note_type === 'video' ? '🎬 视频' : '📷 图文'}
                    </span>
                    {c.ai_generated && (
                        <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 500 }}>🤖 AI生成</span>
                    )}
                </div>
                {c.content && (
                    <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {c.content}
                    </div>
                )}
                {c.images && c.images.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>图片 ({c.images.length})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {c.images.map((img: any, i: number) => (
                                <div key={i} style={{
                                    width: 120, height: 120, borderRadius: 8, overflow: 'hidden',
                                    background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {img.url ? (
                                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <IconPhoto size={24} color="#94a3b8" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {c.tags && c.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {c.tags.map((tag: string, i: number) => (
                            <span key={i} style={{
                                padding: '2px 8px', borderRadius: 4, background: '#ff244215',
                                color: '#ff2442', fontSize: 12,
                            }}>{tag}</span>
                        ))}
                    </div>
                )}
                <div style={{ fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', gap: 16 }}>
                    <span>创建: {c.created_at ? new Date(c.created_at).toLocaleString('zh-CN') : '-'}</span>
                    {c.published_at && <span>发布: {new Date(c.published_at).toLocaleString('zh-CN')}</span>}
                    {c.xhs_note_id && <span>笔记ID: {c.xhs_note_id}</span>}
                </div>
            </div>
        </div>
    );
}

/* ─── Styles ─── */
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' };
const btnPrimaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600 };
const btnSecondaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 };

/* ─── Main Component ─── */
export default function ContentList() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [viewingId, setViewingId] = useState<string | null>(null);
    const [schedulingId, setSchedulingId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['xhs-content', statusFilter],
        queryFn: () => fetchJson(`/xhs/content?${statusFilter ? `status=${statusFilter}` : ''}`),
    });

    const { data: accountsData } = useQuery({
        queryKey: ['xhs-accounts'],
        queryFn: () => fetchJson('/xhs/accounts'),
    });

    const { data: personasData } = useQuery({
        queryKey: ['xhs-personas'],
        queryFn: () => fetchJson('/xhs/personas'),
    });

    const accounts = (accountsData as any)?.items || [];
    const personas = (personasData as any)?.items || [];

    const createMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/content', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-content'] });
            setShowCreate(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...body }: any) => fetchJson(`/xhs/content/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-content'] });
            setEditingItem(null);
        },
    });

    const publishMutation = useMutation({
        mutationFn: ({ contentId, accountId }: { contentId: string; accountId?: string }) =>
            fetchJson('/xhs/publish', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content_id: contentId, account_id: accountId || undefined }),
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['xhs-content'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/xhs/content/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['xhs-content'] }),
    });

    const items = (data as any)?.items || [];

    const handlePublish = useCallback((item: any) => {
        const accountId = item.account_id || accounts[0]?.id;
        if (confirm(`确定发布「${item.title}」？`)) {
            publishMutation.mutate({ contentId: item.id, accountId });
        }
    }, [accounts, publishMutation]);

    const handleDelete = useCallback((item: any) => {
        if (confirm(`确定删除「${item.title}」？此操作不可恢复。`)) {
            deleteMutation.mutate(item.id);
        }
    }, [deleteMutation]);

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {STATUS_FILTERS.map(s => (
                        <button key={s.key} onClick={() => setStatusFilter(s.key)} style={{
                            padding: '6px 14px', borderRadius: 6,
                            border: '1px solid', borderColor: statusFilter === s.key ? '#ff2442' : '#e2e8f0',
                            background: statusFilter === s.key ? '#ff244210' : '#ffffff',
                            color: statusFilter === s.key ? '#ff2442' : '#64748b',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        }}>
                            {s.label}
                        </button>
                    ))}
                </div>
                <button onClick={() => { setShowCreate(!showCreate); setEditingItem(null); }} style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #ff2442, #ff6b81)',
                    color: '#ffffff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <IconPlus size={16} /> 新建内容
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <ContentForm
                    accounts={accounts}
                    personas={personas}
                    onSubmit={data => createMutation.mutate(data)}
                    onCancel={() => setShowCreate(false)}
                    submitLabel="保存草稿"
                />
            )}

            {/* Edit form */}
            {editingItem && (
                <ContentForm
                    initial={{
                        title: editingItem.title || '',
                        content: editingItem.content || '',
                        note_type: editingItem.note_type || 'image',
                        images: editingItem.images || [],
                        tags: editingItem.tags || [],
                        account_id: editingItem.account_id || '',
                        persona_id: editingItem.persona_id || '',
                    }}
                    accounts={accounts}
                    personas={personas}
                    onSubmit={data => updateMutation.mutate({ id: editingItem.id, ...data })}
                    onCancel={() => setEditingItem(null)}
                    submitLabel="保存修改"
                />
            )}

            {/* Content list */}
            <div style={{
                background: '#ffffff', borderRadius: 12,
                border: '1px solid #e8ecf1', overflow: 'hidden',
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
                                {['标题', '类型', '状态', '标签', '创建时间', '操作'].map(h => (
                                    <th key={h} style={{
                                        padding: '12px 16px', textAlign: h === '操作' ? 'right' : 'left',
                                        fontWeight: 600, color: '#64748b',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span style={{ cursor: 'pointer', color: '#1e293b' }} onClick={() => setViewingId(item.id)}>
                                            {item.title}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                                        {item.note_type === 'video' ? '🎬 视频' : '📷 图文'}
                                    </td>
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
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {(item.tags || []).slice(0, 3).map((tag: string, i: number) => (
                                                <span key={i} style={{
                                                    padding: '1px 6px', borderRadius: 3, background: '#ff244210',
                                                    color: '#ff2442', fontSize: 11,
                                                }}>{tag}</span>
                                            ))}
                                            {(item.tags || []).length > 3 && (
                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>+{item.tags.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                                        {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                            <button onClick={() => setViewingId(item.id)} style={actionBtnStyle} title="查看">
                                                <IconEye size={15} />
                                            </button>
                                            <button onClick={() => { setEditingItem(item); setShowCreate(false); }} style={actionBtnStyle} title="编辑">
                                                <IconEdit size={15} />
                                            </button>
                                            {(item.status === 'draft' || item.status === 'failed') && (
                                                <button onClick={() => handlePublish(item)} style={{ ...actionBtnStyle, color: '#ff2442' }} title="发布">
                                                    <IconSend size={15} />
                                                </button>
                                            )}
                                            {(item.status === 'draft' || item.status === 'failed') && (
                                                <button onClick={() => setSchedulingId(item.id)} style={{ ...actionBtnStyle, color: '#f59e0b' }} title="排期">
                                                    <IconCalendar size={15} />
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(item)} style={{ ...actionBtnStyle, color: '#ef4444' }} title="删除">
                                                <IconTrash size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            {viewingId && <ContentDetailModal contentId={viewingId} onClose={() => setViewingId(null)} />}
            {schedulingId && (
                <ScheduleDialog
                    contentId={schedulingId}
                    accounts={accounts}
                    onClose={() => setSchedulingId(null)}
                />
            )}

            {/* Publish feedback */}
            {publishMutation.isPending && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, padding: '12px 20px',
                    borderRadius: 8, background: '#3b82f6', color: '#fff', fontSize: 13,
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)', zIndex: 1000,
                }}>
                    ⏳ 发布中...
                </div>
            )}
        </div>
    );
}

const actionBtnStyle: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 4, border: 'none',
    background: 'transparent', color: '#64748b', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
};
