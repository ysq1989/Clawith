/**
 * Platform Apps Tab — Admin platform-level application management.
 * Shows all available apps with their platform configs (supply chains, crawl settings, etc.)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import {
    IconPlug,
    IconPlus,
    IconTrash,
    IconRefresh,
    IconCheck,
    IconX,
    IconCloudUpload,
    IconSettings,
    IconShoppingBag,
} from '@tabler/icons-react';

/* ─── App Definitions ─── */
const APP_DEFINITIONS = [
    {
        id: 'erp',
        name: 'ERP',
        description: '企业资源管理系统',
        icon: '📊',
        color: '#4f46e5',
        hasSupplyChains: false,
    },
    {
        id: 'xhs',
        name: '小红书',
        description: '小红书内容运营系统',
        icon: '📕',
        color: '#dc2626',
        hasSupplyChains: false,
    },
    {
        id: 'product_hub',
        name: '选品中心',
        description: '商品选品池与供应链管理',
        icon: '🛍️',
        color: '#059669',
        hasSupplyChains: true,
    },
    {
        id: 'wecom_album',
        name: '微商相册',
        description: '微商相册供应商与商品同步',
        icon: '📷',
        color: '#7c3aed',
        hasWecomAlbum: true,
    },
];

/* ─── Supply Chain Manager ─── */
function SupplyChainManager() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [showAdd, setShowAdd] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formToken, setFormToken] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const { data: chains, isLoading } = useQuery({
        queryKey: ['admin-supply-chains'],
        queryFn: () => fetchJson<any>('/product-hub/admin/supply-chains'),
    });

    const createMutation = useMutation({
        mutationFn: (body: any) =>
            fetchJson('/product-hub/admin/supply-chains', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-supply-chains'] });
            toast.success(isChinese ? '供应链已创建' : 'Supply chain created');
            setShowAdd(false);
            resetForm();
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            fetchJson(`/product-hub/admin/supply-chains/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-supply-chains'] });
            toast.success(isChinese ? '已删除' : 'Deleted');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const testMutation = useMutation({
        mutationFn: (token: string) =>
            fetchJson('/product-hub/admin/test-connection', {
                method: 'POST',
                body: JSON.stringify({ token }),
            }),
        onMutate: () => { setTesting(true); setTestResult(null); },
        onSuccess: (data: any) => {
            setTestResult({ ok: true, data });
            toast.success(isChinese ? '连接成功' : 'Connection OK');
        },
        onError: (err: any) => {
            setTestResult({ ok: false, error: err?.message });
            toast.error(err?.message || 'Connection failed');
        },
        onSettled: () => setTesting(false),
    });

    const resetForm = () => {
        setFormName('');
        setFormDesc('');
        setFormToken('');
        setTestResult(null);
    };

    const chainsList: any[] = Array.isArray(chains) ? chains : [];

    return (
        <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {isChinese ? '供应链管理' : 'Supply Chain Management'}
                </h3>
                <button
                    onClick={() => setShowAdd(true)}
                    style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: 'var(--color-primary)', color: 'white',
                        fontWeight: 500, fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}
                >
                    <IconPlus size={14} />
                    {isChinese ? '添加供应链' : 'Add Supply Chain'}
                </button>
            </div>

            {chainsList.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    {isChinese ? '暂无供应链配置' : 'No supply chains configured'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {chainsList.map((chain: any) => (
                        <div
                            key={chain.id}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: 16, background: 'var(--bg-primary)',
                                border: '1px solid var(--border-primary)', borderRadius: 10,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: 24 }}>🔗</div>
                                <div>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{chain.display_name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {chain.source_platform} · {chain.products_count ?? 0} {isChinese ? '个商品' : 'products'}
                                        {chain.last_crawl_at && ` · ${isChinese ? '上次采集' : 'Last crawl'}: ${new Date(chain.last_crawl_at).toLocaleDateString()}`}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                    style={{
                                        padding: '2px 8px', borderRadius: 4, fontSize: 11,
                                        background: chain.is_active ? '#dcfce7' : '#fef2f2',
                                        color: chain.is_active ? '#166534' : '#991b1b',
                                    }}
                                >
                                    {chain.is_active ? (isChinese ? '启用' : 'Active') : (isChinese ? '停用' : 'Inactive')}
                                </span>
                                <button
                                    onClick={() => {
                                        if (confirm(isChinese ? `确定删除「${chain.display_name}」吗？` : `Delete "${chain.display_name}"?`)) {
                                            deleteMutation.mutate(chain.id);
                                        }
                                    }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                                >
                                    <IconTrash size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Supply Chain Dialog */}
            {showAdd && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    onClick={() => { setShowAdd(false); resetForm(); }}
                >
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 12, width: 480, padding: 24 }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                            {isChinese ? '添加供应链' : 'Add Supply Chain'}
                        </h3>

                        <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                            {isChinese ? '显示名称' : 'Display Name'}
                        </label>
                        <input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={isChinese ? '如：华南女装供应链' : 'e.g. South China Fashion Supply'}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', marginBottom: 12, fontSize: 14, boxSizing: 'border-box' }}
                        />

                        <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                            {isChinese ? '描述（可选）' : 'Description (optional)'}
                        </label>
                        <input
                            value={formDesc}
                            onChange={(e) => setFormDesc(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', marginBottom: 12, fontSize: 14, boxSizing: 'border-box' }}
                        />

                        <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                            微商相册 Token
                        </label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <input
                                value={formToken}
                                onChange={(e) => setFormToken(e.target.value)}
                                placeholder="eyJ0eXA..."
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                            />
                            <button
                                onClick={() => formToken && testMutation.mutate(formToken)}
                                disabled={testing || !formToken}
                                style={{
                                    padding: '8px 12px', borderRadius: 8,
                                    border: '1px solid var(--color-primary)', background: 'white',
                                    color: 'var(--color-primary)', cursor: testing ? 'wait' : 'pointer',
                                    fontSize: 13, whiteSpace: 'nowrap',
                                }}
                            >
                                {testing ? '...' : (isChinese ? '测试连接' : 'Test')}
                            </button>
                        </div>

                        {testResult && (
                            <div style={{
                                padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13,
                                background: testResult.ok ? '#f0fdf4' : '#fef2f2',
                                color: testResult.ok ? '#166534' : '#991b1b',
                                border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`,
                            }}>
                                {testResult.ok ? (
                                    <div>
                                        <IconCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                                        {isChinese ? '连接成功' : 'Connected'}:
                                        {testResult.data?.album_name} ({testResult.data?.total_fans} {isChinese ? '粉丝' : 'fans'})
                                    </div>
                                ) : (
                                    <div>
                                        <IconX size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                                        {testResult.error}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button onClick={() => { setShowAdd(false); resetForm(); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 14 }}>
                                {isChinese ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => {
                                    if (!formName.trim()) { toast.error(isChinese ? '请输入名称' : 'Name required'); return; }
                                    createMutation.mutate({
                                        display_name: formName.trim(),
                                        description: formDesc.trim() || null,
                                        source_platform: 'weixin_album',
                                        crawl_config: formToken ? { token: formToken, max_pages: 10 } : {},
                                    });
                                }}
                                disabled={createMutation.isPending}
                                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                            >
                                {createMutation.isPending ? '...' : (isChinese ? '创建' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


/* ─── WeChat Album Manager ─── */
function WecomAlbumManager() {
    const { i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    return (
        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <IconPlug size={16} style={{ color: '#7c3aed' }} />
                <span style={{ fontWeight: 500 }}>
                    {isChinese ? 'szwego API 对接' : 'szwego API Integration'}
                </span>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
                {isChinese
                    ? '每个公司可在「微商相册」模块中独立配置 szwego Token。平台无需集中管理 Token，公司自行配置即可。'
                    : 'Each company can configure their own szwego Token in the WeChat Album module. No centralized token management needed.'}
            </p>
        </div>
    );
}


/* ─── Main Component ─── */
export default function PlatformAppsTab() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    return (
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                {isChinese ? '应用管理' : 'Application Management'}
            </h2>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24, fontSize: 14 }}>
                {isChinese ? '管理平台级应用配置，包括供应链接入、AI 清洗设置等' : 'Manage platform-level app configurations'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {APP_DEFINITIONS.map((app) => (
                    <div
                        key={app.id}
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 12,
                            overflow: 'hidden',
                        }}
                    >
                        {/* App header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                            <span style={{ fontSize: 28 }}>{app.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{app.name}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{app.description}</div>
                            </div>
                            <span style={{
                                padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                background: '#f0fdf4', color: '#166534',
                            }}>
                                {isChinese ? '已部署' : 'Deployed'}
                            </span>
                        </div>

                        {/* App-specific config */}
                        {app.hasSupplyChains && (
                            <div style={{ padding: '0 20px 20px' }}>
                                <SupplyChainManager />
                            </div>
                        )}

                        {(app as any).hasWecomAlbum && (
                            <div style={{ padding: '0 20px 20px' }}>
                                <WecomAlbumManager />
                            </div>
                        )}

                        {!app.hasSupplyChains && !(app as any).hasWecomAlbum && (
                            <div style={{ padding: '16px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                {isChinese ? '该应用暂无平台级配置项' : 'No platform-level configuration for this app'}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
