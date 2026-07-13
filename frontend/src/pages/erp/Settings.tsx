/**
 * ERP Settings — System settings with category management tabs.
 */

import { useState } from 'react';
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
                            <th style={{ ...thStyle, width: 160 }}>{isChinese ? '创建时间' : 'Created'}</th>
                            <th style={{ ...thStyle, width: 120, textAlign: 'center' }}>{isChinese ? '操作' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{isChinese ? '加载中...' : 'Loading...'}</td></tr>
                        ) : categories.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{isChinese ? '暂无分类' : 'No categories'}</td></tr>
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
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');

    const tabs = [
        { key: 'customer' as const, label: isChinese ? '客户分类' : 'Customer Categories' },
        { key: 'supplier' as const, label: isChinese ? '供应商分类' : 'Supplier Categories' },
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
            <CategoryTab type={activeTab} isChinese={isChinese} />
        </div>
    );
}
