/**
 * Product Hub My Pools Page — Manage personal selection pools.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconPlus, IconTrash, IconArrowLeft, IconPool, IconShoppingBag } from '@tabler/icons-react';

export default function MyPoolsPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { poolId } = useParams();
    const isChinese = i18n.language?.startsWith('zh');

    const [showCreate, setShowCreate] = useState(false);
    const [newPoolName, setNewPoolName] = useState('');
    const [newPoolDesc, setNewPoolDesc] = useState('');

    // List pools
    const { data: pools, isLoading } = useQuery({
        queryKey: ['product-hub-my-pools'],
        queryFn: () => fetchJson<any>('/product-hub/my-pools'),
        enabled: !poolId,
    });

    // Pool detail
    const { data: poolDetail, isLoading: detailLoading } = useQuery({
        queryKey: ['product-hub-pool-detail', poolId],
        queryFn: () => fetchJson<any>(`/product-hub/my-pools/${poolId}`),
        enabled: !!poolId,
    });

    const createPoolMutation = useMutation({
        mutationFn: (body: { name: string; description?: string }) =>
            fetchJson('/product-hub/my-pools', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-my-pools'] });
            toast.success(isChinese ? '货池已创建' : 'Pool created');
            setShowCreate(false);
            setNewPoolName('');
            setNewPoolDesc('');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const deletePoolMutation = useMutation({
        mutationFn: (id: string) =>
            fetchJson(`/product-hub/my-pools/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-my-pools'] });
            toast.success(isChinese ? '已删除' : 'Deleted');
            navigate('/product-hub/my-pools');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const removeItemMutation = useMutation({
        mutationFn: ({ poolId: pid, itemId }: { poolId: string; itemId: string }) =>
            fetchJson(`/product-hub/my-pools/${pid}/items/${itemId}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-pool-detail', poolId] });
            toast.success(isChinese ? '已移除' : 'Removed');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    // ── Pool list view ──
    if (!poolId) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t('productHub.myPools.title', '我的货池')}
                        </h1>
                        <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {t('productHub.myPools.subtitle', '管理你精心挑选的货品集合')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'var(--color-primary)',
                            color: 'white',
                            fontWeight: 500,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <IconPlus size={16} />
                        {isChinese ? '新建货池' : 'New Pool'}
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                        {isChinese ? '加载中...' : 'Loading...'}
                    </div>
                ) : !Array.isArray(pools) || pools.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                        <IconPool size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                        <p>{isChinese ? '还没有货池，点击上方按钮创建' : 'No pools yet. Click the button above to create one.'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                        {pools.map((pool: any) => (
                            <div
                                key={pool.id}
                                onClick={() => navigate(`/product-hub/my-pools/${pool.id}`)}
                                style={{
                                    background: 'var(--bg-primary)',
                                    borderRadius: 12,
                                    border: '1px solid var(--border-primary)',
                                    padding: 20,
                                    cursor: 'pointer',
                                    transition: 'box-shadow 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                        {pool.name}
                                    </h3>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(isChinese ? `确定删除「${pool.name}」吗？` : `Delete "${pool.name}"?`)) {
                                                deletePoolMutation.mutate(pool.id);
                                            }
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-tertiary)',
                                            padding: 4,
                                        }}
                                    >
                                        <IconTrash size={16} />
                                    </button>
                                </div>
                                {pool.description && (
                                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                                        {pool.description}
                                    </p>
                                )}
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {pool.item_count ?? 0} {isChinese ? '件商品' : 'items'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create pool dialog */}
                {showCreate && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                        onClick={() => setShowCreate(false)}
                    >
                        <div style={{ background: 'var(--bg-primary)', borderRadius: 12, width: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                {isChinese ? '新建货池' : 'New Pool'}
                            </h3>
                            <input
                                value={newPoolName}
                                onChange={(e) => setNewPoolName(e.target.value)}
                                placeholder={isChinese ? '货池名称' : 'Pool name'}
                                autoFocus
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: 8,
                                    border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
                                    marginBottom: 12, fontSize: 14, boxSizing: 'border-box',
                                }}
                            />
                            <textarea
                                value={newPoolDesc}
                                onChange={(e) => setNewPoolDesc(e.target.value)}
                                placeholder={isChinese ? '描述（可选）' : 'Description (optional)'}
                                rows={3}
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: 8,
                                    border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
                                    marginBottom: 16, fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
                                }}
                            />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 14 }}>
                                    {isChinese ? '取消' : 'Cancel'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (!newPoolName.trim()) {
                                            toast.error(isChinese ? '请输入名称' : 'Name is required');
                                            return;
                                        }
                                        createPoolMutation.mutate({ name: newPoolName.trim(), description: newPoolDesc.trim() || undefined });
                                    }}
                                    disabled={createPoolMutation.isPending}
                                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                                >
                                    {createPoolMutation.isPending ? '...' : (isChinese ? '创建' : 'Create')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Pool detail view ──
    if (detailLoading) {
        return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</div>;
    }

    if (!poolDetail) {
        return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>{isChinese ? '货池不存在' : 'Pool not found'}</div>;
    }

    const items: any[] = poolDetail.items ?? [];

    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button
                    onClick={() => navigate('/product-hub/my-pools')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}
                >
                    <IconArrowLeft size={20} />
                </button>
                <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{poolDetail.name}</h1>
            </div>
            {poolDetail.description && (
                <p style={{ color: 'var(--text-tertiary)', marginBottom: 24, marginLeft: 36 }}>{poolDetail.description}</p>
            )}

            {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                    <IconShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p>{isChinese ? '货池为空，去选品池挑选商品吧' : 'Pool is empty. Go browse products to add some.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {items.map((item: any) => {
                        const product = item.product;
                        return (
                            <div
                                key={item.id}
                                style={{
                                    background: 'var(--bg-primary)',
                                    borderRadius: 12,
                                    border: '1px solid var(--border-primary)',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: 180,
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {product.main_image || product.images?.[0] ? (
                                        <img
                                            src={product.main_image || product.images[0]}
                                            alt={product.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <IconShoppingBag size={28} color="var(--text-tertiary)" style={{ opacity: 0.3 }} />
                                    )}
                                </div>
                                <div style={{ padding: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {product.title}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-primary)' }}>
                                            {product.price ? `¥${product.price}` : '-'}
                                        </span>
                                        <button
                                            onClick={() => removeItemMutation.mutate({ poolId: poolId!, itemId: item.id })}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                                            title={isChinese ? '移除' : 'Remove'}
                                        >
                                            <IconTrash size={14} />
                                        </button>
                                    </div>
                                    {item.note && (
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>
                                            {item.note}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
