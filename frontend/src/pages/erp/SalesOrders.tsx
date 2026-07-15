/**
 * SalesOrders — Sales order management with dynamic status tabs, create dialog with date picker,
 * order detail dialog with status transitions, and delete support.
 */

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEye, IconTrash, IconEdit } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface OrderLine {
    id?: string;
    product_id: string;
    product_name?: string;
    unit?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

interface SalesOrder {
    id: string;
    order_no: string;
    customer_id: string;
    customer_name: string;
    total_amount: number;
    status: string;
    order_date: string;
    due_date: string | null;
    notes: string;
    items: OrderLine[];
    created_at: string;
    updated_at: string;
}

interface OrdersResponse {
    items: SalesOrder[];
    total: number;
    page: number;
    page_size: number;
}

/* ─── Colors for known statuses (fallback for custom ones) ─── */
const STATUS_COLOR: Record<string, string> = {
    '草稿': '#8b8b9e',
    '已确认': '#3b82f6',
    '处理中': '#f59e0b',
    '已发货': '#8b5cf6',
    '已完成': '#22c55e',
    '已取消': '#ef4444',
};

const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
    '草稿':   { zh: '草稿',   en: 'Draft' },
    '已确认': { zh: '已确认', en: 'Confirmed' },
    '处理中': { zh: '处理中', en: 'Processing' },
    '已发货': { zh: '已发货', en: 'Shipped' },
    '已完成': { zh: '已完成', en: 'Completed' },
    '已取消': { zh: '已取消', en: 'Cancelled' },
};

const FALLBACK_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981'];

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
const btnDanger: React.CSSProperties = {
    ...btnPrimary, background: '#ef4444',
};
const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13,
};

/* ─── Helpers ─── */
function getStatusColor(status: string, idx: number) {
    return STATUS_COLOR[status] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function getStatusLabel(status: string, isChinese: boolean) {
    const known = STATUS_LABELS[status];
    if (known) return isChinese ? known.zh : known.en;
    return status;
}

/* ─── Status Badge ─── */
function StatusBadge({ status, isChinese, colorIdx = 0 }: { status: string; isChinese: boolean; colorIdx?: number }) {
    const color = getStatusColor(status, colorIdx);
    const label = getStatusLabel(status, isChinese);
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 100,
            background: `${color}18`, border: `1px solid ${color}40`,
            color, fontSize: 11, fontWeight: 500,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
        </span>
    );
}

