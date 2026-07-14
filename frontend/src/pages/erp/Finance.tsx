/**
 * Finance — Financial management with summary cards, income/expense records, and create dialog.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';

/* ─── Types ─── */
interface FinanceSummary {
    total_income: number;
    total_expense: number;
    profit: number;
    receivable: number;
    payable: number;
}

interface FinanceRecord {
    id: string;
    record_type: string;
    category: string;
    amount: number;
    date: string;
    status: string;
    related_order_no: string;
    notes: string;
    created_at: string;
}

interface FinanceResponse {
    summary: FinanceSummary;
    items: FinanceRecord[];
    total: number;
    page: number;
    page_size: number;
}

/* ─── Constants ─── */
const RECORD_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
    income:  { zh: '收入', en: 'Income' },
    expense: { zh: '支出', en: 'Expense' },
};

const RECORD_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
    pending:   { zh: '待确认', en: 'Pending' },
    confirmed: { zh: '已确认', en: 'Confirmed' },
    cancelled: { zh: '已取消', en: 'Cancelled' },
};

const INCOME_CATEGORIES = ['sales', 'service', 'other_income', 'refund'];
const EXPENSE_CATEGORIES = ['purchase', 'salary', 'rent', 'utility', 'marketing', 'other_expense'];

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
    sales:          { zh: '销售收入', en: 'Sales' },
    service:        { zh: '服务收入', en: 'Service' },
    other_income:   { zh: '其他收入', en: 'Other Income' },
    refund:         { zh: '退款', en: 'Refund' },
    purchase:       { zh: '采购支出', en: 'Purchase' },
    salary:         { zh: '工资', en: 'Salary' },
    rent:           { zh: '租金', en: 'Rent' },
    utility:        { zh: '水电费', en: 'Utility' },
    marketing:      { zh: '营销', en: 'Marketing' },
    other_expense:  { zh: '其他支出', en: 'Other Expense' },
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

/* ─── Summary Card ─── */
function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{
            padding: '16px 20px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)', borderRadius: 10,
            flex: '1 1 160px',
        }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
        </div>
    );
}

