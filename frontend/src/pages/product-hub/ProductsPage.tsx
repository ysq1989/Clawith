/**
 * Product Hub Products Page — Browse the public product selection pool.
 * Uses same card layout as wecom-album products page.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconSearch, IconX, IconPackage } from '@tabler/icons-react';

interface Product {
    id: string;
    title: string;
    price: string | null;
    main_image: string | null;
    images: string[];
    video_url?: string | null;
    tags: string[];
    category_id?: number | null;
}

interface ApiCategory {
    id: number;
    pid: number;
    cate_name: string;
    children?: ApiCategory[];
}

function buildCategoryMap(cats: ApiCategory[]): Record<number, string> {
    const map: Record<number, string> = {};
    const walk = (items: ApiCategory[], parent: string) => {
        for (const c of items) {
            map[c.id] = parent ? `${parent}>${c.cate_name}` : c.cate_name;
            if (c.children?.length) walk(c.children, map[c.id]);
        }
    };
    walk(cats, '');
    return map;
}

export default function ProductsPage() {
    const { i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['product-hub-products', keyword, page],
        queryFn: () =>
            fetchJson<any>(
                `/product-hub/products?page=${page}&page_size=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`
            ),
    });

    const { data: apiCategories = [] } = useQuery<ApiCategory[]>({
        queryKey: ['wecom-album-categories'],
        queryFn: () => fetchJson<any>('/wecom-album/categories'),
    });
    const categoryMap = useMemo(() => buildCategoryMap(apiCategories), [apiCategories]);

    const products: Product[] = data?.items ?? [];
    const total: number = data?.total ?? 0;

    const handleSearch = () => {
        setKeyword(searchInput);
        setPage(1);
    };

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {isChinese ? '选品池' : 'Selection Pool'}
            </h1>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24, fontSize: 14 }}>
                {isChinese ? '已清洗的商品，选择心仪的货品' : 'Cleaned products, browse and pick'}
            </p>

            {/* Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <div style={{ flex: 1, maxWidth: 360, padding: '8px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)' }}>
                    <IconSearch size={16} color="var(--text-tertiary)" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={isChinese ? '搜索商品...' : 'Search products...'}
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-primary)' }}
                    />
                    {searchInput && (
                        <button onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                            <IconX size={14} />
                        </button>
                    )}
                </div>
                <button onClick={handleSearch} style={{ padding: '8px 16px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                    {isChinese ? '搜索' : 'Search'}
                </button>
            </div>

            {/* Product grid — same as wecom-album */}
            {isLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</div>
            ) : products.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>{isChinese ? '暂无商品' : 'No products yet'}</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
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
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                        >
                            {/* Image */}
                            <div style={{ position: 'relative', width: '100%', height: 180, background: '#f5f5f5', overflow: 'hidden' }}>
                                {p.main_image || p.images?.[0] ? (
                                    <img src={p.main_image || p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconPackage size={32} color="#d1d5db" />
                                    </div>
                                )}
                                {p.video_url && (
                                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff' }}>▶ 视频</div>
                                )}
                                {p.images && p.images.length > 1 && (
                                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#fff' }}>
                                        📷 {p.images.length}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                    {p.title}
                                </div>

                                {/* Price */}
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>
                                    {p.price ? `¥${p.price}` : '-'}
                                </div>

                                {/* Category */}
                                <div style={{ marginTop: 'auto', minHeight: 18 }}>
                                    {p.category_id && categoryMap[p.category_id] && (
                                        <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500, background: '#f0f9ff', color: '#0369a1', whiteSpace: 'nowrap' }}>
                                            {categoryMap[p.category_id]}
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
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ padding: '6px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1, fontSize: 13 }}>
                        {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isChinese ? `第 ${page} 页，共 ${Math.ceil(total / 20)} 页` : `Page ${page} / ${Math.ceil(total / 20)}`}
                    </span>
                    <button onClick={() => setPage(page + 1)} disabled={page * 20 >= total} style={{ padding: '6px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: page * 20 >= total ? 'default' : 'pointer', opacity: page * 20 >= total ? 0.5 : 1, fontSize: 13 }}>
                        {isChinese ? '下一页' : 'Next'}
                    </button>
                </div>
            )}

            {/* Detail modal — same as wecom-album */}
            {selectedProduct && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedProduct(null)}>
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 12, width: '90%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', padding: 24 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{isChinese ? '商品详情' : 'Product Detail'}</h2>
                            <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><IconX size={20} /></button>
                        </div>

                        {/* Main image */}
                        {(selectedProduct.main_image || selectedProduct.images?.[0]) && (
                            <img src={selectedProduct.main_image || selectedProduct.images[0]} alt="" style={{ width: '100%', height: 300, objectFit: 'contain', borderRadius: 8, background: '#f5f5f5', marginBottom: 16 }} />
                        )}

                        {/* Video */}
                        {selectedProduct.video_url && (
                            <video src={selectedProduct.video_url} controls style={{ width: '100%', maxHeight: 400, borderRadius: 8, background: '#000', marginBottom: 16 }} />
                        )}

                        {/* Info */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                                {selectedProduct.title}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
                                {selectedProduct.price ? `¥${selectedProduct.price}` : '-'}
                            </div>
                            {selectedProduct.category_id && categoryMap[selectedProduct.category_id] && (
                                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: '#f0f9ff', color: '#0369a1' }}>
                                    {categoryMap[selectedProduct.category_id]}
                                </span>
                            )}
                        </div>

                        {/* All images */}
                        {selectedProduct.images && selectedProduct.images.length > 1 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                {selectedProduct.images.map((img, i) => (
                                    <img key={i} src={img} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-primary)' }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
