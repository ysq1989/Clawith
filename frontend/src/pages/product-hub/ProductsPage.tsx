/**
 * Product Hub Products Page — Browse the public product selection pool.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconSearch, IconPlus, IconX, IconShoppingBag } from '@tabler/icons-react';

interface Product {
    id: string;
    title: string;
    description: string;
    price: string | null;
    main_image: string | null;
    images: string[];
    supply_chain_name: string | null;
    tags: string[];
    quality_score: number | null;
}

export default function ProductsPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showAddToPool, setShowAddToPool] = useState(false);
    const [targetPoolId, setTargetPoolId] = useState('');
    const [addNote, setAddNote] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['product-hub-products', keyword, page],
        queryFn: () =>
            fetchJson<any>(
                `/product-hub/products?page=${page}&page_size=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`
            ),
    });

    const { data: pools } = useQuery({
        queryKey: ['product-hub-my-pools'],
        queryFn: () => fetchJson<any>('/product-hub/my-pools'),
        enabled: showAddToPool,
    });

    const addToPoolMutation = useMutation({
        mutationFn: async (body: { pool_id: string; product_id: string; note?: string }) => {
            return fetchJson(`/product-hub/my-pools/${body.pool_id}/items`, {
                method: 'POST',
                body: JSON.stringify({ product_id: body.product_id, note: body.note }),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '已添加到货池' : 'Added to pool');
            setShowAddToPool(false);
            setAddNote('');
        },
        onError: (err: any) => {
            toast.error(err?.message || (isChinese ? '添加失败' : 'Failed to add'));
        },
    });

    const handleSearch = () => {
        setKeyword(searchInput);
        setPage(1);
    };

    const products: Product[] = data?.items ?? [];
    const total: number = data?.total ?? 0;

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {t('productHub.products.title', '选品池')}
            </h1>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>
                {t('productHub.products.subtitle', '浏览所有供应链商品，选择心仪的货品')}
            </p>

            {/* Search bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        padding: '0 12px',
                    }}
                >
                    <IconSearch size={18} color="var(--text-tertiary)" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={isChinese ? '搜索商品...' : 'Search products...'}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            padding: '10px 8px',
                            fontSize: 14,
                            color: 'var(--text-primary)',
                        }}
                    />
                    {searchInput && (
                        <button
                            onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                        >
                            <IconX size={16} />
                        </button>
                    )}
                </div>
                <button
                    onClick={handleSearch}
                    style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--color-primary)',
                        color: 'white',
                        fontWeight: 500,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    {isChinese ? '搜索' : 'Search'}
                </button>
            </div>

            {/* Product grid */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                    {isChinese ? '加载中...' : 'Loading...'}
                </div>
            ) : products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                    <IconShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p>{isChinese ? '暂无商品' : 'No products yet'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                    {products.map((product) => (
                        <div
                            key={product.id}
                            style={{
                                background: 'var(--bg-primary)',
                                borderRadius: 12,
                                border: '1px solid var(--border-primary)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'box-shadow 0.15s',
                            }}
                            onClick={() => setSelectedProduct(product)}
                            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: 200,
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
                                    <IconShoppingBag size={32} color="var(--text-tertiary)" style={{ opacity: 0.3 }} />
                                )}
                            </div>
                            <div style={{ padding: 12 }}>
                                <div
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: 'var(--text-primary)',
                                        marginBottom: 4,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {product.title}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>
                                        {product.price ? `¥${product.price}` : '-'}
                                    </span>
                                    {product.supply_chain_name && (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--text-tertiary)',
                                                background: 'var(--bg-secondary)',
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                            }}
                                        >
                                            {product.supply_chain_name}
                                        </span>
                                    )}
                                </div>
                                {product.tags && product.tags.length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {product.tags.slice(0, 3).map((tag) => (
                                            <span
                                                key={tag}
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--color-primary)',
                                                    background: 'var(--color-primary-bg)',
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > 20 && (
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border-primary)',
                            background: 'var(--bg-primary)',
                            cursor: page === 1 ? 'default' : 'pointer',
                            opacity: page === 1 ? 0.5 : 1,
                            fontSize: 13,
                        }}
                    >
                        {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {isChinese ? `第 ${page} 页，共 ${Math.ceil(total / 20)} 页` : `Page ${page} of ${Math.ceil(total / 20)}`}
                    </span>
                    <button
                        onClick={() => setPage(page + 1)}
                        disabled={page * 20 >= total}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border-primary)',
                            background: 'var(--bg-primary)',
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
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => { setSelectedProduct(null); setShowAddToPool(false); }}
                >
                    <div
                        style={{
                            background: 'var(--bg-primary)',
                            borderRadius: 16,
                            width: 600,
                            maxWidth: '90vw',
                            maxHeight: '85vh',
                            overflow: 'auto',
                            padding: 0,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Image */}
                        <div
                            style={{
                                width: '100%',
                                height: 300,
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '16px 16px 0 0',
                                overflow: 'hidden',
                            }}
                        >
                            {selectedProduct.main_image || selectedProduct.images?.[0] ? (
                                <img
                                    src={selectedProduct.main_image || selectedProduct.images[0]}
                                    alt={selectedProduct.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <IconShoppingBag size={48} color="var(--text-tertiary)" style={{ opacity: 0.3 }} />
                            )}
                        </div>
                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                    {selectedProduct.title}
                                </h2>
                                <button
                                    onClick={() => { setSelectedProduct(null); setShowAddToPool(false); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                                >
                                    <IconX size={20} />
                                </button>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 12 }}>
                                {selectedProduct.price ? `¥${selectedProduct.price}` : '-'}
                            </div>
                            {selectedProduct.supply_chain_name && (
                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                                    {isChinese ? '供应链' : 'Source'}: {selectedProduct.supply_chain_name}
                                </div>
                            )}
                            {selectedProduct.description && (
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                                    {selectedProduct.description}
                                </p>
                            )}
                            {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                                    {selectedProduct.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            style={{
                                                fontSize: 12,
                                                color: 'var(--color-primary)',
                                                background: 'var(--color-primary-bg)',
                                                padding: '3px 8px',
                                                borderRadius: 4,
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => setShowAddToPool(true)}
                                style={{
                                    width: '100%',
                                    padding: '10px 0',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-primary)',
                                    background: 'var(--color-primary)',
                                    color: 'white',
                                    fontWeight: 500,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                <IconPlus size={16} />
                                {isChinese ? '加入我的货池' : 'Add to My Pool'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add to pool dialog */}
            {showAddToPool && selectedProduct && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001,
                    }}
                    onClick={() => setShowAddToPool(false)}
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
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                            {isChinese ? '选择目标货池' : 'Select Target Pool'}
                        </h3>
                        <select
                            value={targetPoolId}
                            onChange={(e) => setTargetPoolId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-primary)',
                                background: 'var(--bg-primary)',
                                marginBottom: 12,
                                fontSize: 14,
                            }}
                        >
                            <option value="">{isChinese ? '请选择...' : 'Select...'}</option>
                            {(Array.isArray(pools) ? pools : []).map((pool: any) => (
                                <option key={pool.id} value={pool.id}>{pool.name}</option>
                            ))}
                        </select>
                        <input
                            value={addNote}
                            onChange={(e) => setAddNote(e.target.value)}
                            placeholder={isChinese ? '备注（可选）' : 'Note (optional)'}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-primary)',
                                background: 'var(--bg-primary)',
                                marginBottom: 16,
                                fontSize: 14,
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowAddToPool(false)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-primary)',
                                    background: 'var(--bg-primary)',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                }}
                            >
                                {isChinese ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => {
                                    if (!targetPoolId) {
                                        toast.error(isChinese ? '请选择一个货池' : 'Please select a pool');
                                        return;
                                    }
                                    addToPoolMutation.mutate({
                                        pool_id: targetPoolId,
                                        product_id: selectedProduct.id,
                                        note: addNote || undefined,
                                    });
                                }}
                                disabled={addToPoolMutation.isPending}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'var(--color-primary)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 500,
                                }}
                            >
                                {addToPoolMutation.isPending ? '...' : (isChinese ? '添加' : 'Add')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
