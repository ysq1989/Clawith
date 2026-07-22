/**
 * XHS Settings — Module configuration (AI, publish, personas, knowledge base).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconPlus, IconTrash, IconEdit, IconX, IconBrain, IconBook, IconSettings, IconRobot } from '@tabler/icons-react';

/* ─── Tab Config ─── */
const TABS = [
    { key: 'personas', label: '人设管理', icon: <IconBrain size={16} /> },
    { key: 'knowledge', label: '知识库', icon: <IconBook size={16} /> },
    { key: 'ai', label: 'AI 配置', icon: <IconRobot size={16} /> },
    { key: 'publish', label: '发布配置', icon: <IconSettings size={16} /> },
];

/* ─── Persona Manager ─── */
function PersonaManager() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tone, setTone] = useState('');
    const [topics, setTopics] = useState('');
    const [avoidWords, setAvoidWords] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['xhs-personas'],
        queryFn: () => fetchJson('/xhs/personas'),
    });

    const createMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/personas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-personas'] });
            resetForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...body }: any) => fetchJson(`/xhs/personas/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-personas'] });
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/xhs/personas/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['xhs-personas'] }),
    });

    const resetForm = () => {
        setShowForm(false);
        setEditId(null);
        setName(''); setDescription(''); setTone('');
        setTopics(''); setAvoidWords(''); setIsDefault(false);
    };

    const startEdit = (p: any) => {
        setEditId(p.id);
        setName(p.name);
        setDescription(p.description || '');
        setTone(p.tone || '');
        setTopics((p.topics || []).join(', '));
        setAvoidWords((p.avoid_words || []).join(', '));
        setIsDefault(p.is_default || false);
        setShowForm(true);
    };

    const handleSubmit = () => {
        const body = {
            name, description, tone,
            topics: topics.split(',').map(s => s.trim()).filter(Boolean),
            avoid_words: avoidWords.split(',').map(s => s.trim()).filter(Boolean),
            is_default: isDefault,
        };
        if (editId) {
            updateMutation.mutate({ id: editId, ...body });
        } else {
            createMutation.mutate(body);
        }
    };

    const items = (data as any)?.items || [];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    管理不同账号的内容创作风格人设，每个账号可以指定不同的人设。
                </p>
                <button onClick={() => { resetForm(); setShowForm(!showForm); }} style={addBtnStyle}>
                    <IconPlus size={14} /> 新建人设
                </button>
            </div>

            {showForm && (
                <div style={{
                    background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16,
                    border: '1px solid #e2e8f0',
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>名称 <span style={{ color: '#ef4444' }}>*</span></label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：专业编辑" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>语气风格</label>
                            <input value={tone} onChange={e => setTone(e.target.value)} placeholder="如：亲切、专业、幽默" style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <label style={labelStyle}>描述</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="人设描述..." style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                        <div>
                            <label style={labelStyle}>擅长领域（逗号分隔）</label>
                            <input value={topics} onChange={e => setTopics(e.target.value)} placeholder="如：美食, 生活, 穿搭" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>禁用词（逗号分隔）</label>
                            <input value={avoidWords} onChange={e => setAvoidWords(e.target.value)} placeholder="如：广告, 推销" style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} id="persona-default" />
                        <label htmlFor="persona-default" style={{ fontSize: 13, color: '#64748b', cursor: 'pointer' }}>设为默认人设</label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                        <button onClick={resetForm} style={btnSecondaryStyle}>取消</button>
                        <button onClick={handleSubmit} disabled={!name} style={{
                            ...btnPrimaryStyle,
                            background: name ? '#ff2442' : '#ccc',
                            cursor: name ? 'pointer' : 'not-allowed',
                        }}>{editId ? '保存' : '创建'}</button>
                    </div>
                </div>
            )}

            {isLoading ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>加载中...</div> : items.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>暂无人设，点击"新建人设"开始</div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {items.map((p: any) => (
                        <div key={p.id} style={{
                            padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
                            background: p.is_default ? '#ff244208' : '#fff',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                                    {p.is_default && <span style={{ fontSize: 11, color: '#ff2442', marginLeft: 8, fontWeight: 500 }}>默认</span>}
                                    {p.tone && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>「{p.tone}」</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => startEdit(p)} style={iconBtnStyle}><IconEdit size={14} /></button>
                                    <button onClick={() => { if (confirm('确定删除？')) deleteMutation.mutate(p.id); }} style={{ ...iconBtnStyle, color: '#ef4444' }}>
                                        <IconTrash size={14} />
                                    </button>
                                </div>
                            </div>
                            {p.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{p.description}</div>}
                            {p.topics?.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                    {p.topics.map((t: string, i: number) => (
                                        <span key={i} style={{ padding: '1px 6px', borderRadius: 3, background: '#3b82f615', color: '#3b82f6', fontSize: 11 }}>{t}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Knowledge Base Manager ─── */
function KnowledgeManager() {
    const queryClient = useQueryClient();
    const [category, setCategory] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [kCategory, setKCategory] = useState('pattern');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['xhs-knowledge', category],
        queryFn: () => fetchJson(`/xhs/knowledge${category ? `?category=${category}` : ''}`),
    });

    const createMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/knowledge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-knowledge'] });
            setShowForm(false); setTitle(''); setContent('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/xhs/knowledge/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['xhs-knowledge'] }),
    });

    const items = (data as any)?.items || [];
    const CATEGORIES = [
        { key: '', label: '全部' },
        { key: 'pattern', label: '内容模式' },
        { key: 'account', label: '账号运营' },
        { key: 'topic', label: '话题趋势' },
        { key: 'action', label: '互动策略' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {CATEGORIES.map(c => (
                        <button key={c.key} onClick={() => setCategory(c.key)} style={{
                            padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                            border: `1px solid ${category === c.key ? '#ff2442' : '#e2e8f0'}`,
                            background: category === c.key ? '#ff244210' : '#fff',
                            color: category === c.key ? '#ff2442' : '#64748b',
                        }}>{c.label}</button>
                    ))}
                </div>
                <button onClick={() => setShowForm(!showForm)} style={addBtnStyle}>
                    <IconPlus size={14} /> 添加知识
                </button>
            </div>

            {showForm && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                        <div>
                            <label style={labelStyle}>标题</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>分类</label>
                            <select value={kCategory} onChange={e => setKCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="pattern">内容模式</option>
                                <option value="account">账号运营</option>
                                <option value="topic">话题趋势</option>
                                <option value="action">互动策略</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label style={labelStyle}>内容（Markdown）</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowForm(false)} style={btnSecondaryStyle}>取消</button>
                        <button onClick={() => title && content && createMutation.mutate({ category: kCategory, title, content })} disabled={!title || !content} style={{
                            ...btnPrimaryStyle,
                            background: (title && content) ? '#ff2442' : '#ccc',
                            cursor: (title && content) ? 'pointer' : 'not-allowed',
                        }}>保存</button>
                    </div>
                </div>
            )}

            {isLoading ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>加载中...</div> : items.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>暂无知识库条目</div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {items.map((k: any) => (
                        <div key={k.id} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 500, fontSize: 13 }}>{k.title}</span>
                                    <span style={{
                                        marginLeft: 8, padding: '1px 6px', borderRadius: 3, fontSize: 11,
                                        background: '#f59e0b15', color: '#f59e0b',
                                    }}>{({ pattern: '内容模式', account: '账号运营', topic: '话题趋势', action: '互动策略' } as any)[k.category]}</span>
                                </div>
                                <button onClick={() => { if (confirm('确定删除？')) deleteMutation.mutate(k.id); }} style={{ ...iconBtnStyle, color: '#ef4444' }}>
                                    <IconTrash size={14} />
                                </button>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.6, maxHeight: 60, overflow: 'hidden' }}>
                                {k.content}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── AI Config Tab ─── */
function AIConfigTab() {
    return (
        <div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                配置 AI 内容生成的相关参数。AI 可以根据人设和知识库自动创作小红书笔记。
            </p>
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                <div>AI 内容生成功能开发中...</div>
                <div style={{ marginTop: 4, fontSize: 11 }}>完成后可以一键生成标题、正文、标签</div>
            </div>
        </div>
    );
}

/* ─── Publish Config Tab ─── */
function PublishConfigTab() {
    return (
        <div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                配置自动发布策略，包括定时发布、最佳发布时间建议等。
            </p>
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏰</div>
                <div>发布配置功能开发中...</div>
                <div style={{ marginTop: 4, fontSize: 11 }}>将支持最佳时间推荐、批量发布、发布队列管理</div>
            </div>
        </div>
    );
}

/* ─── Main ─── */
export default function XHSSettings() {
    const [activeTab, setActiveTab] = useState('personas');

    return (
        <div style={{ maxWidth: 900 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 0 }}>
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        padding: '10px 16px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderBottom: '2px solid',
                        borderBottomColor: activeTab === tab.key ? '#ff2442' : 'transparent',
                        background: activeTab === tab.key ? '#ff244208' : 'transparent',
                        color: activeTab === tab.key ? '#ff2442' : '#64748b',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div style={{
                background: '#fff', borderRadius: 12, padding: 24,
                border: '1px solid #e8ecf1',
            }}>
                {activeTab === 'personas' && <PersonaManager />}
                {activeTab === 'knowledge' && <KnowledgeManager />}
                {activeTab === 'ai' && <AIConfigTab />}
                {activeTab === 'publish' && <PublishConfigTab />}
            </div>
        </div>
    );
}

/* ─── Styles ─── */
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' };
const btnPrimaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnSecondaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 };
const addBtnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #ff2442',
    background: '#ff244210', color: '#ff2442', cursor: 'pointer', fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 4,
};
const iconBtnStyle: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 4, border: 'none',
    background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};
