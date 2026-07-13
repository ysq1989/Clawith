/**
 * Suppliers — Supplier management page. Structure mirrors Customers.tsx.
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconDownload, IconUpload } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Supplier {
    id: string;
    name: string;
    contact_name: string;
    email: string;
    phone: string;
    address: string;
    status: string;
    notes: string;
    created_at: string;
    updated_at: string;
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
    phone: string;
    notes: string;
    created_at: string;
}

interface Attachment {
    id: string;
    filename: string;
    file_size: number;
    created_at: string;
}

const API_BASE = '/api';

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

/* ─── Supplier Form Dialog ─── */
function SupplierForm({
    supplier, onClose, isChinese,
}: {
    supplier?: Supplier;
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        name: supplier?.name ?? '',
        contact_name: supplier?.contact_name ?? '',
        email: supplier?.email ?? '',
        phone: supplier?.phone ?? '',
        address: supplier?.address ?? '',
        status: supplier?.status ?? 'active',
        notes: supplier?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { setError(isChinese ? '请输入供应商名称' : 'Please enter supplier name'); return; }
        setSaving(true); setError('');
        try {
            if (supplier) {
                await fetchJson(`/erp/suppliers/${supplier.id}`, { method: 'PATCH', body: JSON.stringify(form) });
            } else {
                await fetchJson('/erp/suppliers', { method: 'POST', body: JSON.stringify(form) });
            }
            queryClient.invalidateQueries({ queryKey: ['erp-suppliers'] });
            onClose(true);
        } catch (e: any) {
            setError(e.message ?? 'Error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onClose(false)}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 480, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {supplier ? (isChinese ? '编辑供应商' : 'Edit Supplier') : (isChinese ? '新建供应商' : 'New Supplier')}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <FormField label={isChinese ? '供应商名称 *' : 'Supplier Name *'} value={form.name} onChange={v => update('name', v)} />
                    <FormField label={isChinese ? '联系人' : 'Contact Person'} value={form.contact_name} onChange={v => update('contact_name', v)} />
                    <FormField label={isChinese ? '邮箱' : 'Email'} type="email" value={form.email} onChange={v => update('email', v)} />
                    <FormField label={isChinese ? '电话' : 'Phone'} value={form.phone} onChange={v => update('phone', v)} />
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

/* ─── Helpers ─── */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ─── Supplier Detail Dialog ─── */
function SupplierDetailDialog({ supplier, onClose, isChinese }: {
    supplier: Supplier;
    onClose: () => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newContact, setNewContact] = useState({ name: '', position: '', phone: '', notes: '' });
    const [savingContact, setSavingContact] = useState(false);
    const [uploading, setUploading] = useState(false);

    const { data: contacts = [] } = useQuery<Contact[]>({
        queryKey: ['erp-contacts', 'supplier', supplier.id],
        queryFn: () => fetchJson<Contact[]>(`/erp/contacts?parent_type=supplier&parent_id=${supplier.id}`),
    });

    const { data: attachments = [] } = useQuery<Attachment[]>({
        queryKey: ['erp-attachments', 'supplier', supplier.id],
        queryFn: () => fetchJson<Attachment[]>(`/erp/attachments?parent_type=supplier&parent_id=${supplier.id}`),
    });

    const createContactMutation = useMutation({
        mutationFn: (data: { name: string; position: string; phone: string; notes: string }) =>
            fetchJson(`/erp/contacts?parent_type=supplier&parent_id=${supplier.id}`, { method: 'POST', body: JSON.stringify(data) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'supplier', supplier.id] });
            setNewContact({ name: '', position: '', phone: '', notes: '' });
        },
    });

    const deleteContactMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/contacts/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['erp-contacts', 'supplier', supplier.id] }),
    });

    const deleteAttachmentMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/attachments/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['erp-attachments', 'supplier', supplier.id] }),
    });

    const handleAddContact = async () => {
        if (!newContact.name.trim()) return;
        setSavingContact(true);
        try {
            await createContactMutation.mutateAsync(newContact);
        } finally {
            setSavingContact(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', file);
            await fetch(`${API_BASE}/erp/attachments?parent_type=supplier&parent_id=${supplier.id}`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });
            queryClient.invalidateQueries({ queryKey: ['erp-attachments', 'supplier', supplier.id] });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = (attachment: Attachment) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/erp/attachments/${attachment.id}/download?token=${encodeURIComponent(token || '')}`;
        window.open(url, '_blank');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 600, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isChinese ? '供应商详情' : 'Supplier Details'}
                </h3>

                {/* Basic Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 20, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <div><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '名称' : 'Name'}: </span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{supplier.name}</span></div>
                    <div><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '联系人' : 'Contact'}: </span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{supplier.contact_name || '-'}</span></div>
                    <div><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '邮箱' : 'Email'}: </span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{supplier.email || '-'}</span></div>
                    <div><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '电话' : 'Phone'}: </span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{supplier.phone || '-'}</span></div>
                </div>

                {/* Contacts Section */}
                <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isChinese ? '联系人列表' : 'Contacts'}
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '姓名' : 'Name'}</th>
                                <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '职位' : 'Position'}</th>
                                <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '电话' : 'Phone'}</th>
                                <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px' }}>{isChinese ? '备注' : 'Notes'}</th>
                                <th style={{ ...thStyle, fontSize: 11, padding: '6px 8px', textAlign: 'center', width: 60 }}>{isChinese ? '操作' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.map(ct => (
                                <tr key={ct.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.name}</td>
                                    <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.position || '-'}</td>
                                    <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.phone || '-'}</td>
                                    <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 12 }}>{ct.notes || '-'}</td>
                                    <td style={{ ...tdStyle, padding: '6px 8px', textAlign: 'center' }}>
                                        <button onClick={() => deleteContactMutation.mutate(ct.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                                            <IconTrash size={13} stroke={1.5} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {/* New contact row */}
                            <tr style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                <td style={{ padding: '4px 4px' }}>
                                    <input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder={isChinese ? '姓名 *' : 'Name *'} style={{ ...inputStyle, width: '100%', padding: '4px 6px', fontSize: 12 }} />
                                </td>
                                <td style={{ padding: '4px 4px' }}>
                                    <input value={newContact.position} onChange={e => setNewContact(p => ({ ...p, position: e.target.value }))} placeholder={isChinese ? '职位' : 'Position'} style={{ ...inputStyle, width: '100%', padding: '4px 6px', fontSize: 12 }} />
                                </td>
                                <td style={{ padding: '4px 4px' }}>
                                    <input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder={isChinese ? '电话' : 'Phone'} style={{ ...inputStyle, width: '100%', padding: '4px 6px', fontSize: 12 }} />
                                </td>
                                <td style={{ padding: '4px 4px' }}>
                                    <input value={newContact.notes} onChange={e => setNewContact(p => ({ ...p, notes: e.target.value }))} placeholder={isChinese ? '备注' : 'Notes'} style={{ ...inputStyle, width: '100%', padding: '4px 6px', fontSize: 12 }} />
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                    <button onClick={handleAddContact} disabled={savingContact || !newContact.name.trim()} style={{ ...btnPrimary, padding: '3px 10px', fontSize: 11, opacity: (!newContact.name.trim() || savingContact) ? 0.5 : 1 }}>
                                        {savingContact ? '...' : (isChinese ? '添加' : 'Add')}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Attachments Section */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isChinese ? '附件列表' : 'Attachments'}
                        </h4>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...btnPrimary, padding: '4px 12px', fontSize: 12, opacity: uploading ? 0.6 : 1 }}>
                            <IconUpload size={14} stroke={1.5} />
                            {uploading ? (isChinese ? '上传中...' : 'Uploading...') : (isChinese ? '上传文件' : 'Upload')}
                        </button>
                        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
                    </div>
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                        {attachments.length === 0 ? (
                            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>{isChinese ? '暂无附件' : 'No attachments'}</div>
                        ) : attachments.map(att => (
                            <div key={att.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        {formatFileSize(att.file_size)} &middot; {att.created_at ? new Date(att.created_at).toLocaleDateString() : ''}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                    <button onClick={() => handleDownload(att)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 2 }} title={isChinese ? '下载' : 'Download'}>
                                        <IconDownload size={14} stroke={1.5} />
                                    </button>
                                    <button onClick={() => deleteAttachmentMutation.mutate(att.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }} title={isChinese ? '删除' : 'Delete'}>
                                        <IconTrash size={14} stroke={1.5} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <button style={btnSecondary} onClick={onClose}>
                        {isChinese ? '关闭' : 'Close'}
                    </button>
                </div>
            </div>
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
    const [viewingSupplier, setViewingSupplier] = useState<Supplier | undefined>(undefined);

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
                        placeholder={t('erp.suppliers.searchPlaceholder', '搜索供应商名称、联系人、邮箱...')}
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
                                <th style={thStyle}>{t('erp.supplier.contact', '联系人')}</th>
                                <th style={thStyle}>{t('erp.supplier.email', '邮箱')}</th>
                                <th style={thStyle}>{t('erp.supplier.phone', '电话')}</th>
                                <th style={thStyle}>{t('erp.supplier.status', '状态')}</th>
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
                                    <td style={tdStyle}>{s.contact_name}</td>
                                    <td style={tdStyle}>{s.email}</td>
                                    <td style={tdStyle}>{s.phone}</td>
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
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setViewingSupplier(s)}
                                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                                title={isChinese ? '详情' : 'Details'}
                                            >
                                                <IconEye size={14} stroke={1.5} />
                                            </button>
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

            {/* ── Detail dialog ── */}
            {viewingSupplier && (
                <SupplierDetailDialog
                    supplier={viewingSupplier}
                    isChinese={isChinese}
                    onClose={() => setViewingSupplier(undefined)}
                />
            )}
        </div>
    );
}