/* ─── Searchable Select Component ─── */
function SearchableSelect({
    value, onChange, placeholder, apiPath, isChinese, labelKey, status,
}: {
    value: string;
    onChange: (id: string, item: any) => void;
    placeholder: string;
    apiPath: string;
    isChinese: boolean;
    labelKey: 'name' | 'name_sku';
    status?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['searchable-select', apiPath, search, page, status],
        queryFn: () => fetchJson<any>(`${apiPath}?search=${encodeURIComponent(search)}&page=${page}&page_size=10${status ? `&status=${status}` : ''}`),
        enabled: open,
    });

    const items = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / (Array.isArray(data) ? Math.max(data.length, 1) : (data?.page_size ?? 10))));
    const selectedItem = items.find((i: any) => i.id === value);
    const displayLabel = selectedItem
        ? (labelKey === 'name_sku' && selectedItem.sku ? `${selectedItem.name} (${selectedItem.sku})` : selectedItem.name)
        : '';

    return (
        <div style={{ position: 'relative', flex: 1 }}>
            <div
                onClick={() => setOpen(!open)}
                style={{
                    ...inputStyle, width: '100%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    minHeight: 34,
                }}
            >
                <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayLabel || placeholder}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 4, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </div>
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1001, overflow: 'hidden',
                }}>
                    <div style={{ padding: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ position: 'relative' }}>
                            <IconSearch size={14} stroke={1.5} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                autoFocus
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder={isChinese ? '输入关键词搜索...' : 'Search...'}
                                style={{ width: '100%', padding: '6px 8px 6px 28px', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 13, outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {isLoading ? (
                            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>{isChinese ? '加载中...' : 'Loading...'}</div>
                        ) : items.length === 0 ? (
                            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>{isChinese ? '无匹配结果' : 'No results'}</div>
                        ) : items.map((item: any) => (
                            <div
                                key={item.id}
                                onClick={() => { onChange(item.id, item); setOpen(false); setSearch(''); }}
                                style={{
                                    padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                                    color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)',
                                    background: item.id === value ? 'var(--accent-primary)18' : 'transparent',
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (item.id !== value) (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.id === value ? 'var(--accent-primary)18' : 'transparent'; }}
                            >
                                <div style={{ fontWeight: item.id === value ? 600 : 400 }}>{item.name}</div>
                                {item.sku && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>SKU: {item.sku}</div>}
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...btnSecondary, padding: '3px 8px', fontSize: 11 }}>{isChinese ? '上一页' : 'Prev'}</button>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: '24px' }}>{page}/{totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...btnSecondary, padding: '3px 8px', fontSize: 11 }}>{isChinese ? '下一页' : 'Next'}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── New/Edit Order Dialog ─── */
function NewOrderDialog({
    onClose, isChinese, order,
}: {
    onClose: (saved: boolean) => void;
    isChinese: boolean;
    order?: SalesOrder;
}) {
    const isEdit = !!order;
    const queryClient = useQueryClient();
    const [customerId, setCustomerId] = useState(order?.customer_id ?? '');
    const [orderDate, setOrderDate] = useState(order?.order_date ?? new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState(order?.notes ?? '');
    const [lines, setLines] = useState<OrderLine[]>(
        order?.lines?.length
            ? order.items.map(l => ({ ...l, subtotal: l.quantity * l.unit_price }))
            : [{ product_id: '', quantity: 1, unit_price: 0, subtotal: 0 }]
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const addLine = () => setLines(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

    const updateLine = (idx: number, field: keyof OrderLine, value: any) => {
        setLines(prev => prev.map((line, i) => {
            if (i !== idx) return line;
            const updated = { ...line, [field]: value };
            updated.subtotal = updated.quantity * updated.unit_price;
            return updated;
        }));
    };

    const selectProduct = (idx: number, id: string, item: any) => {
        setLines(prev => prev.map((line, i) => {
            if (i !== idx) return line;
            return {
                ...line,
                product_id: id,
                product_name: item.name,
                unit_price: item.unit_price ?? 0,
                unit: item.unit ?? '',
                subtotal: (item.unit_price ?? 0) * line.quantity,
            };
        }));
    };

    const total = useMemo(() => lines.reduce((s, l) => s + l.subtotal, 0), [lines]);

    const handleSubmit = async () => {
        if (!customerId) { setError(isChinese ? '请选择客户' : 'Please select a customer'); return; }
        if (lines.some(l => !l.product_id || l.quantity <= 0)) { setError(isChinese ? '请完善明细行' : 'Please complete all line items'); return; }
        setSaving(true); setError('');
        try {
            if (isEdit) {
                await fetchJson(`/erp/sales-orders/${order!.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        customer_id: customerId,
                        notes,
                        items: lines.map(l => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price })),
                    }),
                });
            } else {
                await fetchJson('/erp/sales-orders', {
                    method: 'POST',
                    body: JSON.stringify({
                        customer_id: customerId,
                        order_date: orderDate,
                        notes,
                        items: lines.map(l => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price })),
                    }),
                });
            }
            queryClient.invalidateQueries({ queryKey: ['erp-sales-orders'] });
            onClose(true);
        } catch (e: any) {
            setError(e.message ?? 'Error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onClose(false)}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 760, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isEdit
                        ? (isChinese ? '编辑销售订单' : 'Edit Sales Order')
                        : (isChinese ? '新建销售订单' : 'New Sales Order')
                    }
                </h3>

                {/* Customer + Date */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '选择客户 *' : 'Select Customer *'}
                        </label>
                        <SearchableSelect
                            value={customerId}
                            onChange={(id) => setCustomerId(id)}
                            placeholder={isChinese ? '-- 请选择客户 --' : '-- Select Customer --'}
                            apiPath="/erp/customers"
                            isChinese={isChinese}
                            labelKey="name"
                            status="active"
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '订单日期 *' : 'Order Date *'}
                        </label>
                        <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>
                </div>

                {/* Line items */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {isChinese ? '订单明细' : 'Line Items'}
                        </label>
                        <button onClick={addLine} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}>
                            <IconPlus size={14} stroke={2} /> {isChinese ? '添加行' : 'Add Line'}
                        </button>
                    </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ ...thStyle, width: '35%' }}>{isChinese ? '产品名称' : 'Product'}</th>
                                    <th style={{ ...thStyle, width: '15%' }}>{isChinese ? '单价' : 'Price'}</th>
                                    <th style={{ ...thStyle, width: '20%' }}>{isChinese ? '数量' : 'Qty'}</th>
                                    <th style={{ ...thStyle, width: '15%', textAlign: 'right' }}>{isChinese ? '金额' : 'Amount'}</th>
                                    <th style={{ ...thStyle, width: '15%' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, idx) => (
                                    <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                        <td style={{ ...tdStyle, padding: '6px 8px' }}>
                                            <SearchableSelect
                                                value={line.product_id}
                                                onChange={(id, item) => selectProduct(idx, id, item)}
                                                placeholder={isChinese ? '搜索产品...' : 'Search...'}
                                                apiPath="/erp/products"
                                                isChinese={isChinese}
                                                labelKey="name_sku"
                                            />
                                        </td>
                                        <td style={{ ...tdStyle, padding: '6px 8px' }}>
                                            <input type="number" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: '100%' }} />
                                        </td>
                                        <td style={{ ...tdStyle, padding: '6px 8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <input type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: 60 }} />
                                                {line.unit && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>({line.unit})</span>}
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>
                                            {line.subtotal.toFixed(2)}
                                        </td>
                                        <td style={{ ...tdStyle, padding: '6px 8px', textAlign: 'center' }}>
                                            {lines.length > 1 && (
                                                <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'inline-flex' }}>
                                                    <IconTrash size={14} stroke={1.5} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    <div style={{ textAlign: 'right', marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isChinese ? '合计: ' : 'Total: '}{total.toFixed(2)}
                    </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {isChinese ? '备注' : 'Notes'}
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
                </div>

                {error && <div style={{ marginBottom: 12, fontSize: 12, color: '#ef4444' }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={btnSecondary} onClick={() => onClose(false)}>{isChinese ? '取消' : 'Cancel'}</button>
                    <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer' }} onClick={handleSubmit} disabled={saving}>
                        {saving
                            ? (isChinese ? '保存中...' : 'Saving...')
                            : (isEdit ? (isChinese ? '保存' : 'Save') : (isChinese ? '创建订单' : 'Create Order'))
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Order Detail Dialog ─── */
function OrderDetailDialog({
    order, onClose, isChinese,
}: {
    order: SalesOrder;
    onClose: () => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const dialog = useDialog();
    const [activeTab, setActiveTab] = useState<'detail' | 'attachments'>('detail');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const statusTransitionMutation = useMutation({
        mutationFn: (newStatus: string) => fetchJson(`/erp/sales-orders/${order.id}/status`, {
            method: 'POST', body: JSON.stringify({ new_status: newStatus }),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['erp-sales-orders'] });
            onClose();
        },
    });

    const { data: customStatuses = [] } = useQuery({
        queryKey: ['erp-order-statuses', 'sales'],
        queryFn: () => fetchJson<any[]>('/erp/production-statuses?type=sales'),
    });
    const available = [
        ...customStatuses.filter((s: any) => s.is_active && s.name !== order.status).map((s: any) => s.name),
        ...(order.status !== '已取消' ? ['已取消'] : []),
    ];

    const handleStatusChange = async (newStatus: string) => {
        if (newStatus === '已取消') {
            const ok = await dialog.confirm(
                isChinese ? '确定要取消此订单吗？' : 'Are you sure you want to cancel this order?',
                { title: isChinese ? '取消订单' : 'Cancel Order', danger: true, confirmLabel: isChinese ? '取消订单' : 'Cancel Order' },
            );
            if (!ok) return;
        }
        statusTransitionMutation.mutate(newStatus);
    };

    /* ── Attachment logic ── */
    const { data: attachments = [] } = useQuery<any[]>({
        queryKey: ['erp-attachments', 'sales_order', order.id],
        queryFn: () => fetchJson<any[]>(`/erp/attachments?parent_type=sales_order&parent_id=${order.id}`),
    });

    const uploadAttachment = async (file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        const token = localStorage.getItem('token');
        await fetch(`/api/erp/attachments?parent_type=sales_order&parent_id=${order.id}`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        queryClient.invalidateQueries({ queryKey: ['erp-attachments', 'sales_order', order.id] });
    };

    const deleteAttachment = async (id: string) => {
        await fetchJson(`/erp/attachments/${id}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['erp-attachments', 'sales_order', order.id] });
    };

    const downloadAttachment = (id: string) => {
        const token = localStorage.getItem('token');
        window.open(`/api/erp/attachments/${id}/download?token=${token}`, '_blank');
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 720, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isChinese ? '订单详情' : 'Order Detail'}: {order.order_no}
                </h3>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-subtle)', marginBottom: 16 }}>
                    {(['detail', 'attachments'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '8px 20px', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                marginBottom: -2, transition: 'all 0.15s',
                            }}
                        >
                            {tab === 'detail'
                                ? (isChinese ? '订单信息' : 'Detail')
                                : (isChinese ? `附件 (${attachments.length})` : `Attachments (${attachments.length})`)
                            }
                        </button>
                    ))}
                </div>

                {activeTab === 'detail' ? (
                <>
                <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '客户' : 'Customer'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{order.customer_name}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '状态' : 'Status'}</div>
                        <StatusBadge status={order.status} isChinese={isChinese} />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '金额' : 'Amount'}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{order.total_amount.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '订单日期' : 'Order Date'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{order.order_date}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '创建时间' : 'Created'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{new Date(order.created_at).toLocaleString()}</div>
                    </div>
                </div>

                {/* Line items table */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{isChinese ? '产品' : 'Product'}</th>
                                <th style={thStyle}>{isChinese ? '数量' : 'Qty'}</th>
                                <th style={thStyle}>{isChinese ? '单价' : 'Unit Price'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{isChinese ? '小计' : 'Subtotal'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.items ?? []).map((line, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}>{line.product_name ?? line.product_id}</td>
                                    <td style={tdStyle}>{line.quantity}{line.unit ? ` ${line.unit}` : ''}</td>
                                    <td style={tdStyle}>{line.unit_price.toFixed(2)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{line.subtotal.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {order.notes && (
                    <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isChinese ? '备注: ' : 'Notes: '}{order.notes}
                    </div>
                )}

                {/* Status transition buttons */}
                {available.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {available.map(s => (
                            <button
                                key={s}
                                onClick={() => handleStatusChange(s)}
                                disabled={statusTransitionMutation.isPending}
                                style={{
                                    ...(s === '已取消' ? btnDanger : btnPrimary),
                                    background: s === '已取消' ? '#ef4444' : getStatusColor(s, 0),
                                    opacity: statusTransitionMutation.isPending ? 0.7 : 1,
                                }}
                            >
                                {getStatusLabel(s, isChinese)}
                            </button>
                        ))}
                    </div>
                )}
                </>
                ) : (
                <>
                {/* ── Attachments tab ── */}
                <div style={{ marginBottom: 16 }}>
                    <input
                        ref={fileInputRef}
                        type="file" multiple hidden
                        onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadAttachment(f)); e.target.value = ''; }}
                    />
                    <button
                        style={{ ...btnSecondary, marginBottom: 12 }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isChinese ? '上传附件' : 'Upload Attachment'}
                    </button>

                    {attachments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
                            {isChinese ? '暂无附件' : 'No attachments'}
                        </div>
                    ) : (
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th style={thStyle}>{isChinese ? '文件名' : 'File Name'}</th>
                                        <th style={thStyle}>{isChinese ? '大小' : 'Size'}</th>
                                        <th style={thStyle}>{isChinese ? '上传人' : 'Uploaded By'}</th>
                                        <th style={thStyle}>{isChinese ? '上传时间' : 'Uploaded'}</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>{isChinese ? '操作' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attachments.map((a: any) => (
                                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={tdStyle}>{a.file_name}</td>
                                            <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{formatFileSize(a.file_size)}</td>
                                            <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{a.uploaded_by_name ?? '-'}</td>
                                            <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{new Date(a.created_at).toLocaleString()}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                    <button onClick={() => downloadAttachment(a.id)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '下载' : 'Download'}>
                                                        <IconEye size={14} stroke={1.5} />
                                                    </button>
                                                    <button onClick={() => deleteAttachment(a.id)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '删除' : 'Delete'}>
                                                        <IconTrash size={14} stroke={1.5} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button style={btnSecondary} onClick={onClose}>{isChinese ? '关闭' : 'Close'}</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main component ─── */
export default function SalesOrders() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();
    const dialog = useDialog();

    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showNewOrder, setShowNewOrder] = useState(false);
    const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
    const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null);

    /* Fetch custom statuses for filter tabs */
    const { data: customStatuses = [] } = useQuery({
        queryKey: ['erp-order-statuses', 'sales'],
        queryFn: () => fetchJson<any[]>('/erp/production-statuses?type=sales'),
    });
    const statusTabs = useMemo(() => {
        const custom = customStatuses.filter((s: any) => s.is_active).map((s: any) => s.name);
        return ['all', ...custom, '已取消'];
    }, [customStatuses]);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-sales-orders', statusFilter, search, page],
        queryFn: () => fetchJson<OrdersResponse>(
            `/erp/sales-orders?status=${statusFilter === 'all' ? '' : statusFilter}&search=${encodeURIComponent(search)}&page=${page}&page_size=20`,
        ),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/sales-orders/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['erp-sales-orders'] }),
    });

    const handleDelete = async (id: string, orderNo: string) => {
        const ok = await dialog.confirm(
            isChinese ? `确定删除订单 ${orderNo}？` : `Delete order ${orderNo}?`,
            { title: isChinese ? '删除订单' : 'Delete Order', danger: true, confirmLabel: isChinese ? '删除' : 'Delete' },
        );
        if (ok) deleteMutation.mutate(id);
    };

    const orders = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Status filter tabs ── */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {statusTabs.map(s => {
                    const label = s === 'all'
                        ? (isChinese ? '全部' : 'All')
                        : (s === '已取消' ? (isChinese ? '已取消' : 'Cancelled') : getStatusLabel(s, isChinese));
                    return (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            style={{
                                padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                                border: statusFilter === s ? 'none' : '1px solid var(--border-subtle)',
                                background: statusFilter === s ? (s === '已取消' ? '#ef4444' : getStatusColor(s, 0)) : 'var(--bg-secondary)',
                                color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                    <IconSearch size={16} stroke={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder={t('erp.orders.searchPlaceholder', '搜索订单号、客户名...')}
                        style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                    />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    {isChinese ? `共 ${total} 条` : `${total} records`}
                </div>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => setShowNewOrder(true)}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.salesOrders.new', '新建订单')}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.order.orderNo', '订单号')}</th>
                                <th style={thStyle}>{t('erp.order.customer', '客户')}</th>
                                <th style={thStyle}>{t('erp.order.amount', '金额')}</th>
                                <th style={thStyle}>{isChinese ? '订单日期' : 'Order Date'}</th>
                                <th style={thStyle}>{t('erp.order.status', '状态')}</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>{t('erp.actions', '操作')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                            ) : orders.map(o => (
                                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{o.order_no}</td>
                                    <td style={tdStyle}>{o.customer_name}</td>
                                    <td style={{ ...tdStyle, fontWeight: 500 }}>{o.total_amount.toFixed(2)}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{o.order_date}</td>
                                    <td style={tdStyle}><StatusBadge status={o.status} isChinese={isChinese} /></td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button onClick={() => setViewingOrder(o)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '查看详情' : 'View Detail'}>
                                                <IconEye size={14} stroke={1.5} />
                                            </button>
                                            {o.status === '草稿' && (
                                                <>
                                                <button onClick={() => setEditingOrder(o)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '编辑' : 'Edit'}>
                                                    <IconEdit size={14} stroke={1.5} />
                                                </button>
                                                <button onClick={() => handleDelete(o.id, o.order_no)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '删除' : 'Delete'}>
                                                    <IconTrash size={14} stroke={1.5} />
                                                </button>
                                                </>
                                            )}
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
                    <button style={btnSecondary} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{isChinese ? '上一页' : 'Prev'}</button>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
                    <button style={btnSecondary} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{isChinese ? '下一页' : 'Next'}</button>
                </div>
            )}

            {/* ── Dialogs ── */}
            {showNewOrder && (
                <NewOrderDialog isChinese={isChinese} onClose={() => setShowNewOrder(false)} />
            )}
            {editingOrder && (
                <NewOrderDialog isChinese={isChinese} order={editingOrder} onClose={(saved) => { setEditingOrder(null); if (saved) queryClient.invalidateQueries({ queryKey: ['erp-sales-orders'] }); }} />
            )}
            {viewingOrder && (
                <OrderDetailDialog order={viewingOrder} isChinese={isChinese} onClose={() => setViewingOrder(null)} />
            )}
        </div>
    );
}
