/**
 * Payments — Payment management with tabs for receivables / payables,
 * payment list, and create dialog.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Payment {
    id: string;
    payment_no: string;
    payment_type: string;
    related_order_no: string;
    partner_name: string;
    amount: number;
    method: string;
    date: string;
    notes: string;
    created_at: string;
}

interface PaymentsResponse {
    items: Payment[];
    total: number;
    page: number;
    page_size: number;
}

/* ─── Constants ─── */
const PAYMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
    receipt: { zh: '收款', en: 'Receipt' },
    payment: { zh: '付款', en: 'Payment' },
};

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check', 'wechat', 'alipay', 'other'];

const METHOD_LABELS: Record<string, { zh: string; en: string }> = {
    bank_transfer: { zh: '银行转账', en: 'Bank Transfer' },
    cash:          { zh: '现金', en: 'Cash' },
    check:         { zh: '支票', en: 'Check' },
    wechat:        { zh: '微信', en: 'WeChat' },
    alipay:        { zh: '支付宝', en: 'Alipay' },
    other:         { zh: '其他', en: 'Other' },
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

/* ─── New Payment Dialog ─── */
function NewPaymentDialog({
    onClose, isChinese, defaultType,
}: {
    onClose: (saved: boolean) => void;
    isChinese: boolean;
    defaultType: 'receipt' | 'payment';
}) {
    const queryClient = useQueryClient();
    const [paymentType, setPaymentType] = useState(defaultType);
    const [relatedOrder, setRelatedOrder] = useState('');
    const [partnerName, setPartnerName] = useState('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('bank_transfer');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    /* Fetch order options for related order selector */
    const orderApiPath = paymentType === 'receipt' ? '/erp/sales-orders' : '/erp/purchase-orders';
    const { data: orderData } = useQuery({
        queryKey: ['erp-orders-for-payment', paymentType],
        queryFn: () => fetchJson<any>(`${orderApiPath}?page=1&page_size=100`),
    });

    const orderOptions = Array.isArray(orderData) ? orderData : (orderData?.items ?? []);

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) { setError(isChinese ? '请输入有效金额' : 'Please enter a valid amount'); return; }
        setSaving(true); setError('');
        try {
            await fetchJson('/erp/payments', {
                method: 'POST',
                body: JSON.stringify({
                    payment_type: paymentType,
                    related_order_no: relatedOrder || undefined,
                    partner_name: partnerName,
                    amount: parseFloat(amount),
                    method,
                    date,
                    notes,
                }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-payments'] });
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
                    {isChinese ? '新建收付款' : 'New Payment'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Type toggle */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '类型' : 'Type'}
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['receipt', 'payment'] as const).map(tp => (
                                <button
                                    key={tp}
                                    onClick={() => { setPaymentType(tp); setRelatedOrder(''); }}
                                    style={{
                                        padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                                        border: paymentType === tp ? 'none' : '1px solid var(--border-subtle)',
                                        background: paymentType === tp ? (tp === 'receipt' ? '#22c55e' : '#3b82f6') : 'var(--bg-secondary)',
                                        color: paymentType === tp ? '#fff' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isChinese ? PAYMENT_TYPE_LABELS[tp].zh : PAYMENT_TYPE_LABELS[tp].en}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Related order */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '关联订单（可选）' : 'Related Order (optional)'}
                        </label>
                        <select value={relatedOrder} onChange={e => setRelatedOrder(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                            <option value="">{isChinese ? '-- 无 --' : '-- None --'}</option>
                            {orderOptions.map((o: any) => (
                                <option key={o.id ?? o.order_no} value={o.order_no}>{o.order_no}{o.customer_name ? ` - ${o.customer_name}` : ''}{o.supplier_name ? ` - ${o.supplier_name}` : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Partner name */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {paymentType === 'receipt'
                                ? (isChinese ? '客户名称' : 'Customer Name')
                                : (isChinese ? '供应商名称' : 'Supplier Name')
                            }
                        </label>
                        <input value={partnerName} onChange={e => setPartnerName(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>

                    {/* Amount */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {isChinese ? '金额 *' : 'Amount *'}
                            </label>
                            <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {isChinese ? '支付方式' : 'Method'}
                            </label>
                            <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m} value={m}>{isChinese ? (METHOD_LABELS[m]?.zh ?? m) : (METHOD_LABELS[m]?.en ?? m)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '日期' : 'Date'}
                        </label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '备注' : 'Notes'}
                        </label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
                    </div>
                </div>

                {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button style={btnSecondary} onClick={() => onClose(false)}>{isChinese ? '取消' : 'Cancel'}</button>
                    <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer' }} onClick={handleSubmit} disabled={saving}>
                        {saving ? (isChinese ? '保存中...' : 'Saving...') : (isChinese ? '保存' : 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function Payments() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const [activeTab, setActiveTab] = useState<'receipt' | 'payment'>('receipt');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [showNew, setShowNew] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-payments', activeTab, search, dateFrom, dateTo, page],
        queryFn: () => fetchJson<PaymentsResponse>(
            `/erp/payments?payment_type=${activeTab}&search=${encodeURIComponent(search)}&date_from=${dateFrom}&date_to=${dateTo}&page=${page}&page_size=20`,
        ),
    });

    const payments = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const fmt = (v: number) => isChinese ? `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-subtle)' }}>
                {(['receipt', 'payment'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setPage(1); }}
                        style={{
                            padding: '10px 24px', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            marginBottom: -2, transition: 'all 0.15s',
                        }}
                    >
                        {tab === 'receipt'
                            ? (isChinese ? '收款记录' : 'Receipts')
                            : (isChinese ? '付款记录' : 'Payments')
                        }
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
                        placeholder={t('erp.payments.searchPlaceholder', '搜索编号、订单号、客户/供应商...')}
                        style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>~</span>
                    <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => setShowNew(true)}>
                    <IconPlus size={16} stroke={2} />
                    {activeTab === 'receipt'
                        ? (isChinese ? '新建收款' : 'New Receipt')
                        : (isChinese ? '新建付款' : 'New Payment')
                    }
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.payments.paymentNo', '编号')}</th>
                                <th style={thStyle}>{t('erp.payments.type', '类型')}</th>
                                <th style={thStyle}>{t('erp.payments.relatedOrder', '关联订单')}</th>
                                <th style={thStyle}>
                                    {activeTab === 'receipt'
                                        ? (isChinese ? '客户' : 'Customer')
                                        : (isChinese ? '供应商' : 'Supplier')
                                    }
                                </th>
                                <th style={thStyle}>{t('erp.payments.amount', '金额')}</th>
                                <th style={thStyle}>{t('erp.payments.method', '方式')}</th>
                                <th style={thStyle}>{t('erp.payments.date', '日期')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                            ) : payments.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                            ) : payments.map(p => {
                                const isReceipt = p.payment_type === 'receipt';
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{p.payment_no}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                background: isReceipt ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                                                border: `1px solid ${isReceipt ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
                                                color: isReceipt ? '#22c55e' : '#3b82f6',
                                            }}>
                                                {isChinese ? PAYMENT_TYPE_LABELS[p.payment_type]?.zh ?? p.payment_type : PAYMENT_TYPE_LABELS[p.payment_type]?.en ?? p.payment_type}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{p.related_order_no}</td>
                                        <td style={tdStyle}>{p.partner_name}</td>
                                        <td style={{ ...tdStyle, fontWeight: 600, color: isReceipt ? '#22c55e' : '#3b82f6' }}>
                                            {isReceipt ? '+' : '-'}{fmt(p.amount)}
                                        </td>
                                        <td style={tdStyle}>
                                            {isChinese ? (METHOD_LABELS[p.method]?.zh ?? p.method) : (METHOD_LABELS[p.method]?.en ?? p.method)}
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{p.date}</td>
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

            {/* ── Dialogs ── */}
            {showNew && (
                <NewPaymentDialog
                    defaultType={activeTab}
                    isChinese={isChinese}
                    onClose={() => setShowNew(false)}
                />
            )}
        </div>
    );
}
