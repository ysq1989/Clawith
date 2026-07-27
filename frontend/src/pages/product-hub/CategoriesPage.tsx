/**
 * Product Hub Categories Page — Manage product categories.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconCategory, IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';

interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
}

export default function CategoriesPage() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formIcon, setFormIcon] = useState('');

    const { data: categories, isLoading } = useQuery({
        queryKey: ['product-hub-categories'],
        queryFn: () => fetchJson<any>('/product-hub/categories'),
    });

    const createMutation = useMutation({
        mutationFn: (body: { name: string; icon?: string }) =>
            fetchJson('/product-hub/categories', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-categories'] });
            toast.success(isChinese ? '分类已创建' : 'Category created');
            setShowCreate(false);
            setFormName('');
            setFormIcon('');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...body }: { id: string; name: string; icon?: string }) =>
            fetchJson(`/product-hub/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-categories'] });
            toast.success(isChinese ? '分类已更新' : 'Category updated');
            setEditingId(null);
            setFormName('');
            setFormIcon('');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            fetchJson(`/product-hub/categories/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-hub-categories'] });
            toast.success(isChinese ? '已删除' : 'Deleted');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
    });

    const cats: Category[] = Array.isArray(categories) ? categories : [];
    // Build tree
    const roots = cats.filter((c) => !c.parent_id);
    const children = (parentId: string) => cats.filter((c) => c.parent_id === parentId);

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setFormName(cat.name);
        setFormIcon(cat.icon || '');
    };

    const handleSubmit = () => {
        if (!formName.trim()) {
            toast.error(isChinese ? '请输入分类名称' : 'Name is required');
            return;
        }
        const body = { name: formName.trim(), icon: formIcon.trim() || undefined };
        if (editingId) {
            updateMutation.mutate({ id: editingId, ...body });
        } else {
            createMutation.mutate(body);
        }
    };

    const renderCategory = (cat: Category, depth: number = 0) => {
        const kids = children(cat.id);
        return (
            <div key={cat.id}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        paddingLeft: 16 + depth * 24,
                        borderBottom: '1px solid var(--border-primary)',
                    }}
                >
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{cat.icon || '📁'}</span>
                    {editingId === cat.id ? (
                        <input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            style={{
                                flex: 1,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--color-primary)',
                                fontSize: 14,
                            }}
                        />
                    ) : (
                        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>{cat.name}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {kids.length > 0 ? `${kids.length} ${isChinese ? '个子分类' : 'sub'}` : ''}
                    </span>
                    {editingId === cat.id ? (
                        <button
                            onClick={handleSubmit}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 500, fontSize: 13 }}
                        >
                            {isChinese ? '保存' : 'Save'}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => startEdit(cat)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            >
                                <IconEdit size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm(isChinese ? `确定删除「${cat.name}」吗？` : `Delete "${cat.name}"?`)) {
                                        deleteMutation.mutate(cat.id);
                                    }
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                            >
                                <IconTrash size={16} />
                            </button>
                        </>
                    )}
                </div>
                {kids.map((kid) => renderCategory(kid, depth + 1))}
            </div>
        );
    };

    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t('productHub.categories.title', '分类管理')}
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {t('productHub.categories.subtitle', '管理商品分类体系')}
                    </p>
                </div>
                <button
                    onClick={() => { setShowCreate(true); setEditingId(null); setFormName(''); setFormIcon(''); }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--color-primary)',
                        color: 'white',
                        fontWeight: 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <IconPlus size={16} />
                    {isChinese ? '新建分类' : 'New Category'}
                </button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                    {isChinese ? '加载中...' : 'Loading...'}
                </div>
            ) : roots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                    <IconCategory size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p>{isChinese ? '暂无分类，点击上方按钮创建' : 'No categories yet'}</p>
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
                    {roots.map((root) => renderCategory(root))}
                </div>
            )}

            {/* Create dialog */}
            {showCreate && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    onClick={() => setShowCreate(false)}
                >
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 12, width: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                            {isChinese ? '新建分类' : 'New Category'}
                        </h3>
                        <input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={isChinese ? '分类名称' : 'Category name'}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
                                marginBottom: 12, fontSize: 14, boxSizing: 'border-box',
                            }}
                        />
                        <input
                            value={formIcon}
                            onChange={(e) => setFormIcon(e.target.value)}
                            placeholder={isChinese ? '图标 emoji（可选）' : 'Icon emoji (optional)'}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
                                marginBottom: 16, fontSize: 14, boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 14 }}>
                                {isChinese ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={createMutation.isPending}
                                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                            >
                                {createMutation.isPending ? '...' : (isChinese ? '创建' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
