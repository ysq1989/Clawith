/**
 * Customers — Customer management page with search, filter, CRUD, and pagination.
 * Contacts are integrated into the edit dialog.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Customer {
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

interface CustomersResponse {
    items: Customer[];
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

/* ─── Customer Form Dialog ─── */
function CustomerForm({
    customer, onClose, isChinese,
}: {
    customer?: Customer;
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const isEdit = !!customer;

    // Customer form fields
    const [form, setForm] = useState({
        name: customer?.name ?? '',
        category_id: customer?.category_id ?? '',
        address: customer?.address ?? '',
        status: customer?.status ?? 'active',
        notes: customer?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Contact management state
    const [newContact, setNewContact] = useState({ name: '', position: '', email: '', phone: '', notes: '' });
    const [savingContact, setSavingContact] = useState(false);

    const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    // Fetch contacts in edit mode
    const { data: contacts = [] } = useQuery<Contact[]>({
        queryKey: ['erp-contacts', 'customer', customer?.id],
        queryFn: () => fetchJson<Contact[]>(`/erp/contacts?parent_type=customer&parent_id=${customer!.id}`),
        enabled: isEdit,
    });

    // Fetch categories and set default
    const { data: categories = [] } = useQuery<any[]>({
        queryKey: ['erp-categories', 'customer'],
        queryFn: () => fetchJson<any[]>(`/erp/categories?type=customer`),
    });
    // Auto-set default category on new customer
    const defaultCategoryId = categories.length > 0 ? categories[0].id : '';
    const effectiveCategoryId = form.category_id || defaultCategoryId;

    // Add new contact
    const handleAddContact = async () => {
        if (!newContact.name.trim() || !customer) return;
        setSavingContact(true);
        try {
            const isFirst = contacts.length === 0;
            await fetchJson(`/erp/contacts?parent_type=customer&parent_id=${customer.id}`, {
                method: 'POST',
                body: JSON.stringify({ ...newContact, is_default: isFirst }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'customer', customer.id] });
            setNewContact({ name: '', position: '', email: '', phone: '', notes: '' });
        } finally {
            setSavingContact(false);
        }
    };

    // Delete a contact
    const handleDeleteContact = async (id: string) => {
        if (!customer) return;
        await fetchJson(`/erp/contacts/${id}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'customer', customer.id] });
    };

    // Set a contact as default
    const handleSetDefault = async (id: string) => {
        if (!customer) return;
        await fetchJson(`/erp/contacts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_default: true }),
        });
        queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'customer', customer.id] });
    };

    // Save customer
    const handleSubmit = async () => {
        if (!form.name.trim()) { setError(isChinese ? '请输入客户名称' : 'Please enter customer name'); return; }
        setSaving(true); setError('');
        try {
            const submitData = { ...form, category_id: effectiveCategoryId || null };
            if (customer) {
                await fetchJson(`/erp/customers/${customer.id}`, { method: 'PATCH', body: JSON.stringify(submitData) });
            } else {
                await fetchJson('/erp/customers', { method: 'POST', body: JSON.stringify(form) });
            }
            queryClient.invalidateQueries({ queryKey: ['erp-customers'] });
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
                    {customer ? (isChinese ? '编辑客户' : 'Edit Customer') : (isChinese ? '新建客户' : 'New Customer')}
                </h3>

                {/* ── Basic Info ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: isEdit ? 24 : 0 }}>
                    <FormField label={isChinese ? '客户名称 *' : 'Customer Name *'} value={form.name} onChange={v => update('name', v)} />
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '客户分类' : 'Category'}
                        </label>
                        <select
                            value={effectiveCategoryId}
                            onChange={e => update('category_id', e.target.value)}
                            style={{ ...inputStyle, width: '100%' }}
                        >
                            {categories.length === 0 && <option value="">{isChinese ? '暂无分类' : 'No categories'}</option>}
                            {categories.map((cat: any) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
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
export default function Customers() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();
    const dialog = useDialog();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-customers', search, statusFilter, page],
        queryFn: () => fetchJson<CustomersResponse>(
            `/erp/customers?search=${encodeURIComponent(search)}&status=${statusFilter === 'all' ? '' : statusFilter}&page=${page}&page_size=20`,
        ),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/customers/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['erp-customers'] }),
    });

    const customers = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const handleDelete = async (id: string) => {
        const ok = await dialog.confirm(
            isChinese ? '确定删除此客户？此操作不可恢复。' : 'Are you sure you want to delete this customer?',
            { title: isChinese ? '删除客户' : 'Delete Customer', danger: true, confirmLabel: isChinese ? '删除' : 'Delete' },
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
                        placeholder={t('erp.customers.searchPlaceholder', '搜索客户名称...')}
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
                <button style={btnPrimary} onClick={() => { setEditingCustomer(undefined); setShowForm(true); }}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.customers.new', '新建客户')}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, overflow: 'hidden',
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.customer.name', '客户名称')}</th>
                                <th style={thStyle}>{t('erp.customer.defaultContact', '默认联系人')}</th>
                                <th style={thStyle}>{t('erp.customer.contactPhone', '联系人电话')}</th>
                                <th style={thStyle}>{t('erp.customer.status', '状态')}</th>
                                <th style={thStyle}>{t('erp.customer.createdAt', '创建时间')}</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>{t('erp.actions', '操作')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                            ) : customers.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                            ) : customers.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}>{c.name}</td>
                                    <td style={tdStyle}>{c.default_contact_name || '-'}</td>
                                    <td style={tdStyle}>{c.default_contact_phone || '-'}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                            background: c.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                            border: `1px solid ${c.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            color: c.status === 'active' ? '#22c55e' : '#ef4444',
                                        }}>
                                            {c.status === 'active' ? (isChinese ? '活跃' : 'Active') : (isChinese ? '停用' : 'Inactive')}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>{c.created_at ? new Date(c.created_at).toLocaleString() : '-'}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => { setEditingCustomer(c); setShowForm(true); }}
                                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                                title={isChinese ? '编辑' : 'Edit'}
                                            >
                                                <IconEdit size={14} stroke={1.5} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c.id)}
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
                <CustomerForm
                    customer={editingCustomer}
                    isChinese={isChinese}
                    onClose={(saved) => { setShowForm(false); setEditingCustomer(undefined); }}
                />
            )}
        </div>
    );
}
