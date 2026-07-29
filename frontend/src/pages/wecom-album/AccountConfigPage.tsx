/**
 * WeChat Business Album — System Settings page (Tabbed layout).
 *
 * Tab 1: 基础设置 — szwego token, connection, sync hours
 * Tab 2: AI清洗 — model selector, prompts, batch size, test
 * Tab 3: 同步日志 — sync buttons, sync log list
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconRefresh, IconCheck, IconX } from '@tabler/icons-react';

type TabKey = 'basic' | 'ai' | 'logs';

export default function AccountConfigPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [activeTab, setActiveTab] = useState<TabKey>('basic');

    const { data: account } = useQuery({
        queryKey: ['wecom-album-account'],
        queryFn: () => fetchJson<any>('/wecom-album/account'),
    });

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'basic', label: isChinese ? '基础设置' : 'Basic Settings' },
        { key: 'ai', label: isChinese ? 'AI清洗' : 'AI Cleaning' },
        { key: 'logs', label: isChinese ? '同步日志' : 'Sync Logs' },
    ];

    return (
        <div style={{ padding: 32, maxWidth: 800 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {t('wecomAlbum.config.title', '系统设置')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                {t('wecomAlbum.config.desc', '配置微商相册账号和AI清洗模型')}
            </p>

            {/* Connection status */}
            {account?.configured && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: account.is_active ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${account.is_active ? '#bbf7d0' : '#fecaca'}`,
                        marginBottom: 20,
                        fontSize: 14,
                    }}
                >
                    {account.is_active ? <IconCheck size={16} color="#22c55e" /> : <IconX size={16} color="#ef4444" />}
                    <span>
                        {account.is_active
                            ? (isChinese ? `已连接 — ${account.album_name || '未知'}` : `Connected — ${account.album_name || 'Unknown'}`)
                            : (isChinese ? `连接异常: ${account.last_error || '未知错误'}` : `Error: ${account.last_error || 'Unknown'}`)}
                    </span>
                </div>
            )}

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-primary)', marginBottom: 24 }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 20px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
                            color: activeTab === tab.key ? '#4f46e5' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.key ? 600 : 400,
                            fontSize: 14,
                            cursor: 'pointer',
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'basic' && <BasicSettingsTab />}
            {activeTab === 'ai' && <AICleaningTab />}
            {activeTab === 'logs' && <SyncLogsTab />}
        </div>
    );
}


/* ══════════════════════════════════════════════════════════════════════════════
   Tab 1: Basic Settings — szwego token, connection test, sync hours
   ══════════════════════════════════════════════════════════════════════════════ */

function BasicSettingsTab() {
    const { i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [token, setToken] = useState('');
    const [staleHours, setStaleHours] = useState(1);

    const { data: account } = useQuery({
        queryKey: ['wecom-album-account'],
        queryFn: () => fetchJson<any>('/wecom-album/account'),
    });

    useEffect(() => {
        if (account?.configured) {
            setStaleHours(account.product_sync_stale_hours ?? 1);
        }
    }, [account]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            return fetchJson<any>('/wecom-album/account', {
                method: 'PUT',
                body: JSON.stringify({
                    token: token || account?.token || '',
                    product_sync_stale_hours: staleHours,
                    ai_model_id: account?.ai_model_id || null,
                    ai_batch_limit: account?.ai_batch_limit ?? 20,
                    ai_timeout_seconds: account?.ai_timeout_seconds ?? 60,
                    ai_max_tokens: account?.ai_max_tokens ?? 2048,
                    ai_prompt_system: account?.ai_prompt_system || null,
                    ai_prompt_user_template: account?.ai_prompt_user_template || null,
                }),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '保存成功' : 'Saved');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-account'] });
        },
        onError: (err: any) => toast.error(err?.detail || 'Failed'),
    });

    const testMutation = useMutation({
        mutationFn: async () => fetchJson<any>('/wecom-album/test-connection', { method: 'POST' }),
        onSuccess: (data) => toast.success(isChinese ? `连接成功 — ${data.album_name}` : `Connected — ${data.album_name}`),
        onError: (err: any) => toast.error(err?.detail || (isChinese ? '连接失败' : 'Failed')),
    });

    return (
        <div>
            {/* Token */}
            <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>szwego Token</label>
                <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={account?.configured ? (isChinese ? '已设置，留空保持不变' : 'Set, leave empty to keep') : (isChinese ? '请输入 szwego Token' : 'Enter token')}
                    style={inputStyle}
                />
            </div>

            {/* Sync hours */}
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{isChinese ? '同步时间窗口（小时）' : 'Sync time window (hours)'}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                        type="number"
                        value={staleHours}
                        onChange={(e) => setStaleHours(parseInt(e.target.value) || 1)}
                        min={1} max={168}
                        style={{ ...inputStyle, width: 120 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {isChinese ? '同步时只拉取最近 N 小时更新的商品' : 'Only sync products updated in the last N hours'}
                    </span>
                </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={primaryBtnStyle}
                >
                    {saveMutation.isPending ? '...' : (isChinese ? '保存' : 'Save')}
                </button>
                <button
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                    style={outlineBtnStyle}
                >
                    {testMutation.isPending ? '...' : (isChinese ? '测试连接' : 'Test')}
                </button>
            </div>
        </div>
    );
}


/* ══════════════════════════════════════════════════════════════════════════════
   Tab 2: AI Cleaning — model selector, prompts, batch, timeout, test
   ══════════════════════════════════════════════════════════════════════════════ */

function AICleaningTab() {
    const { i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [aiModelId, setAiModelId] = useState('');
    const [aiBatchLimit, setAiBatchLimit] = useState(20);
    const [aiTimeout, setAiTimeout] = useState(60);
    const [aiMaxTokens, setAiMaxTokens] = useState(2048);
    const [aiPromptSystem, setAiPromptSystem] = useState('');
    const [aiPromptUser, setAiPromptUser] = useState('');
    const [testTitle, setTestTitle] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const { data: account } = useQuery({
        queryKey: ['wecom-album-account'],
        queryFn: () => fetchJson<any>('/wecom-album/account'),
    });

    const { data: llmModels } = useQuery({
        queryKey: ['llm-models'],
        queryFn: () => fetchJson<any[]>('/enterprise/llm-models'),
    });

    useEffect(() => {
        if (account?.configured) {
            setAiModelId(account.ai_model_id ?? '');
            setAiBatchLimit(account.ai_batch_limit ?? 20);
            setAiTimeout(account.ai_timeout_seconds ?? 60);
            setAiMaxTokens(account.ai_max_tokens ?? 2048);
            setAiPromptSystem(account.ai_prompt_system ?? '');
            setAiPromptUser(account.ai_prompt_user_template ?? '');
        }
    }, [account]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            return fetchJson<any>('/wecom-album/account', {
                method: 'PUT',
                body: JSON.stringify({
                    token: account?.token || '',
                    product_sync_stale_hours: account?.product_sync_stale_hours ?? 1,
                    ai_model_id: aiModelId || null,
                    ai_batch_limit: aiBatchLimit,
                    ai_timeout_seconds: aiTimeout,
                    ai_max_tokens: aiMaxTokens,
                    ai_prompt_system: aiPromptSystem || null,
                    ai_prompt_user_template: aiPromptUser || null,
                }),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '保存成功' : 'Saved');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-account'] });
        },
        onError: (err: any) => toast.error(err?.detail || 'Failed'),
    });

    const models: any[] = Array.isArray(llmModels) ? llmModels : [];

    return (
        <div>
            {/* AI Model */}
            <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{isChinese ? '清洗 AI 模型' : 'AI Model'}</label>
                <select value={aiModelId} onChange={(e) => setAiModelId(e.target.value)} style={selectStyle}>
                    <option value="">{isChinese ? '-- 请选择 --' : '-- Select --'}</option>
                    {models.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.label || m.model} ({m.provider})</option>
                    ))}
                </select>
            </div>

            {/* Batch / Timeout / Max Tokens */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{isChinese ? '批量大小' : 'Batch Size'}</label>
                    <input type="number" value={aiBatchLimit} onChange={(e) => setAiBatchLimit(parseInt(e.target.value) || 20)} min={1} max={100} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{isChinese ? '超时（秒）' : 'Timeout (s)'}</label>
                    <input type="number" value={aiTimeout} onChange={(e) => setAiTimeout(parseInt(e.target.value) || 60)} min={10} max={300} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{isChinese ? '最大输出 Token' : 'Max Tokens'}</label>
                    <input type="number" value={aiMaxTokens} onChange={(e) => setAiMaxTokens(parseInt(e.target.value) || 2048)} min={256} max={128000} style={inputStyle} />
                </div>
            </div>

            {/* System prompt */}
            <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{isChinese ? 'System Prompt（留空用默认）' : 'System Prompt (default if empty)'}</label>
                <textarea value={aiPromptSystem} onChange={(e) => setAiPromptSystem(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }} />
            </div>

            {/* User prompt template */}
            <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>{isChinese ? 'User Prompt 模板（{title} 为占位符）' : 'User Prompt Template ({title} placeholder)'}</label>
                <textarea value={aiPromptUser} onChange={(e) => setAiPromptUser(e.target.value)} rows={5} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }} />
            </div>

            {/* Save */}
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={primaryBtnStyle}>
                {saveMutation.isPending ? '...' : (isChinese ? '保存清洗设置' : 'Save Cleaning Settings')}
            </button>

            {/* Test */}
            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text-primary)' }}>
                    {isChinese ? '测试清洗效果' : 'Test Cleaning'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder={isChinese ? '输入测试标题，留空用示例' : 'Test title, empty for sample'}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                        onClick={async () => {
                            setTesting(true); setTestResult(null);
                            try {
                                const res = await fetchJson<any>('/wecom-album/ai-clean/test', {
                                    method: 'POST', body: JSON.stringify({ title: testTitle || undefined }),
                                });
                                setTestResult(res);
                            } catch (err: any) { setTestResult({ success: false, error: err?.detail || err?.message }); }
                            setTesting(false);
                        }}
                        disabled={testing}
                        style={{ ...primaryBtnStyle, background: '#7c3aed' }}
                    >
                        {testing ? '...' : (isChinese ? '测试' : 'Test')}
                    </button>
                </div>
                {testResult && (
                    <div style={{ padding: 12, borderRadius: 8, fontSize: 13, background: testResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`, color: testResult.success ? '#166534' : '#991b1b' }}>
                        {testResult.success ? (
                            <div>
                                <div><strong>Model:</strong> {testResult.model}</div>
                                {testResult.parsed && <div><strong>{isChinese ? '清洗标题' : 'Clean'}:</strong> {testResult.parsed.clean_title} | <strong>Cost:</strong> {testResult.parsed.cost} | <strong>Sync:</strong> {testResult.parsed.sync}</div>}
                                <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', fontSize: 12 }}>{isChinese ? '原始响应' : 'Raw'}</summary><pre style={{ marginTop: 4, fontSize: 12, whiteSpace: 'pre-wrap' }}>{testResult.raw_response}</pre></details>
                            </div>
                        ) : <div>{testResult.error}</div>}
                    </div>
                )}
            </div>
        </div>
    );
}


