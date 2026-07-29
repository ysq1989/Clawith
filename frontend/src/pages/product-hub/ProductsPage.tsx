/**
 * Product Hub Products Page — Browse the public product selection pool.
 * Fixed 4:3 image ratio, 4 columns, fullscreen gallery viewer.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconSearch, IconX, IconPackage, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

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

/* ─── Fullscreen Gallery Viewer ─── */
function GalleryViewer({
    images,
    videoUrl,
    title,
    price,
    categoryName,
    initialIndex,
    onClose,
}: {
    images: string[];
    videoUrl?: string | null;
    title: string;
    price: string | null;
    categoryName?: string;
    initialIndex: number;
    onClose: () => void;
}) {
    const [index, setIndex] = useState(initialIndex);
    const total = images.length;
    const hasVideo = !!videoUrl;
    const mediaCount = total + (hasVideo ? 1 : 0);

    const prev = useCallback(() => setIndex((i) => (i - 1 + mediaCount) % mediaCount), [mediaCount]);
    const next = useCallback(() => setIndex((i) => (i + 1) % mediaCount), [mediaCount]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, prev, next]);

    const isVideo = hasVideo && index === total; // last item is video
    const currentImage = !isVideo ? images[index] : null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.15s ease',
        }}>
            {/* Top bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', flexShrink: 0 }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 16 }}>
                    {title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#ff6b6b' }}>¥{price || '-'}</span>
                    {categoryName && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,255,255,0.15)', color: '#ccc' }}>{categoryName}</span>}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
                        <IconX size={22} />
                    </button>
                </div>
            </div>

            {/* Main media area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0, padding: '0 60px' }}>
                {/* Prev */}
                {mediaCount > 1 && (
                    <button onClick={prev} style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
                        width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', transition: 'background 0.2s', zIndex: 1,
                    }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                    >
                        <IconChevronLeft size={22} />
                    </button>
                )}

                {/* Media */}
                {isVideo ? (
                    <video key="video" src={videoUrl!} controls autoPlay style={{ maxHeight: '80vh', maxWidth: '100%', borderRadius: 8 }} />
                ) : currentImage ? (
                    <img key={index} src={currentImage} alt="" style={{ maxHeight: '80vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
                ) : null}

                {/* Next */}
                {mediaCount > 1 && (
                    <button onClick={next} style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
                        width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', transition: 'background 0.2s', zIndex: 1,
                    }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                    >
                        <IconChevronRight size={22} />
                    </button>
                )}

                {/* Counter */}
                {mediaCount > 1 && (
                    <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#fff' }}>
                        {index + 1} / {mediaCount}
                    </div>
                )}
            </div>

            {/* Thumbnail strip */}
            {mediaCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 20px', flexShrink: 0, overflowX: 'auto' }}>
                    {images.map((img, i) => (
                        <div key={i} onClick={() => setIndex(i)} style={{
                            width: 48, height: 48, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                            border: i === index && !isVideo ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                            opacity: i === index && !isVideo ? 1 : 0.6, transition: 'all 0.2s',
                        }}>
                            <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    ))}
                    {hasVideo && (
                        <div onClick={() => setIndex(total)} style={{
                            width: 48, height: 48, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                            border: isVideo ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                            opacity: isVideo ? 1 : 0.6, transition: 'all 0.2s',
                            background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14,
                        }}>
                            ▶
                        </div>
                    )}
                </div>
            )}

            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
}

/* ─── Main Page ─── */
export default function ProductsPage() {
    const { i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['product-hub-products', keyword, page],
        queryFn: () => fetchJson<any>(`/product-hub/products?page=${page}&page_size=40${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`),
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

    const openGallery = (p: Product, idx: number) => {
        setGalleryProduct(p);
        setGalleryIndex(idx);
    };

    return (
        <div style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#222', margin: '0 0 4px 0' }}>{isChinese ? '选品池' : 'Selection Pool'}</h1>
                <p style={{ color: '#999', margin: 0, fontSize: 13 }}>{isChinese ? '已清洗的商品，发现好货' : 'Cleaned products'}</p>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, maxWidth: 380, display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', borderRadius: 10, padding: '0 14px', height: 38 }}>
                    <IconSearch size={15} color="#999" />
                    <input
                        value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={isChinese ? '搜索商品...' : 'Search...'}
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#333' }}
                    />
                    {searchInput && <button onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0 }}><IconX size={14} /></button>}
                </div>
                <button onClick={handleSearch} style={{ padding: '0 18px', height: 38, borderRadius: 10, border: 'none', background: '#222', color: '#fff', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                    {isChinese ? '搜索' : 'Search'}
                </button>
                <span style={{ fontSize: 13, color: '#aaa' }}>{isChinese ? `共 ${total} 件` : `${total} items`}</span>
            </div>

            {/* 4-column grid, fixed 4:3 ratio */}
            {isLoading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#ccc' }}>{isChinese ? '加载中...' : 'Loading...'}</div>
            ) : products.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#ccc' }}>
                    <IconPackage size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>{isChinese ? '暂无商品' : 'No products'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {products.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => openGallery(p, 0)}
                            style={{
                                background: '#fff', borderRadius: 10, overflow: 'hidden',
                                cursor: 'pointer', transition: 'all 0.2s',
                                border: '1px solid #f0f0f0',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                        >
                            {/* 4:3 image */}
                            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#f5f5f5', overflow: 'hidden' }}>
                                {p.main_image || p.images?.[0] ? (
                                    <img src={p.main_image || p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconPackage size={28} color="#ddd" />
                                    </div>
                                )}
                                {p.video_url && (
                                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 5, padding: '2px 6px', fontSize: 10, color: '#fff' }}>▶ 视频</div>
                                )}
                                {p.images && p.images.length > 1 && (
                                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 5, padding: '2px 6px', fontSize: 10, color: '#fff' }}>📷 {p.images.length}</div>
                                )}
                            </div>

                            {/* Info */}
                            <div style={{ padding: '8px 10px 10px' }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                                    {p.title}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#e53e3e' }}>¥{p.price || '-'}</span>
                                    {p.category_id && categoryMap[p.category_id] && (
                                        <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 10, background: '#f0f7ff', color: '#3182ce', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            {total > 40 && (
                <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                        style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontSize: 13, color: '#666' }}>
                        ‹ {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ fontSize: 13, color: '#aaa' }}>{page} / {Math.ceil(total / 40)}</span>
                    <button onClick={() => setPage(page + 1)} disabled={page * 40 >= total}
                        style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', cursor: page * 40 >= total ? 'default' : 'pointer', opacity: page * 40 >= total ? 0.4 : 1, fontSize: 13, color: '#666' }}>
                        {isChinese ? '下一页' : 'Next'} ›
                    </button>
                </div>
            )}

            {/* Gallery viewer */}
            {galleryProduct && (
                <GalleryViewer
                    images={galleryProduct.images || []}
                    videoUrl={galleryProduct.video_url}
                    title={galleryProduct.title}
                    price={galleryProduct.price}
                    categoryName={galleryProduct.category_id ? categoryMap[galleryProduct.category_id] : undefined}
                    initialIndex={galleryIndex}
                    onClose={() => setGalleryProduct(null)}
                />
            )}
        </div>
    );
}
