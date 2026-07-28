/**
 * WeChat Business Album — Products page.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconSearch, IconX, IconPackage, IconSend } from '@tabler/icons-react';

interface Product {
    id: string;
    goods_id: string;
    title: string;
    price: string | null;
    main_image: string | null;
    images: string[];
    shop_name: string | null;
    tags: string[];
    synced_at: string;
}

export default function WecomAlbumProductsPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [statusTab, setStatusTab] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['wecom-album-products', keyword, page, statusTab],
        queryFn: () =>
            fetchJson<any>(
                `/wecom-album/products?page=${page}&page_size=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}${statusTab ? `&status=${statusTab}` : ''}`
            ),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return fetchJson<any>(`/wecom-album/products/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            toast.success(isChinese ? '已删除' : 'Deleted');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            setSelectedProduct(null);
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '删除失败' : 'Delete failed'));
        },
    });

    const pushMutation = useMutation({
        mutationFn: async () => {
            return fetchJson<any>('/wecom-album/push-to-pool', {
                method: 'POST',
                body: JSON.stringify({ status: 'pending_sync' }),
            });
        },
        onSuccess: (data) => {
            toast.success(isChinese
                ? `推送完成: ${data.pushed} 个商品已同步到选品池`
                : `Push done: ${data.pushed} products synced to pool`);
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '推送失败' : 'Push failed'));
        },
    });

    const products: Product[] = data?.items ?? [];
    const total: number = data?.total ?? 0;

    const handleSearch = () => {
        setKeyword(searchInput);
        setPage(1);
    };

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {t('wecomAlbum.products.title', '商品')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                {t('wecomAlbum.products.desc', '从供应商同步的商品列表')}
            </p>

            {/* Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={isChinese ? '搜索商品...' : 'Search products...'}
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
                <button
                    onClick={() => {
                        if (confirm(isChinese ? '将所有「待同步」商品推送到选品池？' : 'Push all "Pending Sync" products to pool?')) {
                            pushMutation.mutate();
                        }
                    }}
                    disabled={pushMutation.isPending}
                    style={{
                        padding: '8px 16px',
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        opacity: pushMutation.isPending ? 0.6 : 1,
                    }}
                >
                    <IconSend size={16} />
                    {pushMutation.isPending
                        ? (isChinese ? '推送中...' : 'Pushing...')
                        : (isChinese ? '推送到选品池' : 'Push to Pool')}
                </button>
            </div>

            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-primary)', paddingBottom: 0 }}>
                {[
                    { key: '', label: isChinese ? '全部' : 'All' },
                    { key: 'pending_clean', label: isChinese ? '待清洗' : 'Pending Clean' },
                    { key: 'pending_sync', label: isChinese ? '待同步' : 'Pending Sync' },
                    { key: 'synced', label: isChinese ? '已同步' : 'Synced' },
                    { key: 'skip', label: isChinese ? '不同步' : 'Skipped' },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => { setStatusTab(tab.key); setPage(1); }}
                        style={{
                            padding: '8px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: statusTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
                            color: statusTab === tab.key ? '#4f46e5' : 'var(--text-secondary)',
                            fontWeight: statusTab === tab.key ? 600 : 400,
                            fontSize: 14,
                            cursor: 'pointer',
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Product grid */}
            {isLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    {isChinese ? '加载中...' : 'Loading...'}
                </div>
            ) : products.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    {isChinese ? '暂无商品，请先同步' : 'No products yet, please sync first'}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {products.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            style={{
                                background: 'var(--bg-primary)',
                                borderRadius: 12,
                                border: '1px solid var(--border-primary)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'box-shadow 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: 200,
                                    background: '#f5f5f5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                }}
                            >
                                {p.main_image ? (
                                    <img
                                        src={p.main_image}
                                        alt={p.title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <IconPackage size={32} color="#d1d5db" />
                                )}
                            </div>
                            <div style={{ padding: 12 }}>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        marginBottom: 4,
                                    }}
                                >
                                    {p.title}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ef4444' }}>
                                        {p.price ? `¥${p.price}` : '-'}
                                    </span>
                                    <span
                                        style={{
                                            padding: '1px 6px',
                                            borderRadius: 4,
                                            fontSize: 10,
                                            fontWeight: 500,
                                            background: p.status === 'synced' ? '#f0fdf4' : p.status === 'pending_sync' ? '#eff6ff' : p.status === 'skip' ? '#fef2f2' : '#fefce8',
                                            color: p.status === 'synced' ? '#16a34a' : p.status === 'pending_sync' ? '#2563eb' : p.status === 'skip' ? '#dc2626' : '#ca8a04',
                                        }}
                                        title={p.status === 'skip' ? p.skip_reason : undefined}
                                    >
                                        {p.status === 'pending_clean' ? (isChinese ? '待清洗' : 'To Clean') : p.status === 'pending_sync' ? (isChinese ? '待同步' : 'To Sync') : p.status === 'skip' ? (isChinese ? '不同步' : 'Skipped') : (isChinese ? '已同步' : 'Synced')}
                                    </span>
                                    {p.shop_name && (
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            {p.shop_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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

            {/* Product detail modal */}
            {selectedProduct && (
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
                    onClick={() => setSelectedProduct(null)}
                >
                    <div
                        style={{
                            background: 'var(--bg-primary)',
                            borderRadius: 12,
                            width: '90%',
                            maxWidth: 600,
                            maxHeight: '80vh',
                            overflow: 'auto',
                            padding: 24,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                {isChinese ? '商品详情' : 'Product Detail'}
                            </h2>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* Image */}
                        {selectedProduct.main_image && (
                            <img
                                src={selectedProduct.main_image}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: 300,
                                    objectFit: 'contain',
                                    borderRadius: 8,
                                    background: '#f5f5f5',
                                    marginBottom: 16,
                                }}
                            />
                        )}

                        {/* Info */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                                {selectedProduct.title}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
                                {selectedProduct.price ? `¥${selectedProduct.price}` : '-'}
                            </div>
                            {selectedProduct.shop_name && (
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    {isChinese ? '供应商' : 'Supplier'}: {selectedProduct.shop_name}
                                </div>
                            )}
                            {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                    {selectedProduct.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                padding: '2px 8px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: 4,
                                                fontSize: 12,
                                                color: 'var(--text-secondary)',
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {(selectedProduct as any).skip_reason && (
                                <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>
                                    {isChinese ? '不同步原因' : 'Skip reason'}: {(selectedProduct as any).skip_reason}
                                </div>
                            )}
                        </div>

                        {/* All images */}
                        {selectedProduct.images && selectedProduct.images.length > 1 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                {selectedProduct.images.map((img, i) => (
                                    <img
                                        key={i}
                                        src={img}
                                        alt=""
                                        style={{
                                            width: 80,
                                            height: 80,
                                            objectFit: 'cover',
                                            borderRadius: 6,
                                            border: '1px solid var(--border-primary)',
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    if (confirm(isChinese ? '确定删除该商品？' : 'Delete this product?')) {
                                        deleteMutation.mutate(selectedProduct.id);
                                    }
                                }}
                                style={{
                                    padding: '8px 16px',
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                }}
                            >
                                {isChinese ? '删除' : 'Delete'}
                            </button>
                            {selectedProduct.images?.[0] && (
                                <a
                                    href={selectedProduct.images[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: '8px 16px',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        textDecoration: 'none',
                                    }}
                                >
                                    {isChinese ? '查看原图' : 'View original'}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
