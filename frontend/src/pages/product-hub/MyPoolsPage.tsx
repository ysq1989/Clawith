/**
 * Product Hub My Pools Page — Manage personal selection pools.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconPlus, IconTrash, IconArrowLeft, IconShoppingBag, IconX } from '@tabler/icons-react';

export default function MyPoolsPage() {
    const { i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { poolId } = useParams();
    const isChinese = i18n.language?.startsWith('zh');

    const [showCreate, setShowCreate] = useState(false);
    const [newPoolName, setNewPoolName] = useState('');

    const { data: pools, isLoading } = useQuery({
        queryKey: ['product-hub-my-pools'],
        queryFn: () => fetchJson<any>('/product-hub/my-pools'),
        enabled: !poolId,
    });

    const { data: poolDetail, isLoading: detailLoading } = useQuery({
        queryKey: ['product-hub-pool-detail', poolId],
        queryFn: () => fetchJson<any>(`/product-hub/my-pools/${poolId}`),
        enabled: !!poolId,
    });

    const createPoolMutation = useMutation({
        mutationFn: (body: { name: string }) =>
            fetchJson('/product-hub/my-pools', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-my-pools'] });
            toast.success(isChinese ? '货池已创建' : 'Pool created');
            setShowCreate(false);
            setNewPoolName('');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const deletePoolMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/product-hub/my-pools/${id}`, { method: 'DELETE' }),
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
            <div style={{ padding: '24px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#222', margin: '0 0 4px 0' }}>
                            {isChinese ? '我的货池' : 'My Pools'}
                        </h1>
                        <p style={{ color: '#999', margin: 0, fontSize: 13 }}>
                            {isChinese ? '管理精心挑选的货品集合' : 'Manage your curated product collections'}
                        </p>
                    </div>
                    <button onClick={() => setShowCreate(true)} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none',
                        background: '#222', color: '#fff', fontWeight: 500, fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <IconPlus size={16} />
                        {isChinese ? '新建货池' : 'New Pool'}
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#ccc' }}>{isChinese ? '加载中...' : 'Loading...'}</div>
                ) : !Array.isArray(pools) || pools.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#ccc' }}>
                        <IconShoppingBag size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ margin: 0, fontSize: 14 }}>{isChinese ? '暂无货池，点击右上角创建' : 'No pools yet'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                        {pools.map((pool: any) => (
                            <div
                                key={pool.id}
                                onClick={() => navigate(`/product-hub/my-pools/${pool.id}`)}
                                style={{
                                    background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
                                    padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
                                    position: 'relative',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
                                    }}>
                                        {pool.name?.[0] || 'P'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 15, fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {pool.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                                            {pool.item_count ?? 0} {isChinese ? '件商品' : 'items'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(isChinese ? `确定删除「${pool.name}」吗？` : `Delete "${pool.name}"?`)) {
                                                deletePoolMutation.mutate(pool.id);
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, borderRadius: 4, transition: 'color 0.15s' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
                                    >
                                        <IconTrash size={15} />
                                    </button>
                                </div>
                                {pool.description && (
                                    <p style={{ fontSize: 12, color: '#999', margin: 0, lineHeight: 1.4 }}>
                                        {pool.description}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Create dialog */}
                {showCreate && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
                        onClick={() => setShowCreate(false)}>
                        <div style={{ background: '#fff', borderRadius: 14, width: 380, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                            onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#222' }}>{isChinese ? '新建货池' : 'New Pool'}</h3>
                                <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><IconX size={18} /></button>
                            </div>
                            <input
                                value={newPoolName} onChange={(e) => setNewPoolName(e.target.value)}
                                placeholder={isChinese ? '货池名称' : 'Pool name'}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && newPoolName.trim() && createPoolMutation.mutate({ name: newPoolName.trim() })}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e5e5', background: '#fafafa', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666' }}>
                                    {isChinese ? '取消' : 'Cancel'}
                                </button>
                                <button
                                    onClick={() => { if (newPoolName.trim()) createPoolMutation.mutate({ name: newPoolName.trim() }); }}
                                    disabled={createPoolMutation.isPending || !newPoolName.trim()}
                                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: newPoolName.trim() ? '#222' : '#ccc', color: '#fff', cursor: newPoolName.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}
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
    if (detailLoading) return <div style={{ padding: 32, textAlign: 'center', color: '#ccc' }}>{isChinese ? '加载中...' : 'Loading...'}</div>;
    if (!poolDetail) return <div style={{ padding: 32, textAlign: 'center', color: '#ccc' }}>{isChinese ? '货池不存在' : 'Pool not found'}</div>;

    const items: any[] = poolDetail.items ?? [];

    return (
        <div style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button onClick={() => navigate('/product-hub/my-pools')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4, display: 'flex' }}>
                    <IconArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: '#222', margin: 0 }}>{poolDetail.name}</h1>
                    {poolDetail.description && <p style={{ fontSize: 13, color: '#999', margin: '2px 0 0 0' }}>{poolDetail.description}</p>}
                </div>
                <span style={{ fontSize: 13, color: '#aaa' }}>{items.length} {isChinese ? '件' : 'items'}</span>
            </div>

            {items.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#ccc' }}>
                    <IconShoppingBag size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>{isChinese ? '货池为空，去选品池挑选商品吧' : 'Pool is empty'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {items.map((item: any) => {
                        const product = item.product;
                        return (
                            <div key={item.id} style={{
                                background: '#fff', borderRadius: 10, overflow: 'hidden',
                                border: '1px solid #f0f0f0', position: 'relative',
                            }}>
                                {/* 3:4 image */}
                                <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#f5f5f5', overflow: 'hidden' }}>
                                    {product.main_image || product.images?.[0] ? (
                                        <img src={product.main_image || product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <IconShoppingBag size={28} color="#ddd" />
                                        </div>
                                    )}
                                    {/* Remove button */}
                                    <button
                                        onClick={() => removeItemMutation.mutate({ poolId: poolId!, itemId: item.id })}
                                        style={{
                                            position: 'absolute', top: 8, right: 8,
                                            width: 28, height: 28, borderRadius: 8,
                                            background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', backdropFilter: 'blur(4px)', transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.8)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
                                        title={isChinese ? '移除' : 'Remove'}
                                    >
                                        <IconTrash size={14} />
                                    </button>
                                </div>
                                {/* Info */}
                                <div style={{ padding: '8px 10px 10px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                                        {product.title}
                                    </div>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#e53e3e' }}>
                                        ¥{product.price || '-'}
                                    </span>
                                    {item.note && (
                                        <div style={{ fontSize: 11, color: '#999', marginTop: 4, fontStyle: 'italic' }}>{item.note}</div>
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
