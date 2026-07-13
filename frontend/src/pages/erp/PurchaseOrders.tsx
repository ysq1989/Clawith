/**
 * PurchaseOrders — Purchase order management. Structure mirrors SalesOrders, with suppliers
 * replacing customers.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEye, IconTrash } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';

/* ─── Types ─── */
interface OrderLine {
    id?: string;
    material_id: string;
    material_name?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

interface PurchaseOrder {
    id: string;
    order_no: string;
    supplier_id: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    notes: string;
    lines: OrderLine[];
    created_at: string;
    updated_at: string;
}

interface OrdersResponse {
    items: PurchaseOrder[];
    total: number;
    page: number;
    page_size: number;
}

interface SupplierOption {
    id: string;
    name: string;
}

interface MaterialOption {
    id: string;
    name: string;
    sku: string;
    cost_price: number;
}

/* ─── Constants ─── */
const STATUS_TABS = ['all', 'draft', 'confirmed', 'processing', 'received', 'completed', 'cancelled'] as const;

const STATUS_COLOR: Record<string, string> = {
    draft: '#8b8b9e',
    confirmed: '#3b82f6',
    processing: '#f59e0b',
    received: '#8b5cf6',
    completed: '#22c55e',
    cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
    draft:      { zh: '草稿',   en: 'Draft' },
    confirmed:  { zh: '已确认', en: 'Confirmed' },
    processing: { zh: '处理中', en: 'Processing' },
    received:   { zh: '已收货', en: 'Received' },
    completed:  { zh: '已完成', en: 'Completed' },
    cancelled:  { zh: '已取消', en: 'Cancelled' },
};

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

/* ─── Status Badge ─── */
function StatusBadge({ status, isChinese }: { status: string; isChinese: boolean }) {
    const color = STATUS_COLOR[status] ?? 'var(--text-tertiary)';
    const label = isChinese ? (STATUS_LABELS[status]?.zh ?? status) : (STATUS_LABELS[status]?.en ?? status);
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
    const totalPages = Math.max(1, Math.ceil(total / (Array.isArray(data) ? data.length : (data?.page_size ?? 10))));
    const selectedItem = items.find((i: any) => i.id === value);
    const displayLabel = selectedItem ? (labelKey === 'name_sku' ? `${selectedItem.name} (${selectedItem.sku})` : selectedItem.name) : '';
    return (
        <div style={{ position: 'relative', flex: 1 }}>
            <div onClick={() => setOpen(!open)} style={{ ...inputStyle, width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 }}>
                <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel || placeholder}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 4, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1001, overflow: 'hidden' }}>
                    <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ position: 'relative' }}>
                            <IconSearch size={14} stroke={1.5} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input autoFocus value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={isChinese ? '输入关键词搜索...' : 'Search...'} style={{ width: '100%', padding: '6px 8px 6px 28px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', color: '#1e293b', background: '#f8fafc' }} />
                        </div>
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {isLoading ? <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{isChinese ? '加载中...' : 'Loading...'}</div>
                        : items.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{isChinese ? '无匹配结果' : 'No results'}</div>
                        : items.map((item: any) => (
                            <div key={item.id} onClick={() => { onChange(item.id, item); setOpen(false); setSearch(''); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9', background: item.id === value ? '#eff6ff' : 'transparent', transition: 'background 0.1s' }} onMouseEnter={e => { if (item.id !== value) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.id === value ? '#eff6ff' : 'transparent'; }}>
                                <div style={{ fontWeight: item.id === value ? 600 : 400 }}>{item.name}</div>
                                {item.sku && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>SKU: {item.sku}</div>}
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #e2e8f0' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...btnSecondary, padding: '3px 8px', fontSize: 11 }}>{isChinese ? '上一页' : 'Prev'}</button>
                            <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: '24px' }}>{page}/{totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...btnSecondary, padding: '3px 8px', fontSize: 11 }}>{isChinese ? '下一页' : 'Next'}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── New Purchase Order Dialog ─── */
function NewOrderDialog({
    onClose, isChinese,
}: {
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const [supplierId, setSupplierId] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<OrderLine[]>([
        { material_id: '', quantity: 1, unit_price: 0, subtotal: 0 },
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const addLine = () => setLines(prev => [...prev, { material_id: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

    const updateLine = (idx: number, field: keyof OrderLine, value: any) => {
        setLines(prev => prev.map((line, i) => {
            if (i !== idx) return line;
            const updated = { ...line, [field]: value };
            updated.subtotal = updated.quantity * updated.unit_price;
            return updated;
        }));
    };

    const selectMaterial = (idx: number, id: string, item: any) => {
        setLines(prev => prev.map((line, i) => {
            if (i !== idx) return line;
            return {
                ...line,
                material_id: id,
                material_name: item.name,
                unit_price: item.cost_price ?? 0,
                unit: item.unit ?? '',
                subtotal: (item.cost_price ?? 0) * line.quantity,
            };
        }));
    };

    const total = useMemo(() => lines.reduce((s, l) => s + l.subtotal, 0), [lines]);

    const handleSubmit = async () => {
        if (!supplierId) { setError(isChinese ? '请选择供应商' : 'Please select a supplier'); return; }
        if (lines.some(l => !l.material_id || l.quantity <= 0)) { setError(isChinese ? '请完善明细行' : 'Please complete all line items'); return; }
        setSaving(true); setError('');
        try {
            await fetchJson('/erp/purchase-orders', {
                method: 'POST',
                body: JSON.stringify({
                    supplier_id: supplierId,
                    notes,
                    lines: lines.map(l => ({ material_id: l.material_id, quantity: l.quantity, unit_price: l.unit_price })),
                }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-purchase-orders'] });
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
                    {isChinese ? '新建采购订单' : 'New Purchase Order'}
                </h3>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {isChinese ? '选择供应商 *' : 'Select Supplier *'}
                    </label>
                    <SearchableSelect
                        value={supplierId}
                        onChange={(id) => setSupplierId(id)}
                        placeholder={isChinese ? '-- 请选择供应商 --' : '-- Select Supplier --'}
                        apiPath="/erp/suppliers"
                        isChinese={isChinese}
                        labelKey="name"
                        status="active"
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {isChinese ? '采购明细' : 'Line Items'}
                        </label>
                        <button onClick={addLine} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}>
                            <IconPlus size={14} stroke={2} /> {isChinese ? '添加行' : 'Add Line'}
                        </button>
                    </div>
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{ ...thStyle, width: '35%' }}>{isChinese ? '物料名称' : 'Material'}</th>
                                    <th style={{ ...thStyle, width: '15%' }}>{isChinese ? '成本价' : 'Cost'}</th>
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
                                                value={line.material_id}
                                                onChange={(id, item) => selectMaterial(idx, id, item)}
                                                placeholder={isChinese ? '搜索物料...' : 'Search...'}
                                                apiPath="/erp/materials"
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
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isChinese ? '合计: ' : 'Total: '}{total.toFixed(2)}
                    </div>
                </div>

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
                        {saving ? (isChinese ? '创建中...' : 'Creating...') : (isChinese ? '创建订单' : 'Create Order')}
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
    order: PurchaseOrder;
    onClose: () => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const statusMutation = useMutation({
        mutationFn: (newStatus: string) => fetchJson(`/erp/purchase-orders/${order.id}/status`, {
            method: 'POST', body: JSON.stringify({ new_status: newStatus }),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['erp-purchase-orders'] });
            onClose();
        },
    });

    const nextStatuses: Record<string, string[]> = {
        draft: ['confirmed', 'cancelled'],
        confirmed: ['processing', 'cancelled'],
        processing: ['received', 'cancelled'],
        received: ['completed'],
    };
    const available = nextStatuses[order.status] ?? [];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 560, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isChinese ? '采购订单详情' : 'Purchase Order Detail'}: {order.order_no}
                </h3>

                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '供应商' : 'Supplier'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{order.supplier_name}</div>
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
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '创建时间' : 'Created'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{new Date(order.created_at).toLocaleString()}</div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{isChinese ? '物料' : 'Material'}</th>
                                <th style={thStyle}>{isChinese ? '数量' : 'Qty'}</th>
                                <th style={thStyle}>{isChinese ? '单价' : 'Unit Price'}</th>
                                <th style={thStyle}>{isChinese ? '小计' : 'Subtotal'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.lines.map((line, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}>{line.material_name ?? line.material_id}</td>
                                    <td style={tdStyle}>{line.quantity}</td>
                                    <td style={tdStyle}>{line.unit_price.toFixed(2)}</td>
                                    <td style={tdStyle}>{line.subtotal.toFixed(2)}</td>
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

                {available.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {available.map(s => (
                            <button
                                key={s}
                                onClick={() => statusMutation.mutate(s)}
                                disabled={statusMutation.isPending}
                                style={{
                                    ...btnPrimary,
                                    background: s === 'cancelled' ? '#ef4444' : STATUS_COLOR[s] ?? 'var(--accent-primary)',
                                    opacity: statusMutation.isPending ? 0.7 : 1,
                                }}
                            >
                                {isChinese ? (STATUS_LABELS[s]?.zh ?? s) : (STATUS_LABELS[s]?.en ?? s)}
                            </button>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button style={btnSecondary} onClick={onClose}>{isChinese ? '关闭' : 'Close'}</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main component ─── */
export default function PurchaseOrders() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();

    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showNewOrder, setShowNewOrder] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-purchase-orders', statusFilter, search, page],
        queryFn: () => fetchJson<OrdersResponse>(
            `/erp/purchase-orders?status=${statusFilter === 'all' ? '' : statusFilter}&search=${encodeURIComponent(search)}&page=${page}&page_size=20`,
        ),
    });

    const orders = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Status filter tabs ── */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {STATUS_TABS.map(s => {
                    const label = s === 'all'
                        ? (isChinese ? '全部' : 'All')
                        : (isChinese ? (STATUS_LABELS[s]?.zh ?? s) : (STATUS_LABELS[s]?.en ?? s));
                    return (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            style={{
                                padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                                border: statusFilter === s ? 'none' : '1px solid var(--border-subtle)',
                                background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-secondary)',
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
                        placeholder={t('erp.orders.searchPlaceholder', '搜索订单号、供应商名...')}
                        style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                    />
                </div>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => setShowNewOrder(true)}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.purchaseOrders.new', '新建采购订单')}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.order.orderNo', '订单号')}</th>
                                <th style={thStyle}>{t('erp.purchaseOrder.supplier', '供应商')}</th>
                                <th style={thStyle}>{t('erp.order.amount', '金额')}</th>
                                <th style={thStyle}>{t('erp.order.status', '状态')}</th>
                                <th style={thStyle}>{t('erp.order.date', '日期')}</th>
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
                                    <td style={tdStyle}>{o.order_no}</td>
                                    <td style={tdStyle}>{o.supplier_name}</td>
                                    <td style={tdStyle}>{o.total_amount.toFixed(2)}</td>
                                    <td style={tdStyle}><StatusBadge status={o.status} isChinese={isChinese} /></td>
                                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button onClick={() => setViewingOrder(o)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }} title={isChinese ? '查看详情' : 'View Detail'}>
                                            <IconEye size={14} stroke={1.5} />
                                        </button>
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

            {showNewOrder && (
                <NewOrderDialog
                    isChinese={isChinese}
                    onClose={() => setShowNewOrder(false)}
                />
            )}
            {viewingOrder && (
                <OrderDetailDialog
                    order={viewingOrder}
                    isChinese={isChinese}
                    onClose={() => setViewingOrder(null)}
                />
            )}
        </div>
    );
}