/* ══════════════════════════════════════════════════════════════════════════════
   Tab 3: Sync Logs — sync buttons, log list
   ══════════════════════════════════════════════════════════════════════════════ */

function SyncLogsTab() {
    const { i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const { data: account } = useQuery({
        queryKey: ['wecom-album-account'],
        queryFn: () => fetchJson<any>('/wecom-album/account'),
    });

    const syncSuppliersMutation = useMutation({
        mutationFn: async () => fetchJson<any>('/wecom-album/sync/suppliers', { method: 'POST' }),
        onSuccess: (data) => {
            toast.success(isChinese ? `供应商同步完成: ${data.created} 新增, ${data.updated} 更新` : `Suppliers: ${data.created} new, ${data.updated} updated`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-suppliers'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => toast.error(err?.detail || (isChinese ? '同步失败' : 'Failed')),
    });

    const syncProductsMutation = useMutation({
        mutationFn: async () => fetchJson<any>('/wecom-album/sync/products', { method: 'POST' }),
        onSuccess: (data) => {
            toast.success(isChinese ? `商品同步完成: ${data.created} 新增, ${data.updated} 更新, ${data.skipped} 跳过` : `Products: ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => toast.error(err?.detail || (isChinese ? '同步失败' : 'Failed')),
    });

    return (
        <div>
            {/* Sync buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <button
                    onClick={() => syncSuppliersMutation.mutate()}
                    disabled={syncSuppliersMutation.isPending}
                    style={{ ...outlineBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <IconRefresh size={16} />
                    {syncSuppliersMutation.isPending ? (isChinese ? '同步中...' : 'Syncing...') : (isChinese ? '同步供应商' : 'Sync Suppliers')}
                </button>
                <button
                    onClick={() => syncProductsMutation.mutate()}
                    disabled={syncProductsMutation.isPending}
                    style={{ ...outlineBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <IconRefresh size={16} />
                    {syncProductsMutation.isPending ? (isChinese ? '同步中...' : 'Syncing...') : (isChinese ? '同步商品' : 'Sync Products')}
                </button>
            </div>

            {/* Sync status */}
            <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text-primary)' }}>
                    {isChinese ? '同步状态' : 'Sync Status'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div>{isChinese ? '上次供应商同步' : 'Last supplier sync'}: <strong>{account?.last_owner_sync_at ? new Date(account.last_owner_sync_at).toLocaleString() : (isChinese ? '未同步' : 'Never')}</strong></div>
                    <div>{isChinese ? '上次商品同步' : 'Last product sync'}: <strong>{account?.last_product_sync_at ? new Date(account.last_product_sync_at).toLocaleString() : (isChinese ? '未同步' : 'Never')}</strong></div>
                </div>
            </div>

            {/* Last sync error */}
            {account?.last_error && (
                <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 13, color: '#991b1b', marginBottom: 24 }}>
                    <strong>{isChinese ? '上次错误' : 'Last Error'}:</strong> {account.last_error}
                </div>
            )}

            {/* Sync info */}
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
                <div>• {isChinese ? '同步供应商：从 szwego 拉取好友列表作为供应商' : 'Sync Suppliers: fetch friends list from szwego as suppliers'}</div>
                <div>• {isChinese ? '同步商品：按每个启用供应商的相册拉取最近 N 小时的商品' : 'Sync Products: fetch products from each active supplier\'s album (last N hours)'}</div>
                <div>• {isChinese ? '同步完成后可到商品列表查看并执行 AI 清洗' : 'After sync, go to Products to run AI cleaning'}</div>
            </div>
        </div>
    );
}


/* ══════════════════════════════════════════════════════════════════════════════
   Shared styles
   ══════════════════════════════════════════════════════════════════════════════ */

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' };

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)',
    borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)',
    borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const outlineBtnStyle: React.CSSProperties = {
    padding: '10px 20px', background: 'var(--bg-primary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 14, cursor: 'pointer',
};
