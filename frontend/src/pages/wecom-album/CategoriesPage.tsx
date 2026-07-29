/**
 * WeChat Business Album — Category management page.
 * Tree-structured categories with parent-child hierarchy, sorting, and show/hide.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import {
    IconPlus, IconTrash, IconEdit, IconCheck, IconX,
    IconChevronDown, IconChevronRight, IconEye, IconEyeOff,
    IconDraggable, IconArrowsSort,
} from '@tabler/icons-react';

interface Category {
    id: number;
    pid: number;
    cate_name: string;
    sort: number;
    is_show: boolean;
    children?: Category[];
}

export default function CategoriesPage() {
    const { i18n } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isChinese = i18n.language?.startsWith('zh');

    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addPid, setAddPid] = useState(0);
    const [addName, setAddName] = useState('');
    const [addSort, setAddSort] = useState(0);

    const { data: categories = [], isLoading } = useQuery({
        queryKey: ['wecom-album-categories'],
        queryFn: () => fetchJson<Category[]>('/wecom-album/categories'),
    });

    const createMutation = useMutation({
        mutationFn: async (data: { cate_name: string; pid: number; sort: number }) => {
            return fetchJson<any>('/wecom-album/categories', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
        onSuccess: () => {
            toast.success(isChinese ? '分类已添加' : 'Category added');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-categories'] });
            setShowAddForm(false);
            setAddName('');
            setAddSort(0);
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '添加失败' : 'Add failed'));
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: number; cate_name?: string; sort?: number; is_show?: boolean }) => {
            return fetchJson<any>(`/wecom-album/categories/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wecom-album-categories'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '更新失败' : 'Update failed'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return fetchJson<any>(`/wecom-album/categories/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            toast.success(isChinese ? '分类已删除' : 'Category deleted');
            queryClient.invalidateQueries({ queryKey: ['wecom-album-categories'] });
        },
        onError: (err: any) => {
            toast.error(err?.detail || (isChinese ? '删除失败' : 'Delete failed'));
        },
    });

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setEditingName(cat.cate_name);
    };

    const saveEdit = (id: number) => {
        if (!editingName.trim()) return;
        updateMutation.mutate({ id, cate_name: editingName.trim() });
        setEditingId(null);
    };

    const handleAdd = () => {
        if (!addName.trim()) {
            toast.error(isChinese ? '请输入分类名称' : 'Please enter category name');
            return;
        }
        createMutation.mutate({ cate_name: addName.trim(), pid: addPid, sort: addSort });
    };

    const renderCategory = (cat: Category, level: number = 0) => {
        const hasChildren = cat.children && cat.children.length > 0;
        const isExpanded = expandedIds.has(cat.id);
        const isEditing = editingId === cat.id;

        return (
            <div key={cat.id}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        paddingLeft: level * 24 + 12,
                        background: level === 0 ? 'var(--bg-secondary)' : 'transparent',
                        borderBottom: '1px solid var(--border-primary)',
                        minHeight: 40,
                    }}
                >
                    {/* Expand/collapse */}
                    <button
                        onClick={() => toggleExpand(cat.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: hasChildren ? 'pointer' : 'default',
                            color: 'var(--text-tertiary)',
                            padding: 2,
                            width: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: hasChildren ? 1 : 0,
                        }}
                    >
                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </button>

                    {/* ID */}
                    <span style={{
                        minWidth: 40,
                        padding: '2px 6px',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                    }}>
                        {cat.id}
                    </span>

                    {/* Name */}
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                            <input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit(cat.id)}
                                autoFocus
                                style={{
                                    flex: 1,
                                    padding: '4px 8px',
                                    border: '1px solid #4f46e5',
                                    borderRadius: 4,
                                    fontSize: 13,
                                }}
                            />
                            <button onClick={() => saveEdit(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}>
                                <IconCheck size={16} />
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                                <IconX size={16} />
                            </button>
                        </div>
                    ) : (
                        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>
                            {level > 0 && <span style={{ color: 'var(--text-tertiary)' }}>└ </span>}
                            {cat.cate_name}
                        </span>
                    )}

                    {/* Sort */}
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 30, textAlign: 'center' }}>
                        {cat.sort}
                    </span>

                    {/* Show/hide */}
                    <button
                        onClick={() => updateMutation.mutate({ id: cat.id, is_show: !cat.is_show })}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: cat.is_show ? '#16a34a' : 'var(--text-tertiary)',
                            padding: 4,
                        }}
                        title={cat.is_show ? (isChinese ? '显示' : 'Visible') : (isChinese ? '隐藏' : 'Hidden')}
                    >
                        {cat.is_show ? <IconEye size={16} /> : <IconEyeOff size={16} />}
                    </button>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            onClick={() => startEdit(cat)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                            title={isChinese ? '编辑' : 'Edit'}
                        >
                            <IconEdit size={14} />
                        </button>
                        {level === 0 && (
                            <button
                                onClick={() => { setAddPid(cat.id); setShowAddForm(true); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', padding: 4 }}
                                title={isChinese ? '添加子分类' : 'Add child'}
                            >
                                <IconPlus size={14} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (confirm(isChinese ? `确定删除「${cat.cate_name}」及其子分类？` : `Delete "${cat.cate_name}" and its children?`)) {
                                    deleteMutation.mutate(cat.id);
                                }
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}
                            title={isChinese ? '删除' : 'Delete'}
                        >
                            <IconTrash size={14} />
                        </button>
                    </div>
                </div>

                {/* Children */}
                {isExpanded && cat.children?.map(child => renderCategory(child, level + 1))}
            </div>
        );
    };

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {isChinese ? '分类设置' : 'Category Settings'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                {isChinese
                    ? '管理AI清洗时使用的商品分类。支持顶级分类和二级分类。'
                    : 'Manage product categories for AI cleaning. Supports top-level and second-level categories.'}
            </p>

            {/* Add button */}
            <div style={{ marginBottom: 16 }}>
                <button
                    onClick={() => { setAddPid(0); setShowAddForm(true); }}
                    style={{
                        padding: '8px 16px',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 14,
                    }}
                >
                    <IconPlus size={16} />
                    {isChinese ? '添加分类' : 'Add Category'}
                </button>
            </div>

            {/* Add form */}
            {showAddForm && (
                <div style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 12,
                    border: '1px solid var(--border-primary)',
                    padding: 16,
                    marginBottom: 16,
                }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                        {addPid ? (isChinese ? '添加子分类' : 'Add Child Category') : (isChinese ? '添加顶级分类' : 'Add Top Category')}
                    </h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={addName}
                            onChange={(e) => setAddName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder={isChinese ? '分类名称' : 'Category name'}
                            autoFocus
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 6,
                                fontSize: 13,
                            }}
                        />
                        <input
                            type="number"
                            value={addSort}
                            onChange={(e) => setAddSort(Number(e.target.value))}
                            placeholder={isChinese ? '排序' : 'Sort'}
                            style={{
                                width: 80,
                                padding: '8px 10px',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 6,
                                fontSize: 13,
                            }}
                        />
                        <button onClick={handleAdd} style={{
                            padding: '8px 14px',
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 13,
                            cursor: 'pointer',
                        }}>
                            {isChinese ? '确定' : 'OK'}
                        </button>
                        <button onClick={() => setShowAddForm(false)} style={{
                            padding: '8px 14px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 6,
                            fontSize: 13,
                            cursor: 'pointer',
                        }}>
                            {isChinese ? '取消' : 'Cancel'}
                        </button>
                    </div>
                </div>
            )}

            {/* Category tree */}
            <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 12,
                border: '1px solid var(--border-primary)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                }}>
                    <span style={{ width: 20 }} />
                    <span style={{ minWidth: 40 }}>ID</span>
                    <span style={{ flex: 1 }}>{isChinese ? '分类名称' : 'Name'}</span>
                    <span style={{ minWidth: 30, textAlign: 'center' }}>{isChinese ? '排序' : 'Sort'}</span>
                    <span style={{ width: 24 }}>{isChinese ? '状态' : 'Status'}</span>
                    <span style={{ width: 80 }}>{isChinese ? '操作' : 'Actions'}</span>
                </div>

                {/* List */}
                {isLoading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        {isChinese ? '加载中...' : 'Loading...'}
                    </div>
                ) : categories.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        {isChinese ? '暂无分类，请添加' : 'No categories yet'}
                    </div>
                ) : (
                    categories.map(cat => renderCategory(cat))
                )}
            </div>
        </div>
    );
}
