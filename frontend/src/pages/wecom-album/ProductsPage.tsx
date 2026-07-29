/**
 * WeChat Business Album — Products page.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import {
    IconSearch, IconX, IconPackage, IconSend,
    IconSparkles, IconBan, IconCheck,
} from '@tabler/icons-react';

interface Product {
    id: string;
    goods_id: string;
    title: string;
    status: string;
    price: string | null;
    main_image: string | null;
    images: string[];
    video_url?: string | null;
    shop_name: string | null;
    tags: string[];
    synced_at: string;
    skip_reason?: string;
    clean_title?: string;
    clean_price?: number;
    category_id?: number | null;
}

interface ApiCategory {
    id: number;
    pid: number;
    cate_name: string;
    children?: ApiCategory[];
}

/** Build flat map from tree categories: {id: "parent>name"} */
function buildCategoryMap(cats: ApiCategory[]): Record<number, string> {
    const map: Record<number, string> = {};
    const walk = (items: ApiCategory[], parentName: string) => {
        for (const c of items) {
            const fullName = parentName ? `${parentName}>${c.cate_name}` : c.cate_name;
            map[c.id] = fullName;
            if (c.children?.length) walk(c.children, fullName);
        }
    };
    walk(cats, '');
    return map;
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
    const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['wecom-album-products', keyword, page, statusTab, categoryFilter],
        queryFn: () =>
            fetchJson<any>(
                `/wecom-album/products?page=${page}&page_size=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}${statusTab ? `&status=${statusTab}` : ''}${categoryFilter !== '' ? `&category_id=${categoryFilter}` : ''}`
            ),
    });

    // Fetch categories from API
    const { data: apiCategories = [] } = useQuery<ApiCategory[]>({
        queryKey: ['wecom-album-categories'],
        queryFn: () => fetchJson<any>('/wecom-album/categories'),
    });
    const categoryMap = useMemo(() => buildCategoryMap(apiCategories), [apiCategories]);

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

    // AI clean single product
    const cleanMutation = useMutation({
        mutationFn: async (productId: string) => {
            return fetchJson<any>(`/wecom-album/ai-clean/single/${productId}`, { method: 'POST' });
        },
        onSuccess: (data) => {
            toast.success(isChinese ? '清洗完成' : 'Clean done');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '清洗失败' : 'Clean failed'));
        },
    });

    // Skip product (mark as different sync)
    const skipMutation = useMutation({
        mutationFn: async ({ productId, reason }: { productId: string; reason?: string }) => {
            return fetchJson<any>(`/wecom-album/products/${productId}`, {
                method: 'PATCH',
                body: JSON.stringify({ action: 'skip', skip_reason: reason || '' }),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '已标记为不同步' : 'Marked as skipped');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-products'] });
            queryClient.invalidateQueries({ queryKey: ['wecom-album-stats'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '操作失败' : 'Action failed'));
        },
    });

    // Push single product to pool
    const pushSingleMutation = useMutation({
        mutationFn: async (productId: string) => {
            return fetchJson<any>(`/wecom-album/products/${productId}`, {
                method: 'PATCH',
                body: JSON.stringify({ action: 'push_to_pool' }),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '已推送到选品池' : 'Pushed to pool');
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

            {/* Status tabs + Category filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-primary)', paddingBottom: 0 }}>
                <div style={{ display: 'flex', gap: 4 }}>
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
                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
                    style={{
                        padding: '6px 10px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 6,
                        fontSize: 13,
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        marginBottom: 4,
                    }}
                >
                    <option value="">{isChinese ? '全部分类' : 'All Categories'}</option>
                    {Object.entries(categoryMap).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                    ))}
                </select>
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
                                {p.main_image ? (
                                    <img src={p.main_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconPackage size={32} color="#d1d5db" />
                                    </div>
                                )}
                                {p.video_url && (
                                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff' }}>▶ 视频</div>
                                )}
                                <div style={{
                                    position: 'absolute', top: 8, left: 8,
                                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: '#fff',
                                    background: p.status === 'synced' ? '#16a34a' : p.status === 'pending_sync' ? '#2563eb' : p.status === 'skip' ? '#dc2626' : '#ca8a04',
                                }}>
                                    {p.status === 'pending_clean' ? '待清洗' : p.status === 'pending_sync' ? '待同步' : p.status === 'skip' ? '不同步' : '已同步'}
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                    {p.clean_title || p.title}
                                </div>

                                {/* Price: always show clean_price */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>
                                        ¥{p.clean_price ?? p.price ?? '-'}
                                    </span>
                                    {p.clean_price && p.price && String(p.clean_price) !== String(p.price) && (
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>¥{p.price}</span>
                                    )}
                                </div>

                                {/* Category + Supplier */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', minHeight: 18 }}>
                                    {p.category_id && categoryMap[p.category_id] && (
                                        <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500, background: '#f0f9ff', color: '#0369a1', whiteSpace: 'nowrap' }}>
                                            {categoryMap[p.category_id]}
                                        </span>
                                    )}
                                    {p.shop_name && (
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.shop_name}</span>
                                    )}
                                </div>

                                {/* Action buttons */}
                                {p.status === 'pending_clean' && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); cleanMutation.mutate(p.id); }}
                                            disabled={cleanMutation.isPending}
                                            style={{ flex: 1, padding: '6px 0', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: cleanMutation.isPending ? 0.6 : 1 }}
                                        >
                                            <IconSparkles size={12} />清洗
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); const r = prompt('请输入不同步原因（可选）：'); skipMutation.mutate({ productId: p.id, reason: r || '' }); }}
                                            disabled={skipMutation.isPending}
                                            style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <IconBan size={12} />不同步
                                        </button>
                                    </div>
                                )}
                                {p.status === 'pending_sync' && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); pushSingleMutation.mutate(p.id); }}
                                            disabled={pushSingleMutation.isPending}
                                            style={{ flex: 1, padding: '6px 0', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pushSingleMutation.isPending ? 0.6 : 1 }}
                                        >
                                            <IconCheck size={12} />同步
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); const r = prompt('请输入不同步原因（可选）：'); skipMutation.mutate({ productId: p.id, reason: r || '' }); }}
                                            disabled={skipMutation.isPending}
                                            style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <IconBan size={12} />不同步
                                        </button>
                                    </div>
                                )}
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

                        {/* Video */}
                        {selectedProduct.video_url && (
                            <video
                                src={selectedProduct.video_url}
                                controls
                                style={{
                                    width: '100%',
                                    maxHeight: 400,
                                    borderRadius: 8,
                                    background: '#000',
                                    marginBottom: 16,
                                }}
                            />
                        )}

                        {/* Info */}
                        <div style={{ marginBottom: 12 }}>
                            {selectedProduct.clean_title && (
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, textDecoration: 'line-through' }}>
                                    {selectedProduct.title}
                                </div>
                            )}
                            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                                {selectedProduct.clean_title || selectedProduct.title}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
                                {selectedProduct.clean_price ? `¥${selectedProduct.clean_price}` : selectedProduct.price ? `¥${selectedProduct.price}` : '-'}
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
