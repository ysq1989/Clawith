/**
 * WeChat Business Album — Products page.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconSearch, IconX, IconPackage } from '@tabler/icons-react';

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
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['wecom-album-products', keyword, page],
        queryFn: () =>
            fetchJson<any>(
                `/wecom-album/products?page=${page}&page_size=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`
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
