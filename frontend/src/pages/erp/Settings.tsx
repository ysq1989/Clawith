/**
 * ERP Settings — System settings with category management tabs.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconEdit, IconTrash, IconSettings } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Category {
    id: string;
    type: string;
    name: string;
    is_default: boolean;
    created_at: string;
}

/* ─── Styles ─── */
const inputStyle: React.CSSProperties = {
    padding: '7px 12px', background: 'var(--bg-primary)',
    border: '1px solid var(--border-subtle)', borderRadius: 6,
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
};
const btnPrimary: React.CSSProperties = {
    padding: '7px 16px', borderRadius: 6, border: 'none',
    background: 'var(--accent-primary)', color: '#fff',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
};
const btnSecondary: React.CSSProperties = {
    padding: '7px 16px', borderRadius: 6,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13,
};

const CODE_ITEMS = [
    { labelZh: '客户编码', labelEn: 'Customer Code', prefixKey: 'customer_code_prefix', digitsKey: 'customer_code_digits', defaultPrefix: 'K', defaultDigits: 3 },
    { labelZh: '供应商编码', labelEn: 'Supplier Code', prefixKey: 'supplier_code_prefix', digitsKey: 'supplier_code_digits', defaultPrefix: 'G', defaultDigits: 3 },
    { labelZh: '产品编码', labelEn: 'Product Code', prefixKey: 'product_code_prefix', digitsKey: 'product_code_digits', defaultPrefix: 'P', defaultDigits: 3 },
    { labelZh: '物料编码', labelEn: 'Material Code', prefixKey: 'material_code_prefix', digitsKey: 'material_code_digits', defaultPrefix: 'M', defaultDigits: 3 },
    { labelZh: '销售订单编号', labelEn: 'Sales Order No', prefixKey: 'sales_order_prefix', digitsKey: 'sales_order_digits', defaultPrefix: 'SO', defaultDigits: 4 },
    { labelZh: '采购订单编号', labelEn: 'Purchase Order No', prefixKey: 'purchase_order_prefix', digitsKey: 'purchase_order_digits', defaultPrefix: 'PO', defaultDigits: 4 },
    { labelZh: '出库单编号', labelEn: 'Outbound No', prefixKey: 'outbound_prefix', digitsKey: 'outbound_digits', defaultPrefix: 'OUT', defaultDigits: 4 },
    { labelZh: '入库单编号', labelEn: 'Inbound No', prefixKey: 'inbound_prefix', digitsKey: 'inbound_digits', defaultPrefix: 'IN', defaultDigits: 4 },
    { labelZh: '调拨单编号', labelEn: 'Transfer No', prefixKey: 'transfer_prefix', digitsKey: 'transfer_digits', defaultPrefix: 'TR', defaultDigits: 4 },
    { labelZh: '财务记录编号', labelEn: 'Financial No', prefixKey: 'financial_prefix', digitsKey: 'financial_digits', defaultPrefix: 'FIN', defaultDigits: 4 },
];

