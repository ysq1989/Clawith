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

    const [logPage, setLogPage] = useState(1);

    const { data: logsData, isLoading: logsLoading } = useQuery({
        queryKey: ['wecom-album-sync-logs', logPage],
        queryFn: () => fetchJson<any>(`/wecom-album/sync-logs?page=${logPage}&page_size=15`),
    });

    const syncSuppliersMutation = useMutation({
        mutationFn: async () => fetchJson<any>('/wecom-album/sync/suppliers', { method: 'POST' }),
        onSuccess: (data) => {
            toast.success(isChinese ? `供应商同步完成: ${data.created} 新增, ${data.updated} 更新` : `Suppliers: ${data.created} new, ${data.updated} updated`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-suppliers'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-sync-logs'] });
        },
        onError: (err: any) => toast.error(err?.detail || (isChinese ? '同步失败' : 'Failed')),
    });

    const syncProductsMutation = useMutation({
        mutationFn: async () => fetchJson<any>('/wecom-album/sync/products', { method: 'POST' }),
        onSuccess: (data) => {
            toast.success(isChinese ? `商品同步完成: ${data.created} 新增, ${data.updated} 更新, ${data.skipped} 跳过` : `Products: ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-sync-logs'] });
        },
        onError: (err: any) => toast.error(err?.detail || (isChinese ? '同步失败' : 'Failed')),
    });

    const taskTypeMap: Record<string, string> = {
        sync_suppliers: isChinese ? '同步供应商' : 'Sync Suppliers',
        sync_products: isChinese ? '同步商品' : 'Sync Products',
        ai_clean: isChinese ? 'AI清洗' : 'AI Clean',
        push_to_pool: isChinese ? '推送到选品池' : 'Push to Pool',
    };
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
        running: { label: isChinese ? '执行中' : 'Running', color: '#2563eb', bg: '#eff6ff' },
        success: { label: isChinese ? '成功' : 'Success', color: '#16a34a', bg: '#f0fdf4' },
        failed: { label: isChinese ? '失败' : 'Failed', color: '#dc2626', bg: '#fef2f2' },
    };

    const logs: any[] = logsData?.items ?? [];
    const logTotal: number = logsData?.total ?? 0;

    return (
        <div>
            {/* Sync buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
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

            {/* Sync logs table */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {isChinese ? '同步日志' : 'Sync Logs'}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{isChinese ? '时间' : 'Time'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{isChinese ? '类型' : 'Type'}</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{isChinese ? '状态' : 'Status'}</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{isChinese ? '数量' : 'Count'}</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{isChinese ? '耗时' : 'Duration'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{isChinese ? '详情' : 'Detail'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logsLoading ? (
                            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>{isChinese ? '暂无日志' : 'No logs yet'}</td></tr>
                        ) : logs.map((log: any) => {
                            const st = statusMap[log.status] || statusMap.running;
                            return (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                                        {taskTypeMap[log.task_type] || log.task_type}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color }}>
                                            {st.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-primary)' }}>
                                        {log.items_count > 0 ? log.items_count : '-'}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {log.duration_ms != null ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-'}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.message || log.errors || '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {logTotal > 15 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                    <button onClick={() => setLogPage(Math.max(1, logPage - 1))} disabled={logPage <= 1} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: 13, opacity: logPage <= 1 ? 0.5 : 1 }}>
                        {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isChinese ? `第 ${logPage} 页，共 ${Math.ceil(logTotal / 15)} 页` : `Page ${logPage} / ${Math.ceil(logTotal / 15)}`}
                    </span>
                    <button onClick={() => setLogPage(logPage + 1)} disabled={logPage * 15 >= logTotal} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: 13, opacity: logPage * 15 >= logTotal ? 0.5 : 1 }}>
                        {isChinese ? '下一页' : 'Next'}
                    </button>
                </div>
            )}
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
