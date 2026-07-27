/**
 * WeChat Business Album — Suppliers (friends) page.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconSearch, IconRefresh, IconSettings, IconX } from '@tabler/icons-react';

interface Supplier {
    id: string;
    external_id: string;
    name: string;
    avatar: string | null;
    total_products: number;
    new_products: number;
    discount: number;
    is_active: boolean;
    last_sync_at: string | null;
}

export default function SuppliersPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [settingsSupplier, setSettingsSupplier] = useState<Supplier | null>(null);
    const [discountInput, setDiscountInput] = useState('1');

    const { data, isLoading } = useQuery({
        queryKey: ['wecom-album-suppliers', keyword, page],
        queryFn: () =>
            fetchJson<any>(
                `/wecom-album/suppliers?page=${page}&page_size=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`
            ),
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            return fetchJson<any>(`/wecom-album/suppliers/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wecom-album-suppliers'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '操作失败' : 'Failed'));
        },
    });

    const discountMutation = useMutation({
        mutationFn: async ({ id, discount }: { id: string; discount: number }) => {
            return fetchJson<any>(`/wecom-album/suppliers/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ discount }),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '折扣已更新' : 'Discount updated');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-suppliers'] });
            setSettingsSupplier(null);
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '更新失败' : 'Failed'));
        },
    });

    const suppliers: Supplier[] = data?.items ?? [];
    const total: number = data?.total ?? 0;

    const handleSearch = () => {
        setKeyword(searchInput);
        setPage(1);
    };

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {t('wecomAlbum.suppliers.title', '供应商')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                {t('wecomAlbum.suppliers.desc', '微商相册好友列表，作为供应商管理')}
            </p>

            {/* Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={isChinese ? '搜索供应商...' : 'Search suppliers...'}
                    style={{
                        flex: 1,
                        maxWidth: 360,
                        padding: '8px 12px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                    }}
                />
                <button
                    onClick={handleSearch}
                    style={{
                        padding: '8px 16px',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 14,
                    }}
                >
                    <IconSearch size={16} />
                    {isChinese ? '搜索' : 'Search'}
                </button>
            </div>

            {/* Table */}
            <div
                style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 12,
                    border: '1px solid var(--border-primary)',
                    overflow: 'hidden',
                }}
            >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {isChinese ? '供应商' : 'Supplier'}
                            </th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {isChinese ? '商品数' : 'Products'}
                            </th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {isChinese ? '新商品' : 'New'}
                            </th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {isChinese ? '状态' : 'Status'}
                            </th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {isChinese ? '折扣' : 'Discount'}
                            </th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {isChinese ? '操作' : 'Actions'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    {isChinese ? '加载中...' : 'Loading...'}
                                </td>
                            </tr>
                        ) : suppliers.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    {isChinese ? '暂无供应商，请先同步' : 'No suppliers yet, please sync first'}
                                </td>
                            </tr>
                        ) : (
                            suppliers.map((s) => (
                                <tr
                                    key={s.id}
                                    style={{ borderBottom: '1px solid var(--border-primary)' }}
                                >
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {s.avatar ? (
                                                <img
                                                    src={s.avatar}
                                                    alt=""
                                                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        background: '#e5e7eb',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 14,
                                                        color: '#9ca3af',
                                                    }}
                                                >
                                                    {s.name?.[0] || '?'}
                                                </div>
                                            )}
                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-primary)' }}>
                                        {s.total_products}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#f59e0b' }}>
                                        {s.new_products > 0 ? s.new_products : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '2px 10px',
                                                borderRadius: 12,
                                                fontSize: 12,
                                                fontWeight: 500,
                                                background: s.is_active ? '#f0fdf4' : '#fef2f2',
                                                color: s.is_active ? '#16a34a' : '#dc2626',
                                            }}
                                        >
                                            {s.is_active ? (isChinese ? '启用' : 'Active') : (isChinese ? '禁用' : 'Disabled')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-primary)' }}>
                                        {s.discount < 1 ? (
                                            <span style={{ color: '#f59e0b', fontWeight: 500 }}>
                                                {isChinese ? `${s.discount * 10}折` : `${(s.discount * 100).toFixed(0)}%`}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                {isChinese ? '原价' : 'Full'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => {
                                                    setSettingsSupplier(s);
                                                    setDiscountInput(String(s.discount ?? 1));
                                                }}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: 'none',
                                                    color: 'var(--text-tertiary)',
                                                    border: '1px solid var(--border-primary)',
                                                    borderRadius: 6,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                }}
                                                title={isChinese ? '设置折扣' : 'Set discount'}
                                            >
                                                <IconSettings size={14} />
                                            </button>
                                            <button
                                            onClick={() => toggleMutation.mutate({ id: s.id, is_active: !s.is_active })}
                                            style={{
                                                padding: '4px 12px',
                                                background: 'none',
                                                color: s.is_active ? '#dc2626' : '#16a34a',
                                                border: `1px solid ${s.is_active ? '#fecaca' : '#bbf7d0'}`,
                                                borderRadius: 6,
                                                fontSize: 12,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {s.is_active ? (isChinese ? '禁用' : 'Disable') : (isChinese ? '启用' : 'Enable')}
                                        </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > 20 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        style={{
                            padding: '6px 12px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 6,
                            cursor: page <= 1 ? 'default' : 'pointer',
                            opacity: page <= 1 ? 0.5 : 1,
                            fontSize: 13,
                        }}
                    >
                        {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isChinese ? `第 ${page} 页，共 ${Math.ceil(total / 20)} 页` : `Page ${page} of ${Math.ceil(total / 20)}`}
                    </span>
                    <button
                        onClick={() => setPage(page + 1)}
                        disabled={page * 20 >= total}
                        style={{
                            padding: '6px 12px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 6,
                            cursor: page * 20 >= total ? 'default' : 'pointer',
                            opacity: page * 20 >= total ? 0.5 : 1,
                            fontSize: 13,
                        }}
                    >
                        {isChinese ? '下一页' : 'Next'}
                    </button>
                </div>
            )}

            {/* Discount settings modal */}
            {settingsSupplier && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setSettingsSupplier(null)}
                >
                    <div
                        style={{
                            background: 'var(--bg-primary)',
                            borderRadius: 12,
                            width: 400,
                            padding: 24,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                                {isChinese ? '供应商设置' : 'Supplier Settings'}
                            </h3>
                            <button
                                onClick={() => setSettingsSupplier(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                            {isChinese ? '供应商' : 'Supplier'}: <strong style={{ color: 'var(--text-primary)' }}>{settingsSupplier.name}</strong>
                        </div>

                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            {isChinese ? '折扣（默认 1 = 原价）' : 'Discount (default 1 = full price)'}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <input
                                type="number"
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                step="0.1"
                                min="0.01"
                                max="2"
                                style={{
                                    width: 100,
                                    padding: '8px 12px',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                                {isChinese ? '例: 0.7 = 7折, 0.85 = 8.5折' : 'e.g. 0.7 = 70%, 0.85 = 85%'}
                            </span>
                        </div>

                        {/* Quick presets */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                            {[1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6].map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setDiscountInput(String(v))}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        border: `1px solid ${discountInput === String(v) ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                                        background: discountInput === String(v) ? 'var(--color-primary)' : 'var(--bg-primary)',
                                        color: discountInput === String(v) ? '#fff' : 'var(--text-secondary)',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {v === 1 ? (isChinese ? '原价' : 'Full') : (isChinese ? `${v * 10}折` : `${(v * 100).toFixed(0)}%`)}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setSettingsSupplier(null)}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                {isChinese ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => {
                                    const val = parseFloat(discountInput);
                                    if (isNaN(val) || val <= 0 || val > 2) {
                                        toast.error(isChinese ? '折扣范围: 0.01 ~ 2.0' : 'Discount range: 0.01 ~ 2.0');
                                        return;
                                    }
                                    discountMutation.mutate({ id: settingsSupplier.id, discount: val });
                                }}
                                disabled={discountMutation.isPending}
                                style={{
                                    padding: '8px 16px',
                                    background: '#4f46e5',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    opacity: discountMutation.isPending ? 0.6 : 1,
                                }}
                            >
                                {discountMutation.isPending ? (isChinese ? '保存中...' : 'Saving...') : (isChinese ? '保存' : 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
