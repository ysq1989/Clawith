/**
 * WeChat Business Album Dashboard — Stats overview.
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconUsers, IconPackage, IconRefresh } from '@tabler/icons-react';

export default function WecomAlbumDashboard() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const { data: stats, isLoading } = useQuery({
        queryKey: ['wecom-album-stats'],
        queryFn: () => fetchJson<any>('/wecom-album/stats'),
    });

    const { data: account } = useQuery({
        queryKey: ['wecom-album-account'],
        queryFn: () => fetchJson<any>('/wecom-album/account'),
    });

    const cards = [
        {
            title: isChinese ? '供应商' : 'Suppliers',
            value: stats?.active_supplier_count ?? 0,
            sub: isChinese ? `${stats?.supplier_count ?? 0} 总计` : `${stats?.supplier_count ?? 0} total`,
            icon: <IconUsers size={24} stroke={1.5} />,
            color: '#4f46e5',
        },
        {
            title: isChinese ? '商品' : 'Products',
            value: stats?.product_count ?? 0,
            sub: isChinese ? '已同步' : 'synced',
            icon: <IconPackage size={24} stroke={1.5} />,
            color: '#059669',
        },
    ];

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {t('wecomAlbum.dashboard.title', '微商相册')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                {t('wecomAlbum.dashboard.desc', '管理微商相册账号，同步供应商和商品数据')}
            </p>

            {/* Connection status */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: account?.configured ? (account?.is_active ? '#f0fdf4' : '#fef2f2') : '#fffbeb',
                    border: `1px solid ${account?.configured ? (account?.is_active ? '#bbf7d0' : '#fecaca') : '#fde68a'}`,
                    marginBottom: 24,
                    fontSize: 14,
                }}
            >
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: account?.configured ? (account?.is_active ? '#22c55e' : '#ef4444') : '#f59e0b',
                    }}
                />
                {account?.configured
                    ? (account?.is_active
                        ? (isChinese ? `已连接 — ${account.album_name || '未知账号'}` : `Connected — ${account.album_name || 'Unknown'}`)
                        : (isChinese ? '连接异常' : 'Connection error'))
                    : (isChinese ? '未配置 — 请先配置微商相册账号' : 'Not configured — please set up account first')}
            </div>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {cards.map((card) => (
                    <div
                        key={card.title}
                        style={{
                            background: 'var(--bg-primary)',
                            borderRadius: 12,
                            padding: 20,
                            border: '1px solid var(--border-primary)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{card.title}</span>
                            <span style={{ color: card.color }}>{card.icon}</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isLoading ? '-' : card.value}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{card.sub}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
