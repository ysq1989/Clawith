/**
 * Product Hub Products Page — Browse the public product selection pool.
 * Waterfall/masonry layout with natural image aspect ratio.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconSearch, IconX, IconPackage, IconHeart } from '@tabler/icons-react';

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
                `/product-hub/products?page=${page}&page_size=30${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`
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
        <div style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    {isChinese ? '选品池' : 'Selection Pool'}
                </h1>
                <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: 13 }}>
                    {isChinese ? '已清洗的商品，发现好货' : 'Cleaned products, find great deals'}
                </p>
            </div>

            {/* Search bar */}
            <div style={{ marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                    flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center', gap: 8,
                    background: '#f7f8fa', borderRadius: 10, padding: '0 14px', height: 40,
                    border: '1px solid transparent', transition: 'border-color 0.2s',
                }}>
                    <IconSearch size={16} color="#999" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={isChinese ? '搜索商品名称...' : 'Search products...'}
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#333' }}
                    />
                    {searchInput && (
                        <button onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0, display: 'flex' }}>
                            <IconX size={14} />
                        </button>
                    )}
                </div>
                <button onClick={handleSearch} style={{
                    padding: '0 20px', height: 40, borderRadius: 10, border: 'none',
                    background: '#333', color: '#fff', fontWeight: 500, fontSize: 14, cursor: 'pointer',
                    transition: 'background 0.2s',
                }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#555')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#333')}
                >
                    {isChinese ? '搜索' : 'Search'}
                </button>
                <span style={{ fontSize: 13, color: '#999', marginLeft: 4 }}>
                    {isChinese ? `共 ${total} 件` : `${total} items`}
                </span>
            </div>

            {/* Waterfall grid */}
            {isLoading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontSize: 14 }}>
                    {isChinese ? '加载中...' : 'Loading...'}
                </div>
            ) : products.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#bbb' }}>
                    <IconPackage size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>{isChinese ? '暂无商品' : 'No products'}</p>
                </div>
            ) : (
                <div style={{ columnCount: 5, columnGap: 10 }}>
                    {products.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            style={{
                                breakInside: 'avoid',
                                marginBottom: 10,
                                background: '#fff',
                                borderRadius: 10,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'all 0.25s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                                e.currentTarget.style.transform = 'none';
                            }}
                        >
                            {/* Image — natural aspect ratio */}
                            <div style={{ position: 'relative', background: '#f5f5f5' }}>
                                {p.main_image || p.images?.[0] ? (
                                    <img
                                        src={p.main_image || p.images[0]}
                                        alt=""
                                        style={{ width: '100%', display: 'block' }}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconPackage size={28} color="#ddd" />
                                    </div>
                                )}
                                {/* Badges */}
                                {p.video_url && (
                                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 3 }}>
                                        ▶ {isChinese ? '视频' : 'Video'}
                                    </div>
                                )}
                                {p.images && p.images.length > 1 && (
                                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: '#fff' }}>
                                        📷 {p.images.length}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ padding: '10px 12px 12px' }}>
                                <div style={{
                                    fontSize: 13, fontWeight: 500, color: '#333', lineHeight: 1.4,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    marginBottom: 6,
                                }}>
                                    {p.title}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 17, fontWeight: 700, color: '#e53e3e' }}>
                                        ¥{p.price || '-'}
                                    </span>
                                    {p.category_id && categoryMap[p.category_id] && (
                                        <span style={{
                                            padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                            background: '#f0f7ff', color: '#3182ce', maxWidth: 90,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
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
            {total > 30 && (
                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e5e5',
                            background: '#fff', cursor: page <= 1 ? 'default' : 'pointer',
                            opacity: page <= 1 ? 0.4 : 1, fontSize: 13, color: '#666',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.borderColor = '#999'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
                    >
                        ‹ {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ fontSize: 13, color: '#999' }}>
                        {page} / {Math.ceil(total / 30)}
                    </span>
                    <button onClick={() => setPage(page + 1)} disabled={page * 30 >= total}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e5e5',
                            background: '#fff', cursor: page * 30 >= total ? 'default' : 'pointer',
                            opacity: page * 30 >= total ? 0.4 : 1, fontSize: 13, color: '#666',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { if (page * 30 < total) e.currentTarget.style.borderColor = '#999'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
                    >
                        {isChinese ? '下一页' : 'Next'} ›
                    </button>
                </div>
            )}

            {/* Detail modal */}
            {selectedProduct && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease' }}
                    onClick={() => setSelectedProduct(null)}
                >
                    <div
                        style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 640, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Main image */}
                        {(selectedProduct.main_image || selectedProduct.images?.[0]) && (
                            <div style={{ width: '100%', background: '#f5f5f5', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
                                <img
                                    src={selectedProduct.main_image || selectedProduct.images[0]}
                                    alt=""
                                    style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }}
                                />
                            </div>
                        )}

                        {/* Info */}
                        <div style={{ padding: '20px 24px 24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                                <h2 style={{ fontSize: 17, fontWeight: 600, color: '#222', margin: 0, flex: 1, lineHeight: 1.5 }}>
                                    {selectedProduct.title}
                                </h2>
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', marginLeft: 12, padding: 4, flexShrink: 0 }}
                                >
                                    <IconX size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 24, fontWeight: 700, color: '#e53e3e' }}>
                                    ¥{selectedProduct.price || '-'}
                                </span>
                            </div>

                            {selectedProduct.category_id && categoryMap[selectedProduct.category_id] && (
                                <div style={{ marginBottom: 16 }}>
                                    <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#f0f7ff', color: '#3182ce' }}>
                                        {categoryMap[selectedProduct.category_id]}
                                    </span>
                                </div>
                            )}

                            {/* Multi-image gallery */}
                            {selectedProduct.images && selectedProduct.images.length > 1 && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#666', marginBottom: 8 }}>
                                        {isChinese ? '全部图片' : 'All images'} ({selectedProduct.images.length})
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {selectedProduct.images.map((img, i) => (
                                            <a key={i} href={img} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'block' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <img
                                                    src={img}
                                                    alt=""
                                                    style={{
                                                        width: 72, height: 72, objectFit: 'cover', borderRadius: 8,
                                                        border: '1px solid #eee', transition: 'transform 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Video */}
                            {selectedProduct.video_url && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#666', marginBottom: 8 }}>
                                        {isChinese ? '商品视频' : 'Product Video'}
                                    </div>
                                    <video
                                        src={selectedProduct.video_url}
                                        controls
                                        style={{ width: '100%', maxHeight: 300, borderRadius: 10, background: '#000' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
}
