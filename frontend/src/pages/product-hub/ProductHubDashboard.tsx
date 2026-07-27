/**
 * Product Hub Dashboard — Overview of the selection pool.
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconShoppingBag, IconPool, IconCloudUpload, IconCategory } from '@tabler/icons-react';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
    return (
        <div
            style={{
                background: 'var(--bg-primary)',
                borderRadius: 12,
                padding: 20,
                border: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
            }}
        >
            <div
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color,
                }}
            >
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{label}</div>
            </div>
        </div>
    );
}

export default function ProductHubDashboard() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const { data: productsData } = useQuery({
        queryKey: ['product-hub-products-count'],
        queryFn: () => fetchJson<any>('/product-hub/products?page_size=1'),
    });

    const { data: poolsData } = useQuery({
        queryKey: ['product-hub-pools-count'],
        queryFn: () => fetchJson<any>('/product-hub/my-pools'),
    });

    const { data: categoriesData } = useQuery({
        queryKey: ['product-hub-categories-count'],
        queryFn: () => fetchJson<any>('/product-hub/categories'),
    });

    const productCount = productsData?.total ?? 0;
    const poolCount = Array.isArray(poolsData) ? poolsData.length : 0;
    const categoryCount = Array.isArray(categoriesData) ? categoriesData.length : 0;

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {t('productHub.dashboard.title', '选品中心')}
            </h1>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 32 }}>
                {t('productHub.dashboard.subtitle', '浏览商品、管理货池、对接供应链')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                <StatCard
                    icon={<IconShoppingBag size={24} />}
                    label={t('productHub.dashboard.totalProducts', '选品池商品')}
                    value={productCount}
                    color="#4f46e5"
                />
                <StatCard
                    icon={<IconPool size={24} />}
                    label={t('productHub.dashboard.myPools', '我的货池')}
                    value={poolCount}
                    color="#059669"
                />
                <StatCard
                    icon={<IconCategory size={24} />}
                    label={t('productHub.dashboard.categories', '商品分类')}
                    value={categoryCount}
                    color="#d97706"
                />
            </div>

            <div style={{ marginTop: 32 }}>
                <div
                    style={{
                        background: 'var(--bg-primary)',
                        borderRadius: 12,
                        border: '1px solid var(--border-primary)',
                        padding: 24,
                    }}
                >
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                        {t('productHub.dashboard.quickActions', '快捷操作')}
                    </h2>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <a
                            href="/product-hub/products"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 16px',
                                borderRadius: 8,
                                border: '1px solid var(--border-primary)',
                                textDecoration: 'none',
                                color: 'var(--text-primary)',
                                fontSize: 14,
                                background: 'var(--bg-secondary)',
                            }}
                        >
                            <IconShoppingBag size={16} />
                            {isChinese ? '浏览选品池' : 'Browse Products'}
                        </a>
                        <a
                            href="/product-hub/my-pools"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 16px',
                                borderRadius: 8,
                                border: '1px solid var(--border-primary)',
                                textDecoration: 'none',
                                color: 'var(--text-primary)',
                                fontSize: 14,
                                background: 'var(--bg-secondary)',
                            }}
                        >
                            <IconPool size={16} />
                            {isChinese ? '我的货池' : 'My Pools'}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
