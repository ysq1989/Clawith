/**
 * WeChat Business Album — Category settings page.
 * Manages the category mapping used by AI cleaning.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import { IconPlus, IconTrash, IconCheck, IconX } from '@tabler/icons-react';

interface Category {
    id: number;
    name: string;
    parent?: string;
}

/** Default categories for jewelry/jade */
const DEFAULT_CATEGORIES: Category[] = [
    { id: 246, name: '手镯', parent: '翡翠' },
    { id: 245, name: '戒指', parent: '翡翠' },
    { id: 244, name: '耳坠', parent: '翡翠' },
    { id: 243, name: '项链', parent: '翡翠' },
    { id: 242, name: '手链', parent: '翡翠' },
    { id: 241, name: '手串', parent: '翡翠' },
    { id: 240, name: '吊坠', parent: '翡翠' },
];

const STORAGE_KEY = 'wecom_album_categories';

function loadCategories(): Category[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return DEFAULT_CATEGORIES;
}

function saveCategories(categories: Category[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export default function CategoriesPage() {
    const { i18n } = useTranslation();
    const toast = useToast();
    const isChinese = i18n.language?.startsWith('zh');

    const [categories, setCategories] = useState<Category[]>(loadCategories);
    const [editing, setEditing] = useState(false);
    const [newId, setNewId] = useState('');
    const [newName, setNewName] = useState('');
    const [newParent, setNewParent] = useState('翡翠');

    const handleSave = () => {
        saveCategories(categories);
        toast.success(isChinese ? '分类已保存' : 'Categories saved');
        setEditing(false);
    };

    const handleAdd = () => {
        const id = parseInt(newId, 10);
        if (!id || !newName.trim()) {
            toast.error(isChinese ? '请填写分类ID和名称' : 'Please fill in ID and name');
            return;
        }
        if (categories.some(c => c.id === id)) {
            toast.error(isChinese ? '分类ID已存在' : 'Category ID already exists');
            return;
        }
        setCategories([...categories, { id, name: newName.trim(), parent: newParent.trim() || undefined }]);
        setNewId('');
        setNewName('');
        setEditing(true);
    };

    const handleRemove = (id: number) => {
        setCategories(categories.filter(c => c.id !== id));
        setEditing(true);
    };

    const handleReset = () => {
        setCategories(DEFAULT_CATEGORIES);
        saveCategories(DEFAULT_CATEGORIES);
        toast.success(isChinese ? '已恢复默认分类' : 'Reset to defaults');
        setEditing(false);
    };

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                {isChinese ? '分类设置' : 'Category Settings'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                {isChinese
                    ? '管理AI清洗时使用的商品分类。分类ID用于AI自动分类结果。'
                    : 'Manage product categories used by AI cleaning. Category IDs are used in AI classification results.'}
            </p>

            {/* Current categories */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-primary)', padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {isChinese ? '分类列表' : 'Category List'}
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleReset}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 6,
                                fontSize: 13,
                                cursor: 'pointer',
                            }}
                        >
                            {isChinese ? '恢复默认' : 'Reset'}
                        </button>
                        {editing && (
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '6px 12px',
                                    background: '#4f46e5',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <IconCheck size={14} />
                                {isChinese ? '保存' : 'Save'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Category list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {categories.map(cat => (
                        <div
                            key={cat.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '10px 14px',
                                background: 'var(--bg-secondary)',
                                borderRadius: 8,
                                border: '1px solid var(--border-primary)',
                            }}
                        >
                            <span style={{
                                minWidth: 50,
                                padding: '2px 8px',
                                background: '#f0f9ff',
                                color: '#0369a1',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                textAlign: 'center',
                            }}>
                                {cat.id}
                            </span>
                            <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>
                                {cat.parent ? `${cat.parent}>` : ''}{cat.name}
                            </span>
                            <button
                                onClick={() => handleRemove(cat.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-tertiary)',
                                    padding: 4,
                                    borderRadius: 4,
                                }}
                                title={isChinese ? '删除' : 'Delete'}
                            >
                                <IconTrash size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add new category */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-primary)', padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                    {isChinese ? '添加分类' : 'Add Category'}
                </h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="number"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        placeholder={isChinese ? '分类ID' : 'ID'}
                        style={{
                            width: 80,
                            padding: '8px 10px',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 6,
                            fontSize: 13,
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                        }}
                    />
                    <input
                        value={newParent}
                        onChange={(e) => setNewParent(e.target.value)}
                        placeholder={isChinese ? '父级（如翡翠）' : 'Parent'}
                        style={{
                            width: 100,
                            padding: '8px 10px',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 6,
                            fontSize: 13,
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                        }}
                    />
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder={isChinese ? '分类名称（如手镯）' : 'Name'}
                        style={{
                            flex: 1,
                            padding: '8px 10px',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 6,
                            fontSize: 13,
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                        }}
                    />
                    <button
                        onClick={handleAdd}
                        style={{
                            padding: '8px 14px',
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        <IconPlus size={14} />
                        {isChinese ? '添加' : 'Add'}
                    </button>
                </div>
            </div>

            {/* AI prompt preview */}
            <div style={{ marginTop: 20, padding: 16, background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a' }}>
                <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                    {isChinese
                        ? '💡 提示：分类列表会自动应用到AI清洗提示词中。保存后，新清洗的商品将使用更新后的分类。'
                        : '💡 Tip: The category list is automatically applied to AI cleaning prompts. After saving, newly cleaned products will use the updated categories.'}
                </p>
            </div>
        </div>
    );
}
