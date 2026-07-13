/**
 * Inventory — Inventory management with stock overview, movement log, and stock operation dialogs.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconMinus, IconTransfer } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';

/* ─── Types ─── */
interface InventoryItem {
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    warehouse: string;
    current_stock: number;
    min_stock: number;
    cost_price: number;
    stock_value: number;
    item_type?: 'product' | 'material';
}

interface InventoryResponse {
    items: InventoryItem[];
    total: number;
    page: number;
    page_size: number;
}

interface StockMovement {
    id: string;
    product_id: string;
    product_name: string;
    warehouse: string;
    movement_type: string;
    quantity: number;
    reason: string;
    created_at: string;
    item_type?: 'product' | 'material';
}

interface MovementsResponse {
    items: StockMovement[];
    total: number;
    page: number;
    page_size: number;
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

/* ─── Movement type config ─── */
const MOVEMENT_TYPE_COLOR: Record<string, string> = {
    inbound: '#22c55e',
    outbound: '#ef4444',
    transfer: '#8b5cf6',
};

const MOVEMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
    inbound:  { zh: '入库', en: 'Inbound' },
    outbound: { zh: '出库', en: 'Outbound' },
    transfer: { zh: '调拨', en: 'Transfer' },
};

/* ─── Stock Operation Dialog ─── */
function StockOperationDialog({
    operationType, onClose, isChinese, productOptions,
}: {
    operationType: 'inbound' | 'outbound' | 'transfer';
    onClose: (saved: boolean) => void;
    isChinese: boolean;
    productOptions: { id: string; name: string; sku: string }[];
}) {
    const queryClient = useQueryClient();
    const [productId, setProductId] = useState('');
    const [warehouse, setWarehouse] = useState('');
    const [toWarehouse, setToWarehouse] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const titleMap = {
        inbound: isChinese ? '入库操作' : 'Stock Inbound',
        outbound: isChinese ? '出库操作' : 'Stock Outbound',
        transfer: isChinese ? '调拨操作' : 'Stock Transfer',
    };

    const handleSubmit = async () => {
        if (!productId) { setError(isChinese ? '请选择产品' : 'Please select a product'); return; }
        if (!quantity || parseInt(quantity) <= 0) { setError(isChinese ? '请输入有效数量' : 'Please enter a valid quantity'); return; }
        if (operationType === 'transfer' && !toWarehouse) { setError(isChinese ? '请输入目标仓库' : 'Please enter destination warehouse'); return; }
        setSaving(true); setError('');
        try {
            await fetchJson('/erp/inventory/movements', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: productId,
                    warehouse,
                    to_warehouse: operationType === 'transfer' ? toWarehouse : undefined,
                    movement_type: operationType,
                    quantity: parseInt(quantity),
                    reason,
                }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['erp-inventory-movements'] });
            onClose(true);
        } catch (e: any) {
            setError(e.message ?? 'Error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onClose(false)}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-subtle)', width: 460, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {titleMap[operationType]}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '产品 *' : 'Product *'}
                        </label>
                        <select value={productId} onChange={e => setProductId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                            <option value="">{isChinese ? '-- 选择产品 --' : '-- Select Product --'}</option>
                            {productOptions.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {operationType === 'transfer' ? (isChinese ? '源仓库' : 'Source Warehouse') : (isChinese ? '仓库' : 'Warehouse')}
                        </label>
                        <input type="text" value={warehouse} onChange={e => setWarehouse(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder={isChinese ? '仓库名称' : 'Warehouse name'} />
                    </div>
                    {operationType === 'transfer' && (
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {isChinese ? '目标仓库' : 'Destination Warehouse'}
                            </label>
                            <input type="text" value={toWarehouse} onChange={e => setToWarehouse(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder={isChinese ? '目标仓库名称' : 'Destination warehouse'} />
                        </div>
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '数量 *' : 'Quantity *'}
                        </label>
                        <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '原因/备注' : 'Reason / Notes'}
                        </label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
                    </div>
                </div>

                {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button style={btnSecondary} onClick={() => onClose(false)}>{isChinese ? '取消' : 'Cancel'}</button>
                    <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer' }} onClick={handleSubmit} disabled={saving}>
                        {saving ? (isChinese ? '提交中...' : 'Submitting...') : (isChinese ? '确认' : 'Confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main component ─── */
export default function Inventory() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'overview' | 'movements'>('overview');
    const [stockType, setStockType] = useState<'all' | 'product' | 'material'>('all');
    const [overviewPage, setOverviewPage] = useState(1);
    const [movementsPage, setMovementsPage] = useState(1);
    const [stockDialog, setStockDialog] = useState<'inbound' | 'outbound' | 'transfer' | null>(null);

    /* ── Overview query ── */
    const stockTypeParam = stockType === 'all' ? '' : `&type=${stockType}`;
    const { data: overviewData, isLoading: overviewLoading } = useQuery({
        queryKey: ['erp-inventory', overviewPage, stockType],
        queryFn: () => fetchJson<InventoryResponse>(`/erp/inventory?page=${overviewPage}&page_size=20${stockTypeParam}`),
    });

    /* ── Movements query ── */
    const { data: movementsData, isLoading: movementsLoading } = useQuery({
        queryKey: ['erp-inventory-movements', movementsPage, stockType],
        queryFn: () => fetchJson<MovementsResponse>(`/erp/inventory/movements?page=${movementsPage}&page_size=20${stockTypeParam}`),
        enabled: activeTab === 'movements',
    });

    /* ── Product/Material options for stock dialog ── */
    const { data: productsData } = useQuery({
        queryKey: ['erp-products-options'],
        queryFn: () => fetchJson<{ items: { id: string; name: string; sku: string }[] }>('/erp/products?page_size=999'),
        enabled: !!stockDialog && stockType !== 'material',
    });

    const { data: materialsData } = useQuery({
        queryKey: ['erp-materials-options'],
        queryFn: () => fetchJson<{ items: { id: string; name: string; sku: string }[] }>('/erp/materials?page_size=999'),
        enabled: !!stockDialog && stockType !== 'product',
    });

    const stockOptions = stockType === 'material'
        ? (materialsData?.items ?? [])
        : (productsData?.items ?? []);

    const overviewItems = overviewData?.items ?? [];
    const overviewTotal = overviewData?.total ?? 0;
    const overviewPageSize = overviewData?.page_size ?? 20;
    const overviewTotalPages = Math.max(1, Math.ceil(overviewTotal / overviewPageSize));

    const movementItems = movementsData?.items ?? [];
    const movementTotal = movementsData?.total ?? 0;
    const movementPageSize = movementsData?.page_size ?? 20;
    const movementTotalPages = Math.max(1, Math.ceil(movementTotal / movementPageSize));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Tab bar + actions ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['overview', 'movements'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                                border: activeTab === tab ? 'none' : '1px solid var(--border-subtle)',
                                background: activeTab === tab ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {tab === 'overview' ? (isChinese ? '库存总览' : 'Stock Overview') : (isChinese ? '出入库记录' : 'Movement Log')}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    {(['all', 'product', 'material'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => { setStockType(type); setOverviewPage(1); setMovementsPage(1); }}
                            style={{
                                padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                                border: stockType === type ? 'none' : '1px solid var(--border-subtle)',
                                background: stockType === type ? '#0ea5e9' : 'var(--bg-secondary)',
                                color: stockType === type ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {type === 'all' ? (isChinese ? '全部' : 'All') : type === 'product' ? (isChinese ? '产品' : 'Products') : (isChinese ? '物料' : 'Materials')}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ ...btnPrimary, background: '#22c55e' }} onClick={() => setStockDialog('inbound')}>
                            <IconPlus size={16} stroke={2} /> {isChinese ? '入库' : 'Inbound'}
                        </button>
                        <button style={{ ...btnPrimary, background: '#ef4444' }} onClick={() => setStockDialog('outbound')}>
                            <IconMinus size={16} stroke={2} /> {isChinese ? '出库' : 'Outbound'}
                        </button>
                        <button style={{ ...btnPrimary, background: '#8b5cf6' }} onClick={() => setStockDialog('transfer')}>
                            <IconTransfer size={16} stroke={2} /> {isChinese ? '调拨' : 'Transfer'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Stock overview table ── */}
            {activeTab === 'overview' && (
                <>
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th style={thStyle}>{isChinese ? '类型' : 'Type'}</th>
                                        <th style={thStyle}>{t('erp.product.name', isChinese ? '名称' : 'Name')}</th>
                                        <th style={thStyle}>{t('erp.product.sku', 'SKU')}</th>
                                        <th style={thStyle}>{t('erp.inventory.currentStock', '当前库存')}</th>
                                        <th style={thStyle}>{t('erp.inventory.minStock', '最低库存')}</th>
                                        <th style={thStyle}>{t('erp.inventory.stockValue', '库存价值')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overviewLoading ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                                    ) : overviewItems.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                                    ) : overviewItems.map(item => {
                                        const isLow = item.current_stock < item.min_stock;
                                        const rowBg = isLow ? 'rgba(239,68,68,0.06)' : 'transparent';
                                        const isMaterial = item.item_type === 'material';
                                        return (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: rowBg }}>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                        background: isMaterial ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.12)',
                                                        border: `1px solid ${isMaterial ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)'}`,
                                                        color: isMaterial ? '#8b5cf6' : '#3b82f6',
                                                    }}>
                                                        {isMaterial ? (isChinese ? '物料' : 'Material') : (isChinese ? '产品' : 'Product')}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>{item.product_name}</td>
                                                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{item.sku}</td>
                                                <td style={{ ...tdStyle, color: isLow ? '#ef4444' : 'var(--text-primary)', fontWeight: isLow ? 600 : 400 }}>
                                                    {item.current_stock}
                                                    {isLow && <span style={{ fontSize: 11, marginLeft: 4 }}>({t('erp.product.lowStock', '低库存')})</span>}
                                                </td>
                                                <td style={tdStyle}>{item.min_stock}</td>
                                                <td style={tdStyle}>{item.stock_value.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {overviewTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                            <button style={btnSecondary} disabled={overviewPage <= 1} onClick={() => setOverviewPage(p => p - 1)}>{isChinese ? '上一页' : 'Prev'}</button>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{overviewPage} / {overviewTotalPages}</span>
                            <button style={btnSecondary} disabled={overviewPage >= overviewTotalPages} onClick={() => setOverviewPage(p => p + 1)}>{isChinese ? '下一页' : 'Next'}</button>
                        </div>
                    )}
                </>
            )}

            {/* ── Movements table ── */}
            {activeTab === 'movements' && (
                <>
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th style={thStyle}>{t('erp.movement.time', '时间')}</th>
                                        <th style={thStyle}>{isChinese ? '类型' : 'Type'}</th>
                                        <th style={thStyle}>{t('erp.product.name', isChinese ? '名称' : 'Name')}</th>
                                        <th style={thStyle}>{t('erp.movement.warehouse', '仓库')}</th>
                                        <th style={thStyle}>{t('erp.movement.type', '操作类型')}</th>
                                        <th style={thStyle}>{t('erp.movement.quantity', '数量')}</th>
                                        <th style={thStyle}>{t('erp.movement.reason', '原因')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movementsLoading ? (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                                    ) : movementItems.length === 0 ? (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                                    ) : movementItems.map(m => {
                                        const typeColor = MOVEMENT_TYPE_COLOR[m.movement_type] ?? 'var(--text-tertiary)';
                                        const typeLabel = isChinese
                                            ? (MOVEMENT_TYPE_LABELS[m.movement_type]?.zh ?? m.movement_type)
                                            : (MOVEMENT_TYPE_LABELS[m.movement_type]?.en ?? m.movement_type);
                                        const isMaterial = m.item_type === 'material';
                                        return (
                                            <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{new Date(m.created_at).toLocaleString()}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                        background: isMaterial ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.12)',
                                                        border: `1px solid ${isMaterial ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)'}`,
                                                        color: isMaterial ? '#8b5cf6' : '#3b82f6',
                                                    }}>
                                                        {isMaterial ? (isChinese ? '物料' : 'Material') : (isChinese ? '产品' : 'Product')}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>{m.product_name}</td>
                                                <td style={tdStyle}>{m.warehouse}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                        background: `${typeColor}18`, border: `1px solid ${typeColor}40`,
                                                        color: typeColor,
                                                    }}>
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>{m.quantity}</td>
                                                <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{m.reason}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {movementTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                            <button style={btnSecondary} disabled={movementsPage <= 1} onClick={() => setMovementsPage(p => p - 1)}>{isChinese ? '上一页' : 'Prev'}</button>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{movementsPage} / {movementTotalPages}</span>
                            <button style={btnSecondary} disabled={movementsPage >= movementTotalPages} onClick={() => setMovementsPage(p => p + 1)}>{isChinese ? '下一页' : 'Next'}</button>
                        </div>
                    )}
                </>
            )}

            {/* ── Stock operation dialog ── */}
            {stockDialog && (
                <StockOperationDialog
                    operationType={stockDialog}
                    isChinese={isChinese}
                    productOptions={stockOptions}
                    onClose={() => setStockDialog(null)}
                />
            )}
        </div>
    );
}
