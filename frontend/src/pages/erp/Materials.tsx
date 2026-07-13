/**
 * Materials — Material management page with search, category filter, low-stock highlighting, and CRUD.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Material {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    cost_price: number;
    current_stock: number;
    min_stock: number;
    status: string;
    description: string;
    created_at: string;
    updated_at: string;
}

interface MaterialsResponse {
    items: Material[];
    total: number;
    page: number;
    page_size: number;
    categories: string[];
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

/* ─── Material Form Dialog ─── */
function MaterialForm({
    material, categories, onClose, isChinese,
}: {
    material?: Material;
    categories: string[];
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        name: material?.name ?? '',
        sku: material?.sku ?? '',
        category: material?.category ?? '',
        unit: material?.unit ?? '',
        cost_price: String(material?.cost_price ?? ''),
        current_stock: String(material?.current_stock ?? '0'),
        min_stock: String(material?.min_stock ?? '0'),
        status: material?.status ?? 'active',
        description: material?.description ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { setError(isChinese ? '请输入物料名称' : 'Please enter material name'); return; }
        if (!form.sku.trim()) { setError(isChinese ? '请输入 SKU' : 'Please enter SKU'); return; }
        setSaving(true); setError('');
        try {
            const body = {
                ...form,
                cost_price: parseFloat(form.cost_price) || 0,
                current_stock: parseInt(form.current_stock) || 0,
                min_stock: parseInt(form.min_stock) || 0,
            };
            if (material) {
                await fetchJson(`/erp/materials/${material.id}`, { method: 'PATCH', body: JSON.stringify(body) });
            } else {
                await fetchJson('/erp/materials', { method: 'POST', body: JSON.stringify(body) });
            }
            queryClient.invalidateQueries({ queryKey: ['erp-materials'] });
            onClose(true);
        } catch (e: any) {
            setError(e.message ?? 'Error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onClose(false)}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 520, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {material ? (isChinese ? '编辑物料' : 'Edit Material') : (isChinese ? '新建物料' : 'New Material')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <FormField label={isChinese ? '物料名称 *' : 'Material Name *'} value={form.name} onChange={v => update('name', v)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <FormField label={isChinese ? 'SKU *' : 'SKU *'} value={form.sku} onChange={v => update('sku', v)} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {isChinese ? '分类' : 'Category'}
                            </label>
                            <input
                                list="erp-material-categories"
                                value={form.category}
                                onChange={e => update('category', e.target.value)}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                            <datalist id="erp-material-categories">
                                {categories.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                        <div style={{ flex: 1 }}>
                            <FormField label={isChinese ? '单位' : 'Unit'} value={form.unit} onChange={v => update('unit', v)} />
                        </div>
                    </div>
                    <div>
                        <FormField label={isChinese ? '成本价' : 'Cost Price'} type="number" value={form.cost_price} onChange={v => update('cost_price', v)} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <FormField label={isChinese ? '当前库存' : 'Current Stock'} type="number" value={form.current_stock} onChange={v => update('current_stock', v)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <FormField label={isChinese ? '最低库存' : 'Min Stock'} type="number" value={form.min_stock} onChange={v => update('min_stock', v)} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '状态' : 'Status'}
                        </label>
                        <select value={form.status} onChange={e => update('status', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                            <option value="active">{isChinese ? '在用' : 'Active'}</option>
                            <option value="inactive">{isChinese ? '停用' : 'Inactive'}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '描述' : 'Description'}
                        </label>
                        <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
                    </div>
                </div>

                {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button style={btnSecondary} onClick={() => onClose(false)}>
                        {isChinese ? '取消' : 'Cancel'}
                    </button>
                    <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer' }} onClick={handleSubmit} disabled={saving}>
                        {saving ? (isChinese ? '保存中...' : 'Saving...') : (isChinese ? '保存' : 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
        </div>
    );
}

/* ─── Main component ─── */
export default function Materials() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();
    const dialog = useDialog();

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | undefined>(undefined);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-materials', search, categoryFilter, page],
        queryFn: () => fetchJson<MaterialsResponse>(
            `/erp/materials?search=${encodeURIComponent(search)}&category=${encodeURIComponent(categoryFilter)}&page=${page}&page_size=20`,
        ),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/materials/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['erp-materials'] }),
    });

    const materials = Array.isArray(data) ? data : (data?.items ?? []);
    const categories = data?.categories ?? [];
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const handleDelete = async (id: string) => {
        const ok = await dialog.confirm(
            isChinese ? '确定删除此物料？' : 'Are you sure you want to delete this material?',
            { title: isChinese ? '删除物料' : 'Delete Material', danger: true, confirmLabel: isChinese ? '删除' : 'Delete' },
        );
        if (ok) deleteMutation.mutate(id);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                    <IconSearch size={16} stroke={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder={t('erp.materials.searchPlaceholder', '搜索物料名称、SKU...')}
                        style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, minWidth: 140 }}
                >
                    <option value="">{isChinese ? '全部分类' : 'All Categories'}</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => { setEditingMaterial(undefined); setShowForm(true); }}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.materials.new', '新建物料')}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.material.name', '物料名称')}</th>
                                <th style={thStyle}>{t('erp.material.sku', 'SKU')}</th>
                                <th style={thStyle}>{t('erp.material.category', '分类')}</th>
                                <th style={thStyle}>{t('erp.material.unit', '单位')}</th>
                                <th style={thStyle}>{t('erp.material.costPrice', '成本价')}</th>
                                <th style={thStyle}>{t('erp.material.stock', '库存量')}</th>
                                <th style={thStyle}>{t('erp.material.status', '状态')}</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>{t('erp.actions', '操作')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                            ) : materials.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                            ) : materials.map(m => {
                                const isLowStock = m.current_stock < m.min_stock;
                                const rowBg = isLowStock ? 'rgba(239,68,68,0.06)' : 'transparent';
                                return (
                                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: rowBg }}>
                                        <td style={tdStyle}>{m.name}</td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{m.sku}</td>
                                        <td style={tdStyle}>{m.category}</td>
                                        <td style={tdStyle}>{m.unit}</td>
                                        <td style={tdStyle}>{m.cost_price}</td>
                                        <td style={{ ...tdStyle, color: isLowStock ? '#ef4444' : 'var(--text-primary)', fontWeight: isLowStock ? 600 : 400 }}>
                                            {m.current_stock}
                                            {isLowStock && <span style={{ fontSize: 11, marginLeft: 4 }}>({t('erp.material.lowStock', '低库存')})</span>}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                background: m.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                                border: `1px solid ${m.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                color: m.status === 'active' ? '#22c55e' : '#ef4444',
                                            }}>
                                                {m.status === 'active' ? (isChinese ? '在用' : 'Active') : (isChinese ? '停用' : 'Inactive')}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                <button onClick={() => { setEditingMaterial(m); setShowForm(true); }} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '编辑' : 'Edit'}>
                                                    <IconEdit size={14} stroke={1.5} />
                                                </button>
                                                <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '删除' : 'Delete'}>
                                                    <IconTrash size={14} stroke={1.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <button style={btnSecondary} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{isChinese ? '上一页' : 'Prev'}</button>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
                    <button style={btnSecondary} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{isChinese ? '下一页' : 'Next'}</button>
                </div>
            )}

            {showForm && (
                <MaterialForm
                    material={editingMaterial}
                    categories={categories}
                    isChinese={isChinese}
                    onClose={(saved) => { setShowForm(false); setEditingMaterial(undefined); }}
                />
            )}
        </div>
    );
}