/* ─── New Record Dialog ─── */
function NewRecordDialog({
    onClose, isChinese, orderOptions,
}: {
    onClose: (saved: boolean) => void;
    isChinese: boolean;
    orderOptions: { order_no: string }[];
}) {
    const queryClient = useQueryClient();
    const [recordType, setRecordType] = useState('income');
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [relatedOrder, setRelatedOrder] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const categories = recordType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) { setError(isChinese ? '请输入有效金额' : 'Please enter a valid amount'); return; }
        if (!category) { setError(isChinese ? '请选择分类' : 'Please select a category'); return; }
        setSaving(true); setError('');
        try {
            await fetchJson('/erp/financials', {
                method: 'POST',
                body: JSON.stringify({
                    record_type: recordType,
                    category,
                    amount: parseFloat(amount),
                    date,
                    related_order_no: relatedOrder || undefined,
                    notes,
                }),
            });
            queryClient.invalidateQueries({ queryKey: ['erp-finance'] });
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
                    {isChinese ? '新建收支记录' : 'New Finance Record'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Type toggle */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '类型' : 'Type'}
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['income', 'expense'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setRecordType(t); setCategory(''); }}
                                    style={{
                                        padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                                        border: recordType === t ? 'none' : '1px solid var(--border-subtle)',
                                        background: recordType === t ? (t === 'income' ? '#22c55e' : '#ef4444') : 'var(--bg-secondary)',
                                        color: recordType === t ? '#fff' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isChinese ? RECORD_TYPE_LABELS[t].zh : RECORD_TYPE_LABELS[t].en}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '分类' : 'Category'}
                        </label>
                        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                            <option value="">{isChinese ? '-- 选择分类 --' : '-- Select Category --'}</option>
                            {categories.map(c => (
                                <option key={c} value={c}>{isChinese ? (CATEGORY_LABELS[c]?.zh ?? c) : (CATEGORY_LABELS[c]?.en ?? c)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '金额' : 'Amount'}
                        </label>
                        <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '日期' : 'Date'}
                        </label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '关联订单（可选）' : 'Related Order (optional)'}
                        </label>
                        <select value={relatedOrder} onChange={e => setRelatedOrder(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                            <option value="">{isChinese ? '-- 无 --' : '-- None --'}</option>
                            {orderOptions.map(o => <option key={o.order_no} value={o.order_no}>{o.order_no}</option>)}
                        </select>
                    </div>
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

/* ─── Main component ─── */
export default function Finance() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [typeFilter, setTypeFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showNew, setShowNew] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['erp-finance', page, typeFilter, dateFrom, dateTo],
        queryFn: () => fetchJson<FinanceResponse>(
            `/erp/financials?page=${page}&page_size=20&type=${typeFilter === 'all' ? '' : typeFilter}&date_from=${dateFrom}&date_to=${dateTo}`,
        ),
    });

    const summary = data?.summary;
    const records = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const pageSize = Array.isArray(data) ? data.length : (data?.page_size ?? 20);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const fmt = (v: number) => isChinese ? `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Summary cards ── */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <SummaryCard label={t('erp.finance.totalIncome', '总收入')} value={fmt(summary?.total_income ?? 0)} color="#22c55e" />
                <SummaryCard label={t('erp.finance.totalExpense', '总支出')} value={fmt(summary?.total_expense ?? 0)} color="#ef4444" />
                <SummaryCard label={t('erp.finance.profit', '利润')} value={fmt(summary?.profit ?? 0)} color="#3b82f6" />
                <SummaryCard label={t('erp.finance.receivable', '应收')} value={fmt(summary?.receivable ?? 0)} color="#f59e0b" />
                <SummaryCard label={t('erp.finance.payable', '应付')} value={fmt(summary?.payable ?? 0)} color="#8b5cf6" />
            </div>

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, minWidth: 100 }}>
                    <option value="all">{isChinese ? '全部类型' : 'All Types'}</option>
                    <option value="income">{isChinese ? '收入' : 'Income'}</option>
                    <option value="expense">{isChinese ? '支出' : 'Expense'}</option>
                </select>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>~</span>
                    <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={() => setShowNew(true)}>
                    <IconPlus size={16} stroke={2} />
                    {t('erp.finance.newRecord', '新建记录')}
                </button>
            </div>

            {/* ── Records table ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.finance.type', '类型')}</th>
                                <th style={thStyle}>{t('erp.finance.category', '分类')}</th>
                                <th style={thStyle}>{t('erp.finance.amount', '金额')}</th>
                                <th style={thStyle}>{t('erp.finance.date', '日期')}</th>
                                <th style={thStyle}>{t('erp.finance.status', '状态')}</th>
                                <th style={thStyle}>{t('erp.finance.relatedOrder', '关联订单')}</th>
                                <th style={thStyle}>{t('erp.finance.notes', '备注')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.noData', '暂无数据')}</td></tr>
                            ) : records.map(r => {
                                const isIncome = r.record_type === 'income';
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                background: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                                border: `1px solid ${isIncome ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                color: isIncome ? '#22c55e' : '#ef4444',
                                            }}>
                                                {isChinese ? RECORD_TYPE_LABELS[r.record_type]?.zh ?? r.record_type : RECORD_TYPE_LABELS[r.record_type]?.en ?? r.record_type}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{isChinese ? (CATEGORY_LABELS[r.category]?.zh ?? r.category) : (CATEGORY_LABELS[r.category]?.en ?? r.category)}</td>
                                        <td style={{ ...tdStyle, fontWeight: 600, color: isIncome ? '#22c55e' : '#ef4444' }}>
                                            {isIncome ? '+' : '-'}{fmt(r.amount)}
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{r.date}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                                                background: r.status === 'confirmed' ? 'rgba(34,197,94,0.12)' : r.status === 'cancelled' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                                border: `1px solid ${r.status === 'confirmed' ? 'rgba(34,197,94,0.3)' : r.status === 'cancelled' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                                color: r.status === 'confirmed' ? '#22c55e' : r.status === 'cancelled' ? '#ef4444' : '#f59e0b',
                                            }}>
                                                {isChinese ? (RECORD_STATUS_LABELS[r.status]?.zh ?? r.status) : (RECORD_STATUS_LABELS[r.status]?.en ?? r.status)}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{r.related_order_no}</td>
                                        <td style={{ ...tdStyle, color: 'var(--text-tertiary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</td>
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

            {showNew && (
                <NewRecordDialog isChinese={isChinese} orderOptions={[]} onClose={() => setShowNew(false)} />
            )}
        </div>
    );
}
