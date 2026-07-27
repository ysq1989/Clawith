/**
 * Product Hub Crawl Tasks Page — Admin view of crawl task records.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconCloudUpload, IconPlus, IconTrash, IconRefresh } from '@tabler/icons-react';

const STATUS_COLORS: Record<string, string> = {
    pending: '#d97706',
    running: '#4f46e5',
    done: '#059669',
    failed: '#dc2626',
};

export default function CrawlTasksPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['product-hub-crawl-tasks'],
        queryFn: () => fetchJson<any>('/product-hub/admin/crawl/tasks?page_size=50'),
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (id: string) =>
            fetchJson(`/product-hub/admin/crawl/tasks/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-crawl-tasks'] });
            toast.success(isChinese ? '已删除' : 'Deleted');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const tasks: any[] = data?.items ?? [];

    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t('productHub.crawlTasks.title', '采集任务')}
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {t('productHub.crawlTasks.subtitle', '查看供应链数据采集任务状态')}
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-primary)',
                        background: 'var(--bg-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 14,
                        color: 'var(--text-secondary)',
                    }}
                >
                    <IconRefresh size={16} />
                    {isChinese ? '刷新' : 'Refresh'}
                </button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                    {isChinese ? '加载中...' : 'Loading...'}
                </div>
            ) : tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                    <IconCloudUpload size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p>{isChinese ? '暂无采集任务' : 'No crawl tasks yet'}</p>
                </div>
            ) : (
                <div
                    style={{
                        background: 'var(--bg-primary)',
                        borderRadius: 12,
                        border: '1px solid var(--border-primary)',
                        overflow: 'hidden',
                    }}
                >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    {isChinese ? '来源' : 'Source'}
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    {isChinese ? '状态' : 'Status'}
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    {isChinese ? '采集数' : 'Products'}
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    {isChinese ? '清洗数' : 'Cleaned'}
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    {isChinese ? '创建时间' : 'Created'}
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    {isChinese ? '操作' : 'Actions'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((task: any) => (
                                <tr key={task.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <td style={{ padding: '12px 16px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.source_url}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 12,
                                                fontWeight: 500,
                                                color: 'white',
                                                background: STATUS_COLORS[task.status] || '#888',
                                            }}
                                        >
                                            {task.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        {task.products_count}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        {task.clean_count}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>
                                        {task.created_at ? new Date(task.created_at).toLocaleString() : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        {task.status !== 'running' && (
                                            <button
                                                onClick={() => {
                                                    if (confirm(isChinese ? '确定删除吗？' : 'Delete this task?')) {
                                                        deleteTaskMutation.mutate(task.id);
                                                    }
                                                }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                                            >
                                                <IconTrash size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