/* ─── Category Tab Component ─── */
function CategoryTab({ type, isChinese }: { type: 'customer' | 'supplier'; isChinese: boolean }) {
    const queryClient = useQueryClient();
    const dialog = useDialog();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const queryKey = ['erp-categories', type];

    const { data: categories = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchJson<Category[]>(`/erp/categories?type=${type}`),
    });

    const createMutation = useMutation({
        mutationFn: (name: string) => fetchJson(`/erp/categories?type=${type}`, {
            method: 'POST', body: JSON.stringify({ name }),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setNewName('');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => fetchJson(`/erp/categories/${id}`, {
            method: 'PATCH', body: JSON.stringify({ name }),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setEditingId(null);
            setEditName('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/categories/${id}?type=${type}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const handleDelete = async (cat: Category) => {
        const ok = await dialog.confirm(
            isChinese ? `确定删除分类"${cat.name}"吗？` : `Delete category "${cat.name}"?`,
            isChinese ? '已使用的分类无法删除' : 'Categories in use cannot be deleted',
        );
        if (ok) {
            try {
                await deleteMutation.mutateAsync(cat.id);
            } catch (e: any) {
                const msg = e?.message || '';
                if (msg.includes('已被使用') || msg.includes('400')) {
                    dialog.alert(
                        isChinese ? '无法删除' : 'Cannot delete',
                        isChinese ? '该分类已被使用，请先移除关联的记录' : 'This category is in use. Remove associated records first.',
                    );
                }
            }
        }
    };

    const setDefaultMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/categories/${id}/set-default`, { method: 'POST' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const handleAdd = () => {
        if (!newName.trim()) return;
        createMutation.mutate(newName.trim());
    };

    const handleUpdate = () => {
        if (!editingId || !editName.trim()) return;
        updateMutation.mutate({ id: editingId, name: editName.trim() });
    };

    return (
        <div>
            {/* Add new category */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                    placeholder={isChinese ? '输入分类名称' : 'Enter category name'}
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button style={btnPrimary} onClick={handleAdd} disabled={createMutation.isPending}>
                    <IconPlus size={14} stroke={2} />
                    {isChinese ? '添加' : 'Add'}
                </button>
            </div>

            {/* Category table */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <th style={{ ...thStyle, width: 60 }}>{isChinese ? '序号' : '#'}</th>
                            <th style={thStyle}>{isChinese ? '分类名称' : 'Category Name'}</th>
                            <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>{isChinese ? '默认' : 'Default'}</th>
                            <th style={{ ...thStyle, width: 160 }}>{isChinese ? '创建时间' : 'Created'}</th>
                            <th style={{ ...thStyle, width: 120, textAlign: 'center' }}>{isChinese ? '操作' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</td></tr>
                        ) : categories.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{isChinese ? '暂无分类' : 'No categories'}</td></tr>
                        ) : categories.map((cat, idx) => (
                            <tr key={cat.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={tdStyle}>{idx + 1}</td>
                                <td style={tdStyle}>
                                    {editingId === cat.id ? (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditingId(null); }}
                                                style={{ ...inputStyle, flex: 1 }}
                                                autoFocus
                                            />
                                            <button style={{ ...btnPrimary, padding: '4px 10px', fontSize: 12 }} onClick={handleUpdate}>{isChinese ? '保存' : 'Save'}</button>
                                            <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }} onClick={() => setEditingId(null)}>{isChinese ? '取消' : 'Cancel'}</button>
                                        </div>
                                    ) : (
                                        cat.name
                                    )}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <input
                                        type="radio"
                                        name={`default-${type}`}
                                        checked={cat.is_default}
                                        onChange={() => { if (!cat.is_default) setDefaultMutation.mutate(cat.id); }}
                                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
                                    />
                                </td>
                                <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: 12 }}>
                                    {cat.created_at ? new Date(cat.created_at).toLocaleString() : ''}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {editingId !== cat.id && (
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'inline-flex' }}
                                                title={isChinese ? '编辑' : 'Edit'}
                                            >
                                                <IconEdit size={14} stroke={1.5} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat)}
                                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'inline-flex' }}
                                                title={isChinese ? '删除' : 'Delete'}
                                            >
                                                <IconTrash size={14} stroke={1.5} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function ERPSettingsPage() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier' | 'codes'>('customer');

    const tabs = [
        { key: 'customer' as const, label: isChinese ? '客户分类' : 'Customer Categories' },
        { key: 'supplier' as const, label: isChinese ? '供应商分类' : 'Supplier Categories' },
        { key: 'codes' as const, label: isChinese ? '编码设置' : 'Code Settings' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 20px', fontSize: 13, fontWeight: 500,
                            border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            background: 'transparent',
                            color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab !== 'codes' && <CategoryTab type={activeTab} isChinese={isChinese} />}
            {activeTab === 'codes' && <CodeSettingsTab isChinese={isChinese} />}
        </div>
    );
}


/* ─── Code Settings Tab ─── */
function CodeSettingsTab({ isChinese }: { isChinese: boolean }) {
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['erp-settings'],
        queryFn: () => fetchJson<any>('/erp/settings'),
    });

    const [form, setForm] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Sync settings to form when loaded
    useEffect(() => {
        if (settings) {
            const f: Record<string, string> = {};
            CODE_ITEMS.forEach(item => {
                f[item.prefixKey] = settings[item.prefixKey] ?? item.defaultPrefix;
                f[item.digitsKey] = String(settings[item.digitsKey] ?? item.defaultDigits);
            });
            setForm(f);
        }
    }, [settings]);

    const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const body: Record<string, any> = {};
            CODE_ITEMS.forEach(item => {
                body[item.prefixKey] = form[item.prefixKey] || item.defaultPrefix;
                body[item.digitsKey] = parseInt(form[item.digitsKey]) || item.defaultDigits;
            });
            await fetchJson('/erp/settings', { method: 'PUT', body: JSON.stringify(body) });
            queryClient.invalidateQueries({ queryKey: ['erp-settings'] });
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) return <div style={{ color: 'var(--text-tertiary)', padding: 40, textAlign: 'center' }}>{isChinese ? '加载中...' : 'Loading...'}</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <th style={{ ...thStyle, padding: '12px 16px' }}>{isChinese ? '单据类型' : 'Entity'}</th>
                            <th style={{ ...thStyle, padding: '12px 16px', width: 150 }}>{isChinese ? '前缀' : 'Prefix'}</th>
                            <th style={{ ...thStyle, padding: '12px 16px', width: 120 }}>{isChinese ? '流水位数' : 'Digits'}</th>
                            <th style={{ ...thStyle, padding: '12px 16px', width: 160 }}>{isChinese ? '示例' : 'Example'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CODE_ITEMS.map(item => {
                            const prefix = form[item.prefixKey] || item.defaultPrefix;
                            const digits = parseInt(form[item.digitsKey]) || item.defaultDigits;
                            const example = prefix + '1'.padStart(digits, '0');
                            return (
                                <tr key={item.prefixKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ ...tdStyle, padding: '10px 16px', fontWeight: 500 }}>{isChinese ? item.labelZh : item.labelEn}</td>
                                    <td style={{ padding: '8px 16px' }}>
                                        <input value={form[item.prefixKey] || ''} onChange={e => update(item.prefixKey, e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                                    </td>
                                    <td style={{ padding: '8px 16px' }}>
                                        <input type="number" min={1} max={8} value={form[item.digitsKey] || ''} onChange={e => update(item.digitsKey, e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                                    </td>
                                    <td style={{ ...tdStyle, padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                        {example}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                    {saving ? (isChinese ? '保存中...' : 'Saving...') : (isChinese ? '保存设置' : 'Save Settings')}
                </button>
            </div>
        </div>
    );
}
