/**
 * App Authorization Tab — Company-level module access control.
 * Allows org_admin to see which modules are authorized for their company.
 * Platform admins can toggle module access per company.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../../services/api';
import { useAuthStore } from '../../../stores';
import { useToast } from '../../../components/Toast/ToastProvider';
import { IconCheck, IconX } from '@tabler/icons-react';

const MODULE_LIST = [
    { id: 'erp', name: 'ERP', icon: '📊', description: '企业资源管理系统', descriptionEn: 'Enterprise Resource Planning' },
    { id: 'xhs', name: '小红书', icon: '📕', description: '小红书内容运营', descriptionEn: 'RedNote Content Operations' },
    { id: 'product_hub', name: '选品中心', icon: '🛍️', description: '商品选品与供应链管理', descriptionEn: 'Product Selection & Supply Chain' },
];

interface Props {
    selectedTenantId: string;
}

export default function AppAuthTab({ selectedTenantId }: Props) {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isChinese = i18n.language?.startsWith('zh');
    const isPlatformAdmin = user?.role === 'platform_admin' || !!(user as any)?.is_platform_admin;

    const [enabledModules, setEnabledModules] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch current tenant's enabled_modules
    useEffect(() => {
        if (!selectedTenantId) return;
        setLoading(true);
        fetchJson<any>(`/tenants/${selectedTenantId}`)
            .then((tenant) => {
                setEnabledModules(tenant.enabled_modules ?? []);
            })
            .catch(() => setEnabledModules([]))
            .finally(() => setLoading(false));
    }, [selectedTenantId]);

    const updateMutation = useMutation({
        mutationFn: async (modules: string[]) => {
            return fetchJson(`/tenants/${selectedTenantId}`, {
                method: 'PATCH',
                body: JSON.stringify({ enabled_modules: modules }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            toast.success(isChinese ? '已更新' : 'Updated');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Failed');
        },
    });

    const toggleModule = (moduleId: string) => {
        if (!isPlatformAdmin) return;
        const newModules = enabledModules.includes(moduleId)
            ? enabledModules.filter((m) => m !== moduleId)
            : [...enabledModules, moduleId];
        setEnabledModules(newModules);
        updateMutation.mutate(newModules);
    };

    // Determine if a module is enabled: null/empty = all enabled (backward compat)
    const isModuleEnabled = (moduleId: string) => {
        if (enabledModules.length === 0) return true; // empty = all enabled
        return enabledModules.includes(moduleId);
    };

    if (loading) {
        return (
            <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>
                {isChinese ? '加载中...' : 'Loading...'}
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                {isChinese ? '应用授权' : 'Application Authorization'}
            </h3>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24, fontSize: 13 }}>
                {isPlatformAdmin
                    ? (isChinese ? '控制该公司可以使用哪些应用模块' : 'Control which app modules this company can access')
                    : (isChinese ? '当前公司已授权的应用模块' : 'Authorized app modules for this company')
                }
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {MODULE_LIST.map((mod) => {
                    const enabled = isModuleEnabled(mod.id);
                    return (
                        <div
                            key={mod.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 18px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 10,
                                opacity: enabled ? 1 : 0.6,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 24 }}>{mod.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{mod.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {isChinese ? mod.description : mod.descriptionEn}
                                    </div>
                                </div>
                            </div>

                            {isPlatformAdmin ? (
                                <button
                                    onClick={() => toggleModule(mod.id)}
                                    style={{
                                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                        background: enabled ? 'var(--color-primary)' : 'var(--border-primary)',
                                        position: 'relative', transition: 'background 0.2s',
                                    }}
                                >
                                    <span
                                        style={{
                                            position: 'absolute', top: 2, left: enabled ? 22 : 2,
                                            width: 20, height: 20, borderRadius: '50%', background: 'white',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                                        }}
                                    />
                                </button>
                            ) : (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                    background: enabled ? '#f0fdf4' : '#fef2f2',
                                    color: enabled ? '#166534' : '#991b1b',
                                }}>
                                    {enabled
                                        ? <><IconCheck size={12} /> {isChinese ? '已授权' : 'Authorized'}</>
                                        : <><IconX size={12} /> {isChinese ? '未授权' : 'Not Authorized'}</>
                                    }
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {enabledModules.length === 0 && (
                <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', borderRadius: 8, fontSize: 13, color: '#92400e', border: '1px solid #fde68a' }}>
                    {isChinese
                        ? '💡 当前未设置模块限制，该公司可使用所有应用模块。'
                        : '💡 No module restrictions set — this company can access all modules.'
                    }
                </div>
            )}
        </div>
    );
}
