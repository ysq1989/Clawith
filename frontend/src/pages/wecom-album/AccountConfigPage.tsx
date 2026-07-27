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

            {/* AI Model selector */}
            <div style={{ marginBottom: 24 }}>
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
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
                    {isChinese ? '用于商品标题清洗和成本价提取' : 'Used for product title cleaning and cost extraction'}
                </span>
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
