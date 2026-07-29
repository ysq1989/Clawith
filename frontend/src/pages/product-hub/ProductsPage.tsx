/**
 * Product Hub Products Page — Browse the public product selection pool.
 * Shows products synced from wecom-album (status=synced).
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconSearch, IconX, IconShoppingBag } from '@tabler/icons-react';

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
    const [previewIndex, setPreviewIndex] = useState(0);

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

    // Collect all media (images + video) for detail modal
    const getAllMedia = (p: Product): { type: 'image' | 'video'; url: string }[] => {
        const media: { type: 'image' | 'video'; url: string }[] = [];
        const imgs = p.images || [];
        for (const img of imgs) {
            media.push({ type: 'image', url: img });
        }
        if (p.video_url) {
            media.push({ type: 'video', url: p.video_url });
        }
        return media;
    };

    const handleSearch = () => {
        setKeyword(searchInput);
        setPage(1);
    };

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {isChinese ? '选品池' : 'Selection Pool'}
            </h1>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>
                {isChinese ? '已清洗的商品，选择心仪的货品' : 'Cleaned products, browse and pick'}
            </p>

            {/* Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '0 12px' }}>
                    <IconSearch size={18} color="var(--text-tertiary)" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={isChinese ? '搜索商品...' : 'Search products...'}
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '10px 8px', fontSize: 14, color: 'var(--text-primary)' }}
                    />
                    {searchInput && (
                        <button onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                            <IconX size={16} />
                        </button>
                    )}
                </div>
                <button onClick={handleSearch} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                    {isChinese ? '搜索' : 'Search'}
                </button>
            </div>

            {/* Product grid — 4 columns */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</div>
            ) : products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                    <IconShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p>{isChinese ? '暂无商品，请先在微商相册同步并清洗商品' : 'No products yet'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {products.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => { setSelectedProduct(p); setPreviewIndex(0); }}
                            style={{
                                background: 'var(--bg-primary)',
                                borderRadius: 10,
                                border: '1px solid var(--border-primary)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                        >
                            {/* Image */}
                            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                {p.main_image || p.images?.[0] ? (
                                    <img src={p.main_image || p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconShoppingBag size={28} color="var(--text-tertiary)" style={{ opacity: 0.3 }} />
                                    </div>
                                )}
                                {/* Video badge */}
                                {p.video_url && (
                                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: '#fff' }}>▶</div>
                                )}
                                {/* Multi-image count */}
                                {p.images && p.images.length > 1 && (
                                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: '#fff' }}>
                                        📷 {p.images.length}{p.video_url ? '+1视频' : ''}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4, lineHeight: 1.4 }}>
                                    {p.title}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>
                                        {p.price ? `¥${p.price}` : '-'}
                                    </span>
                                    {p.category_id && categoryMap[p.category_id] && (
                                        <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 500, background: '#f0f9ff', color: '#0369a1', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontSize: 13 }}>
                        {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {isChinese ? `第 ${page} 页，共 ${Math.ceil(total / 20)} 页` : `Page ${page} / ${Math.ceil(total / 20)}`}
                    </span>
                    <button onClick={() => setPage(page + 1)} disabled={page * 20 >= total} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', cursor: page * 20 >= total ? 'default' : 'pointer', opacity: page * 20 >= total ? 0.5 : 1, fontSize: 13 }}>
                        {isChinese ? '下一页' : 'Next'}
                    </button>
                </div>
            )}

            {/* Detail modal with gallery */}
            {selectedProduct && (() => {
                const media = getAllMedia(selectedProduct);
                const current = media[previewIndex] || media[0];
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedProduct(null)}>
                        <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 700, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                            {/* Main media area */}
                            <div style={{ position: 'relative', width: '100', background: '#000', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
                                {current?.type === 'video' ? (
                                    <video src={current.url} controls style={{ width: '100%', maxHeight: 400, display: 'block' }} />
                                ) : current?.type === 'image' ? (
                                    <img src={current.url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
                                ) : (
                                    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>无媒体</div>
                                )}
                                {/* Nav arrows */}
                                {media.length > 1 && (
                                    <>
                                        <button onClick={() => setPreviewIndex((i) => (i - 1 + media.length) % media.length)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>‹</button>
                                        <button onClick={() => setPreviewIndex((i) => (i + 1) % media.length)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>›</button>
                                    </>
                                )}
                                {/* Close */}
                                <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
                                {/* Counter */}
                                {media.length > 1 && (
                                    <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#fff' }}>
                                        {previewIndex + 1} / {media.length}
                                    </div>
                                )}
                            </div>

                            {/* Thumbnails */}
                            {media.length > 1 && (
                                <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border-primary)' }}>
                                    {media.map((m, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setPreviewIndex(i)}
                                            style={{
                                                flexShrink: 0, width: 56, height: 56, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                                                border: i === previewIndex ? '2px solid var(--color-primary)' : '2px solid transparent',
                                            }}
                                        >
                                            {m.type === 'video' ? (
                                                <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>▶</div>
                                            ) : (
                                                <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Info */}
                            <div style={{ padding: '16px 20px' }}>
                                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                                    {selectedProduct.title}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>
                                        {selectedProduct.price ? `¥${selectedProduct.price}` : '-'}
                                    </span>
                                </div>
                                {selectedProduct.category_id && categoryMap[selectedProduct.category_id] && (
                                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#f0f9ff', color: '#0369a1' }}>
                                        {categoryMap[selectedProduct.category_id]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
