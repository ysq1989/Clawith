/**
 * App Authorization Tab — Platform-level: authorize which companies can use which modules.
 *
 * Architecture: Platform → Company → Employee
 * Platform admins grant module access to each company.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconCheck, IconX, IconBuilding } from '@tabler/icons-react';

const MODULE_LIST = [
    { id: 'erp', name: 'ERP', icon: '📊', description: '企业资源管理系统' },
    { id: 'xhs', name: '小红书', icon: '📕', description: '小红书内容运营' },
    { id: 'product_hub', name: '选品中心', icon: '🛍️', description: '商品选品与供应链管理' },
];

export default function AppAuthTab() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    // Fetch all companies
    const { data: companiesData, isLoading } = useQuery({
        queryKey: ['admin-companies'],
        queryFn: () => fetchJson<any>('/tenants?page_size=100'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ tenantId, modules }: { tenantId: string; modules: string[] }) => {
            return fetchJson(`/tenants/${tenantId}`, {
                method: 'PATCH',
                body: JSON.stringify({ enabled_modules: modules }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
            toast.success(isChinese ? '已更新' : 'Updated');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const companies: any[] = companiesData?.items ?? (Array.isArray(companiesData) ? companiesData : []);

    // null/empty = all modules enabled
    const isModuleEnabled = (tenantModules: string[] | null, moduleId: string) => {
        if (!tenantModules || tenantModules.length === 0) return true;
        return tenantModules.includes(moduleId);
    };

    const toggleModule = (tenantId: string, currentModules: string[] | null, moduleId: string) => {
        let modules = currentModules ?? [];
        // If currently "all enabled" (empty/null), start from full list
        if (modules.length === 0) {
            modules = MODULE_LIST.map((m) => m.id);
        }
        const newModules = modules.includes(moduleId)
            ? modules.filter((m) => m !== moduleId)
            : [...modules, moduleId];
        updateMutation.mutate({ tenantId, modules: newModules });
    };

    if (isLoading) {
        return <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</div>;
    }

    return (
        <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                {isChinese ? '应用授权' : 'Application Authorization'}
            </h2>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24, fontSize: 14 }}>
                {isChinese ? '授权各公司可以使用的应用模块' : 'Grant module access to each company'}
            </p>

            <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12,
                overflow: 'hidden',
            }}>
                {/* Table header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '200px repeat(3, 1fr)',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-primary)',
                    background: 'var(--bg-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    <div>{isChinese ? '公司' : 'Company'}</div>
                    {MODULE_LIST.map((mod) => (
                        <div key={mod.id} style={{ textAlign: 'center' }}>
                            {mod.icon} {mod.name}
                        </div>
                    ))}
                </div>

                {/* Company rows */}
                {companies.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        {isChinese ? '暂无公司' : 'No companies'}
                    </div>
                ) : (
                    companies.map((company: any) => (
                        <div
                            key={company.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '200px repeat(3, 1fr)',
                                padding: '14px 20px',
                                borderBottom: '1px solid var(--border-primary)',
                                alignItems: 'center',
                                fontSize: 14,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <IconBuilding size={16} color="var(--text-tertiary)" />
                                <div>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{company.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        {company.slug}
                                    </div>
                                </div>
                            </div>
                            {MODULE_LIST.map((mod) => {
                                const enabled = isModuleEnabled(company.enabled_modules, mod.id);
                                return (
                                    <div key={mod.id} style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => toggleModule(company.id, company.enabled_modules, mod.id)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '4px 12px', borderRadius: 6, border: 'none',
                                                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                                                background: enabled ? '#f0fdf4' : '#fef2f2',
                                                color: enabled ? '#166534' : '#991b1b',
                                            }}
                                        >
                                            {enabled
                                                ? <><IconCheck size={12} /> {isChinese ? '已授权' : 'Yes'}</>
                                                : <><IconX size={12} /> {isChinese ? '未授权' : 'No'}</>
                                            }
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', borderRadius: 8, fontSize: 13, color: '#92400e', border: '1px solid #fde68a' }}>
                {isChinese
                    ? '💡 未设置模块限制的公司（enabled_modules 为空）可使用所有应用模块。点击按钮切换授权状态。'
                    : '💡 Companies with no module restrictions (enabled_modules empty) can access all modules. Click to toggle.'
                }
            </div>
        </div>
    );
}
