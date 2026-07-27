/**
 * WeChat Business Album — System Settings page.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconRefresh, IconCheck, IconX } from '@tabler/icons-react';

export default function AccountConfigPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [token, setToken] = useState('');
    const [staleHours, setStaleHours] = useState(1);
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
            setStaleHours(account.product_sync_stale_hours ?? 1);
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
                    token: token || account?.token || '',
                    product_sync_stale_hours: staleHours,
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
            toast.success(isChinese ? '保存成功' : 'Saved successfully');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-account'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || err?.message || (isChinese ? '保存失败' : 'Save failed'));
        },
    });

    const testMutation = useMutation({
        mutationFn: async () => {
            return fetchJson<any>('/wecom-album/test-connection', { method: 'POST' });
        },
        onSuccess: (data) => {
            toast.success(isChinese ? `连接成功 — ${data.album_name}` : `Connected — ${data.album_name}`);
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '连接失败' : 'Connection failed'));
        },
    });

    const syncSuppliersMutation = useMutation({
        mutationFn: async () => {
            return fetchJson<any>('/wecom-album/sync/suppliers', { method: 'POST' });
        },
        onSuccess: (data) => {
            toast.success(isChinese
                ? `同步完成: ${data.created} 新增, ${data.updated} 更新`
                : `Sync done: ${data.created} new, ${data.updated} updated`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-suppliers'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '同步失败' : 'Sync failed'));
        },
    });

    const syncProductsMutation = useMutation({
        mutationFn: async () => {
            return fetchJson<any>('/wecom-album/sync/products', { method: 'POST' });
        },
        onSuccess: (data) => {
            toast.success(isChinese
                ? `同步完成: ${data.created} 新增, ${data.updated} 更新, ${data.skipped} 跳过`
                : `Sync done: ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '同步失败' : 'Sync failed'));
        },
    });

    const models: any[] = Array.isArray(llmModels) ? llmModels : [];

    return (
        <div style={{ padding: 32, maxWidth: 700 }}>
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

            {/* Token input */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                    szwego Token
                </label>
                <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={account?.configured ? (isChinese ? '已设置，留空保持不变' : 'Set, leave empty to keep') : (isChinese ? '请输入 szwego Token' : 'Enter szwego token')}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Stale hours */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                    {isChinese ? '同步时间窗口（小时）' : 'Sync time window (hours)'}
                </label>
                <input
                    type="number"
                    value={staleHours}
                    onChange={(e) => setStaleHours(parseInt(e.target.value) || 1)}
                    min={1}
                    max={168}
                    style={{
                        width: 120,
                        padding: '10px 12px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                    }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                    {isChinese ? '同步时只拉取最近 N 小时更新的商品' : 'Only sync products updated in the last N hours'}
                </span>
            </div>

            {/* ── 清洗设置 ── */}
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', paddingTop: 20 }}>
                {isChinese ? '清洗设置' : 'Cleaning Settings'}
            </h2>

            {/* AI Model selector */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                    {isChinese ? '清洗 AI 模型' : 'AI Cleaning Model'}
                </label>
                <select
                    value={aiModelId}
                    onChange={(e) => setAiModelId(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                    }}
                >
                    <option value="">{isChinese ? '-- 请选择 --' : '-- Select --'}</option>
                    {models.map((m: any) => (
                        <option key={m.id} value={m.id}>
                            {m.label || m.model} ({m.provider})
                        </option>
                    ))}
                </select>
            </div>

            {/* Batch & timeout */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                        {isChinese ? '批量大小' : 'Batch Size'}
                    </label>
                    <input
                        type="number"
                        value={aiBatchLimit}
                        onChange={(e) => setAiBatchLimit(parseInt(e.target.value) || 20)}
                        min={1}
                        max={100}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                        {isChinese ? '超时（秒）' : 'Timeout (s)'}
                    </label>
                    <input
                        type="number"
                        value={aiTimeout}
                        onChange={(e) => setAiTimeout(parseInt(e.target.value) || 60)}
                        min={10}
                        max={300}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                        {isChinese ? '最大输出 Token' : 'Max Tokens'}
                    </label>
                    <input
                        type="number"
                        value={aiMaxTokens}
                        onChange={(e) => setAiMaxTokens(parseInt(e.target.value) || 2048)}
                        min={256}
                        max={128000}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            {/* System prompt */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                    {isChinese ? 'System Prompt（留空使用默认）' : 'System Prompt (leave empty for default)'}
                </label>
                <textarea
                    value={aiPromptSystem}
                    onChange={(e) => setAiPromptSystem(e.target.value)}
                    rows={3}
                    placeholder={isChinese ? '你是商品标题清洗助手...' : 'You are a product title cleaning assistant...'}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical' }}
                />
            </div>

            {/* User prompt template */}
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                    {isChinese ? 'User Prompt 模板（{title} 为占位符）' : 'User Prompt Template ({title} is placeholder)'}
                </label>
                <textarea
                    value={aiPromptUser}
                    onChange={(e) => setAiPromptUser(e.target.value)}
                    rows={5}
                    placeholder={isChinese ? '请清洗以下商品标题并提取成本价...\n商品标题：{title}' : 'Clean the following product title...\nTitle: {title}'}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical' }}
                />
            </div>

            {/* Test section */}
            <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text-primary)' }}>
                    {isChinese ? '测试清洗效果' : 'Test Cleaning'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder={isChinese ? '输入测试标题，留空使用示例' : 'Enter test title, empty for sample'}
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    <button
                        onClick={async () => {
                            setTesting(true);
                            setTestResult(null);
                            try {
                                const res = await fetchJson<any>('/wecom-album/ai-clean/test', {
                                    method: 'POST',
                                    body: JSON.stringify({ title: testTitle || undefined }),
                                });
                                setTestResult(res);
                            } catch (err: any) {
                                setTestResult({ success: false, error: err?.detail || err?.message });
                            }
                            setTesting(false);
                        }}
                        disabled={testing}
                        style={{
                            padding: '8px 16px',
                            background: '#7c3aed',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {testing ? '...' : (isChinese ? '测试' : 'Test')}
                    </button>
                </div>
                {testResult && (
                    <div style={{
                        padding: 12,
                        borderRadius: 8,
                        fontSize: 13,
                        background: testResult.success ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                        color: testResult.success ? '#166534' : '#991b1b',
                    }}>
                        {testResult.success ? (
                            <div>
                                <div style={{ marginBottom: 4 }}>
                                    <strong>{isChinese ? '模型' : 'Model'}:</strong> {testResult.model}
                                </div>
                                {testResult.parsed && (
                                    <div>
                                        <div><strong>{isChinese ? '清洗标题' : 'Clean Title'}:</strong> {testResult.parsed.clean_title}</div>
                                        <div><strong>{isChinese ? '成本价' : 'Cost'}:</strong> {testResult.parsed.cost}</div>
                                    </div>
                                )}
                                <details style={{ marginTop: 8 }}>
                                    <summary style={{ cursor: 'pointer', fontSize: 12 }}>{isChinese ? '原始响应' : 'Raw Response'}</summary>
                                    <pre style={{ marginTop: 4, fontSize: 12, whiteSpace: 'pre-wrap' }}>{testResult.raw_response}</pre>
                                </details>
                            </div>
                        ) : (
                            <div>{testResult.error}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={{
                        padding: '10px 20px',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: saveMutation.isPending ? 0.6 : 1,
                    }}
                >
                    {saveMutation.isPending ? (isChinese ? '保存中...' : 'Saving...') : (isChinese ? '保存' : 'Save')}
                </button>
                <button
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                    style={{
                        padding: '10px 20px',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    {testMutation.isPending ? (isChinese ? '测试中...' : 'Testing...') : (isChinese ? '测试连接' : 'Test Connection')}
                </button>
            </div>

            {/* Sync section */}
            {account?.configured && account.is_active && (
                <>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                        {isChinese ? '数据同步' : 'Data Sync'}
                    </h2>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={() => syncSuppliersMutation.mutate()}
                            disabled={syncSuppliersMutation.isPending}
                            style={{
                                padding: '10px 20px',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 8,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <IconRefresh size={16} />
                            {syncSuppliersMutation.isPending
                                ? (isChinese ? '同步中...' : 'Syncing...')
                                : (isChinese ? '同步供应商' : 'Sync Suppliers')}
                        </button>
                        <button
                            onClick={() => syncProductsMutation.mutate()}
                            disabled={syncProductsMutation.isPending}
                            style={{
                                padding: '10px 20px',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 8,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <IconRefresh size={16} />
                            {syncProductsMutation.isPending
                                ? (isChinese ? '同步中...' : 'Syncing...')
                                : (isChinese ? '同步商品' : 'Sync Products')}
                        </button>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {isChinese
                            ? `上次供应商同步: ${account.last_owner_sync_at ? new Date(account.last_owner_sync_at).toLocaleString() : '未同步'}`
                            : `Last supplier sync: ${account.last_owner_sync_at ? new Date(account.last_owner_sync_at).toLocaleString() : 'Never'}`}
                        <br />
                        {isChinese
                            ? `上次商品同步: ${account.last_product_sync_at ? new Date(account.last_product_sync_at).toLocaleString() : '未同步'}`
                            : `Last product sync: ${account.last_product_sync_at ? new Date(account.last_product_sync_at).toLocaleString() : 'Never'}`}
                    </div>
                </>
            )}
        </div>
    );
}
