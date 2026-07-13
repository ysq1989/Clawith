/**
 * Suppliers — Supplier management page with search, filter, CRUD, and pagination.
 * Contacts are integrated into the edit dialog. Structure mirrors Customers.tsx.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Supplier {
    id: string;
    name: string;
    address: string;
    status: string;
    notes: string;
    created_at: string;
    updated_at: string;
    default_contact_name?: string;
    default_contact_phone?: string;
    default_contact_email?: string;
}

interface SuppliersResponse {
    items: Supplier[];
    total: number;
    page: number;
    page_size: number;
}

interface Contact {
    id: string;
    name: string;
    position: string;
    email: string;
    phone: string;
    is_default: boolean;
    notes: string;
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

/* ─── Category Select (searchable dropdown) ─── */
function CategorySelect({ value, onChange, categories, isChinese }: {
    value: string; onChange: (id: string) => void; categories: any[]; isChinese: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selected = categories.find((c: any) => c.id === value);
    const filtered = search
        ? categories.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))
        : categories;
    return (
        <div style={{ position: 'relative' }}>
            <div
                onClick={() => setOpen(!open)}
                style={{ ...inputStyle, width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 }}
            >
                <span style={{ color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected?.name || (isChinese ? '-- 请选择分类 --' : '-- Select Category --')}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 4, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1001, overflow: 'hidden' }}>
                    {categories.length > 5 && (
                        <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>
                            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={isChinese ? '搜索分类...' : 'Search...'} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', color: '#1e293b', background: '#f8fafc' }} />
                        </div>
                    )}
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{isChinese ? '无匹配结果' : 'No results'}</div>
                        ) : filtered.map((cat: any) => (
                            <div
                                key={cat.id}
                                onClick={() => { onChange(cat.id); setOpen(false); setSearch(''); }}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b', background: cat.id === value ? '#eff6ff' : 'transparent', transition: 'background 0.1s' }}
                                onMouseEnter={e => { if (cat.id !== value) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = cat.id === value ? '#eff6ff' : 'transparent'; }}
                            >
                                {cat.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Supplier Form Dialog ─── */
function SupplierForm({
    supplier, onClose, isChinese,
}: {
    supplier?: Supplier;
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const isEdit = !!supplier;

    // Supplier form fields
    const [form, setForm] = useState({
        name: supplier?.name ?? '',
        category_id: supplier?.category_id ?? '',
        address: supplier?.address ?? '',
        status: supplier?.status ?? 'active',
        notes: supplier?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Contact management state
    const [newContact, setNewContact] = useState({ name: '', position: '', email: '', phone: '', notes: '' });
    const [savingContact, setSavingContact] = useState(false);

    const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    // Fetch contacts in edit mode
    const { data: contacts = [] } = useQuery<Contact[]>({
        queryKey: ['erp-contacts', 'supplier', supplier?.id],
        queryFn: () => fetchJson<Contact[]>(`/erp/contacts?parent_type=supplier&parent_id=${supplier!.id}`),
        enabled: isEdit,
    });

    // Fetch categories and set default
    const { data: categories = [] } = useQuery<any[]>({
        queryKey: ['erp-categories', 'supplier'],
        queryFn: () => fetchJson<any[]>(`/erp/categories?type=supplier`),
    });
    const defaultCategoryId = (categories.find((c: any) => c.is_default) || categories[0])?.id || "";
    const effectiveCategoryId = form.category_id || defaultCategoryId;

    // Add new contact
    const handleAddContact = async () => {
        if (!newContact.name.trim() || !supplier) return;
        setSavingContact(true);
        try {
            const isFirst = contacts.length === 0;
            await fetchJson(`/erp/contacts?parent_type=supplier&parent_id=${supplier.id}`, {
                method: 'POST',
                body: JSON.stringify({ ...newContact, is_default: isFirst }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'supplier', supplier.id] });
            setNewContact({ name: '', position: '', email: '', phone: '', notes: '' });
        } finally {
            setSavingContact(false);
        }
    };

    // Delete a contact
    const handleDeleteContact = async (id: string) => {
        if (!supplier) return;
        await fetchJson(`/erp/contacts/${id}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'supplier', supplier.id] });
    };

    // Set a contact as default
    const handleSetDefault = async (id: string) => {
        if (!supplier) return;
        await fetchJson(`/erp/contacts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_default: true }),
        });
        queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'supplier', supplier.id] });
    };

    // Save supplier
    const handleSubmit = async () => {
        if (!form.name.trim()) { setError(isChinese ? '请输入供应商名称' : 'Please enter supplier name'); return; }
        setSaving(true); setError('');
        try {
            const submitData = { ...form, category_id: effectiveCategoryId || null };
            if (supplier) {
                await fetchJson(`/erp/suppliers/${supplier.id}`, { method: 'PATCH', body: JSON.stringify(submitData) });
            } else {
                await fetchJson('/erp/suppliers', { method: 'POST', body: JSON.stringify(submitData) });
            }
            queryClient.invalidateQueries({ queryKey: ['erp-suppliers'] });
            onClose(true);
        } catch (e: any) {
            setError(e.message ?? 'Error');
        } finally {
            setSaving(false);
        }
    };

    const cellInputStyle: React.CSSProperties = { ...inputStyle, width: '100%', padding: '4px 6px', fontSize: 12 };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onClose(false)}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 700, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {supplier ? (isChinese ? '编辑供应商' : 'Edit Supplier') : (isChinese ? '新建供应商' : 'New Supplier')}
                </h3>

                {/* ── Basic Info ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: isEdit ? 24 : 0 }}>
                    <FormField label={isChinese ? '供应商名称 *' : 'Supplier Name *'} value={form.name} onChange={v => update('name', v)} />
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '供应商分类' : 'Category'}
                        </label>
                        <CategorySelect
                            value={effectiveCategoryId}
                            onChange={(id: string) => update('category_id', id)}
                            categories={categories}
                            isChinese={isChinese}
                        />
                    </div>
                    <FormField label={isChinese ? '地址' : 'Address'} value={form.address} onChange={v => update('address', v)} />
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '状态' : 'Status'}
                        </label>
                        <select value={form.status} onChange={e => update('status', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                            <option value="active">{isChinese ? '活跃' : 'Active'}</option>
                            <option value="inactive">{isChinese ? '停用' : 'Inactive'}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '备注' : 'Notes'}
                        </label>
                        <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
                    </div>
                </div>

                {/* ── Contacts Section (edit mode only) ── */}
                {isEdit && (
                    <div style={{ marginBottom: 20 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isChinese ? '联系人列表' : 'Contacts'}
                        </h4>
                        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '姓名' : 'Name'} *</th>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '职位' : 'Position'}</th>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '邮箱' : 'Email'}</th>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '电话' : 'Phone'}</th>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '备注' : 'Notes'}</th>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px', textAlign: 'center', width: 50 }}>{isChinese ? '默认' : 'Default'}</th>
                                        <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px', textAlign: 'center', width: 50 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.map(ct => (
                                        <tr key={ct.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.name}</td>
                                            <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.position || '-'}</td>
                                            <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.email || '-'}</td>
                                            <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.phone || '-'}</td>
                                            <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.notes || '-'}</td>
                                            <td style={{ ...tdStyle, padding: '6px 8px', textAlign: 'center' }}>
                                                <input
                                                    type="radio"
                                                    name="default-contact"
                                                    checked={ct.is_default}
                                                    onChange={() => { if (!ct.is_default) handleSetDefault(ct.id); }}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, padding: '6px 8px', textAlign: 'center' }}>
                                                <button onClick={() => handleDeleteContact(ct.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                                                    <IconTrash size={13} stroke={1.5} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* New contact input row */}
                                    <tr style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                        <td style={{ padding: '4px 4px' }}>
                                            <input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder={isChinese ? '姓名 *' : 'Name *'} style={cellInputStyle} />
                                        </td>
                                        <td style={{ padding: '4px 4px' }}>
                                            <input value={newContact.position} onChange={e => setNewContact(p => ({ ...p, position: e.target.value }))} placeholder={isChinese ? '职位' : 'Position'} style={cellInputStyle} />
                                        </td>
                                        <td style={{ padding: '4px 4px' }}>
                                            <input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder={isChinese ? '邮箱' : 'Email'} style={cellInputStyle} />
                                        </td>
                                        <td style={{ padding: '4px 4px' }}>
                                            <input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder={isChinese ? '电话' : 'Phone'} style={cellInputStyle} />
                                        </td>
                                        <td style={{ padding: '4px 4px' }}>
                                            <input value={newContact.notes} onChange={e => setNewContact(p => ({ ...p, notes: e.target.value }))} placeholder={isChinese ? '备注' : 'Notes'} style={cellInputStyle} />
                                        </td>
                                        <td style={{ padding: '4px 4px' }} />
                                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                            <button onClick={handleAddContact} disabled={savingContact || !newContact.name.trim()} style={{ ...btnPrimary, padding: '3px 10px', fontSize: 11, opacity: (!newContact.name.trim() || savingContact) ? 0.5 : 1 }}>
                                                {savingContact ? '...' : (isChinese ? '添加' : 'Add')}
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

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
export default function Suppliers() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();
    const dialog = useDialog();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-suppliers', search, statusFilter, page],
        queryFn: () => fetchJson<SuppliersResponse>(
            `/erp/suppliers?search=${encodeURIComponent(search)}&status=${statusFilter === 'all' ? '' : statusFilter}&page=${page}&page_size=20`,
        ),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/suppliers/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['erp-suppliers'] }),
    });

    const suppliers = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const handleDelete = async (id: string) => {
        const ok = await dialog.confirm(
            isChinese ? '确定删除此供应商？此操作不可恢复。' : 'Are you sure you want to delete this supplier?',
            { title: isChinese ? '删除供应商' : 'Delete Supplier', danger: true, confirmLabel: isChinese ? '删除' : 'Delete' },
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
                        placeholder={t('erp.suppliers.searchPlaceholder', '搜索供应商名称...')}
                        style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, minWidth: 120 }}
                >
                    <option value="all">{isChinese ? '全部状态' : 'All Status'}</option>
                    <option value="active">{isChinese ? '活跃' : 'Active'}</option>
                    <option value="inactive">{isChinese ? '停用' : 'Inactive'}</option>
                </select>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => { setEditingSupplier(undefined); setShowForm(true); }}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.suppliers.new', '新建供应商')}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.supplier.name', '供应商名称')}</th>
                                <th style={thStyle}>{t('erp.supplier.defaultContact', '默认联系人')}</th>
                                <th style={thStyle}>{t('erp.supplier.contactPhone', '联系人电话')}</th>
                                <th style={thStyle}>{t('erp.supplier.status', '状态')}</th>
                                <th style={thStyle}>{t('erp.supplier.createdAt', '创建时间')}</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>{t('erp.actions', '操作')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                            ) : suppliers.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                            ) : suppliers.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}>{s.name}</td>
                                    <td style={tdStyle}>{s.default_contact_name || '-'}</td>
                                    <td style={tdStyle}>{s.default_contact_phone || '-'}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                            background: s.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                            border: `1px solid ${s.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            color: s.status === 'active' ? '#22c55e' : '#ef4444',
                                        }}>
                                            {s.status === 'active' ? (isChinese ? '活跃' : 'Active') : (isChinese ? '停用' : 'Inactive')}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => { setEditingSupplier(s); setShowForm(true); }}
                                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                                title={isChinese ? '编辑' : 'Edit'}
                                            >
                                                <IconEdit size={14} stroke={1.5} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                                title={isChinese ? '删除' : 'Delete'}
                                            >
                                                <IconTrash size={14} stroke={1.5} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <button style={btnSecondary} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                        {isChinese ? '上一页' : 'Prev'}
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {page} / {totalPages}
                    </span>
                    <button style={btnSecondary} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                        {isChinese ? '下一页' : 'Next'}
                    </button>
                </div>
            )}

            {/* ── Form dialog ── */}
            {showForm && (
                <SupplierForm
                    supplier={editingSupplier}
                    isChinese={isChinese}
                    onClose={() => { setShowForm(false); setEditingSupplier(undefined); }}
                />
            )}
        </div>
    );
}
