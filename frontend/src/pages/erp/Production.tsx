/**
 * Production — Production order management with dynamic status filter tabs (from API),
 * order list, create dialog with automatic BOM display, and detail dialog with status transitions.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEye } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface BomItem {
    id: string;
    material_id: string;
    material_name: string;
    quantity: number;
    unit: string;
}

interface ProductionOrder {
    id: string;
    order_no: string;
    product_id: string;
    product_name: string;
    quantity: number;
    status: string;
    notes: string;
    materials: BomItem[];
    created_at: string;
    updated_at: string;
}

interface OrdersResponse {
    items: ProductionOrder[];
    total: number;
    page: number;
    page_size: number;
}

interface StatusOption {
    key: string;
    label_zh: string;
    label_en: string;
    color: string;
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

/* ─── Status Badge ─── */
function StatusBadge({ status, isChinese, statusMap }: { status: string; isChinese: boolean; statusMap: Record<string, StatusOption> }) {
    const opt = statusMap[status];
    const color = opt?.color ?? 'var(--text-tertiary)';
    const label = opt ? (isChinese ? opt.label_zh : opt.label_en) : status;
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
    value, onChange, placeholder, apiPath, isChinese,
}: {
    value: string;
    onChange: (id: string, item: any) => void;
    placeholder: string;
    apiPath: string;
    isChinese: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['production-searchable-select', apiPath, search, page],
        queryFn: () => fetchJson<any>(`${apiPath}?search=${encodeURIComponent(search)}&page=${page}&page_size=10`),
        enabled: open,
    });

    const items = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / (Array.isArray(data) ? data.length : (data?.page_size ?? 10))));
    const selectedItem = items.find((i: any) => i.id === value);
    const displayLabel = selectedItem
        ? `${selectedItem.name}${selectedItem.sku ? ` (${selectedItem.sku})` : ''}`
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
                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1001, overflow: 'hidden',
                }}>
                    <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ position: 'relative' }}>
                            <IconSearch size={14} stroke={1.5} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                autoFocus
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder={isChinese ? '输入关键词搜索...' : 'Search...'}
                                style={{ width: '100%', padding: '6px 8px 6px 28px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {isLoading ? (
                            <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{isChinese ? '加载中...' : 'Loading...'}</div>
                        ) : items.length === 0 ? (
                            <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{isChinese ? '无匹配结果' : 'No results'}</div>
                        ) : items.map((item: any) => (
                            <div
                                key={item.id}
                                onClick={() => { onChange(item.id, item); setOpen(false); setSearch(''); }}
                                style={{
                                    padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                                    color: '#1e293b', borderBottom: '1px solid #f1f5f9',
                                    background: item.id === value ? '#eff6ff' : 'transparent',
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (item.id !== value) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.id === value ? '#eff6ff' : 'transparent'; }}
                            >
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

/* ─── New Production Order Dialog ─── */
function NewOrderDialog({
    onClose, isChinese,
}: {
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    /* Fetch BOM when product is selected */
    const { data: bomData } = useQuery({
        queryKey: ['erp-boms-new-order', productId],
        queryFn: () => fetchJson<any>(`/erp/boms?product_id=${productId}`),
        enabled: !!productId,
    });

    const bomItems: BomItem[] = productId
        ? (Array.isArray(bomData) ? bomData : (bomData?.items ?? []))
        : [];

    const handleSubmit = async () => {
        if (!productId) { setError(isChinese ? '请选择产品' : 'Please select a product'); return; }
        if (!quantity || parseInt(quantity) <= 0) { setError(isChinese ? '请输入有效数量' : 'Please enter a valid quantity'); return; }
        setSaving(true); setError('');
        try {
            await fetchJson('/erp/production-orders', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: productId,
                    quantity: parseInt(quantity),
                    notes,
                }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-production-orders'] });
            onClose(true);
        } catch (e: any) {
            setError(e.message ?? 'Error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onClose(false)}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 640, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isChinese ? '新建生产工单' : 'New Production Order'}
                </h3>

                {/* Product selector */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {isChinese ? '选择产品 *' : 'Select Product *'}
                    </label>
                    <SearchableSelect
                        value={productId}
                        onChange={(id) => setProductId(id)}
                        placeholder={isChinese ? '-- 请选择产品 --' : '-- Select Product --'}
                        apiPath="/erp/products"
                        isChinese={isChinese}
                    />
                </div>

                {/* Quantity */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {isChinese ? '生产数量 *' : 'Quantity *'}
                    </label>
                    <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                </div>

                {/* BOM materials preview */}
                {productId && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            {isChinese ? '物料需求（BOM）' : 'Material Requirements (BOM)'}
                        </label>
                        {bomItems.length === 0 ? (
                            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                                {isChinese ? '该产品暂无 BOM 数据' : 'No BOM data for this product'}
                            </div>
                        ) : (
                            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)' }}>
                                            <th style={thStyle}>{isChinese ? '物料名称' : 'Material'}</th>
                                            <th style={thStyle}>{isChinese ? '单位用量' : 'Unit Qty'}</th>
                                            <th style={thStyle}>{isChinese ? '总需求量' : 'Total Qty'}</th>
                                            <th style={thStyle}>{isChinese ? '单位' : 'Unit'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bomItems.map((item, idx) => {
                                            const qty = parseInt(quantity) || 0;
                                            return (
                                                <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ ...tdStyle, padding: '6px 12px' }}>{item.material_name}</td>
                                                    <td style={{ ...tdStyle, padding: '6px 12px' }}>{item.quantity}</td>
                                                    <td style={{ ...tdStyle, padding: '6px 12px', fontWeight: 600 }}>{(item.quantity * qty).toFixed(2)}</td>
                                                    <td style={{ ...tdStyle, padding: '6px 12px' }}>{item.unit}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

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
                        {saving ? (isChinese ? '创建中...' : 'Creating...') : (isChinese ? '创建工单' : 'Create Order')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Order Detail Dialog ─── */
function OrderDetailDialog({
    order, onClose, isChinese, statusMap,
}: {
    order: ProductionOrder;
    onClose: () => void;
    isChinese: boolean;
    statusMap: Record<string, StatusOption>;
}) {
    const queryClient = useQueryClient();
    const statusTransitionMutation = useMutation({
        mutationFn: (newStatus: string) => fetchJson(`/erp/production-orders/${order.id}/status`, {
            method: 'POST', body: JSON.stringify({ status: newStatus }),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['erp-production-orders'] });
            onClose();
        },
    });

    const statusKeys = Object.keys(statusMap);
    const currentIdx = statusKeys.indexOf(order.status);
    const nextStatuses = currentIdx >= 0 && currentIdx < statusKeys.length - 1
        ? [statusKeys[currentIdx + 1]]
        : [];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 560, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isChinese ? '工单详情' : 'Order Detail'}: {order.order_no}
                </h3>

                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '产品' : 'Product'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{order.product_name}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '数量' : 'Quantity'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{order.quantity}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '状态' : 'Status'}</div>
                        <StatusBadge status={order.status} isChinese={isChinese} statusMap={statusMap} />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{isChinese ? '创建时间' : 'Created'}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{new Date(order.created_at).toLocaleString()}</div>
                    </div>
                </div>

                {/* Materials table */}
                {order.materials && order.materials.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            {isChinese ? '物料消耗清单' : 'Material Consumption'}
                        </label>
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th style={thStyle}>{isChinese ? '物料' : 'Material'}</th>
                                        <th style={thStyle}>{isChinese ? '数量' : 'Qty'}</th>
                                        <th style={thStyle}>{isChinese ? '单位' : 'Unit'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.materials.map((m, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={tdStyle}>{m.material_name}</td>
                                            <td style={tdStyle}>{m.quantity}</td>
                                            <td style={tdStyle}>{m.unit}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {order.notes && (
                    <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isChinese ? '备注: ' : 'Notes: '}{order.notes}
                    </div>
                )}

                {/* Status transition buttons */}
                {nextStatuses.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {nextStatuses.map(s => {
                            const opt = statusMap[s];
                            const color = opt?.color ?? 'var(--accent-primary)';
                            const label = opt ? (isChinese ? opt.label_zh : opt.label_en) : s;
                            return (
                                <button
                                    key={s}
                                    onClick={() => statusTransitionMutation.mutate(s)}
                                    disabled={statusTransitionMutation.isPending}
                                    style={{
                                        ...btnPrimary,
                                        background: color,
                                        opacity: statusTransitionMutation.isPending ? 0.7 : 1,
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button style={btnSecondary} onClick={onClose}>{isChinese ? '关闭' : 'Close'}</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function Production() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();
    const dialog = useDialog();

    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showNewOrder, setShowNewOrder] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<ProductionOrder | null>(null);

    /* Fetch statuses from API */
    const { data: statusesData } = useQuery({
        queryKey: ['erp-production-statuses'],
        queryFn: () => fetchJson<StatusOption[] | { items: StatusOption[] }>('/erp/production-statuses'),
    });

    const statusList: StatusOption[] = Array.isArray(statusesData)
        ? statusesData
        : (statusesData as any)?.items ?? [
            { key: 'pending', label_zh: '待生产', label_en: 'Pending', color: '#8b8b9e' },
            { key: 'in_progress', label_zh: '生产中', label_en: 'In Progress', color: '#f59e0b' },
            { key: 'completed', label_zh: '已完成', label_en: 'Completed', color: '#22c55e' },
            { key: 'cancelled', label_zh: '已取消', label_en: 'Cancelled', color: '#ef4444' },
        ];

    const statusMap: Record<string, StatusOption> = {};
    statusList.forEach(s => { statusMap[s.key] = s; });

    /* Fetch orders */
    const { data, isLoading } = useQuery({
        queryKey: ['erp-production-orders', statusFilter, search, page],
        queryFn: () => fetchJson<OrdersResponse>(
            `/erp/production-orders?status=${statusFilter === 'all' ? '' : statusFilter}&search=${encodeURIComponent(search)}&page=${page}&page_size=20`,
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
                <button
                    onClick={() => { setStatusFilter('all'); setPage(1); }}
                    style={{
                        padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                        border: statusFilter === 'all' ? 'none' : '1px solid var(--border-subtle)',
                        background: statusFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: statusFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s',
                    }}
                >
                    {isChinese ? '全部' : 'All'}
                </button>
                {statusList.map(s => (
                    <button
                        key={s.key}
                        onClick={() => { setStatusFilter(s.key); setPage(1); }}
                        style={{
                            padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                            border: statusFilter === s.key ? 'none' : '1px solid var(--border-subtle)',
                            background: statusFilter === s.key ? s.color : 'var(--bg-secondary)',
                            color: statusFilter === s.key ? '#fff' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        {isChinese ? s.label_zh : s.label_en}
                    </button>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                    <IconSearch size={16} stroke={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder={t('erp.production.searchPlaceholder', '搜索工单号、产品名...')}
                        style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                    />
                </div>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => setShowNewOrder(true)}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.production.new', '新建工单')}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.production.orderNo', '工单号')}</th>
                                <th style={thStyle}>{t('erp.production.product', '产品')}</th>
                                <th style={thStyle}>{t('erp.production.quantity', '数量')}</th>
                                <th style={thStyle}>{t('erp.production.status', '状态')}</th>
                                <th style={thStyle}>{t('erp.production.date', '创建时间')}</th>
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
                                    <td style={tdStyle}>{o.product_name}</td>
                                    <td style={tdStyle}>{o.quantity}</td>
                                    <td style={tdStyle}><StatusBadge status={o.status} isChinese={isChinese} statusMap={statusMap} /></td>
                                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button
                                            onClick={() => setViewingOrder(o)}
                                            style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                            title={isChinese ? '查看详情' : 'View Detail'}
                                        >
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

            {/* ── Dialogs ── */}
            {showNewOrder && (
                <NewOrderDialog isChinese={isChinese} onClose={() => setShowNewOrder(false)} />
            )}
            {viewingOrder && (
                <OrderDetailDialog
                    order={viewingOrder}
                    isChinese={isChinese}
                    statusMap={statusMap}
                    onClose={() => setViewingOrder(null)}
                />
            )}
        </div>
    );
}
