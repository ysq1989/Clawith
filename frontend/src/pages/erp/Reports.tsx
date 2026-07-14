/**
 * Reports — Multi-tab reporting page with Recharts visualizations.
 *
 * Tabs: Sales Report, Purchase Report, Inventory Report, Customer Ranking, P&L Statement.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fetchJson } from '../../services/api';

/* ─── Types ─── */
interface MonthlyData {
    month: string;
    value: number;
    count?: number;
}

interface RankingItem {
    name: string;
    value: number;
}

interface InventoryChartItem {
    name: string;
    sku: string;
    stock: number;
    min_stock: number;
}

interface PLData {
    months: string[];
    income: number[];
    expense: number[];
    profit: number[];
}

interface ReportsData {
    sales_monthly: MonthlyData[];
    purchase_monthly: MonthlyData[];
    inventory_chart: InventoryChartItem[];
    customer_ranking: RankingItem[];
    pnl: PLData;
    sales_table: { month: string; orders: number; amount: number }[];
    purchase_table: { month: string; orders: number; amount: number }[];
}

/* ─── Styles ─── */
const btnTab: React.CSSProperties = {
    padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
};
const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13,
};

/* ─── Chart wrapper ─── */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: 20, flex: '1 1 400px',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {title}
            </h3>
            {children}
        </div>
    );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
    return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            {headers.map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>--</td></tr>
                        ) : rows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                {row.map((cell, ci) => <td key={ci} style={tdStyle}>{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─── Tooltip style ─── */
const tooltipStyle = {
    contentStyle: {
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, fontSize: 12,
    },
};

/* ─── Main component ─── */
export default function Reports() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const [activeTab, setActiveTab] = useState('sales');

    const { data, isLoading } = useQuery({
        queryKey: ['erp-reports'],
        queryFn: async (): Promise<ReportsData> => {
            const [salesRes, purchaseRes, inventoryRes, customersRes, pnlRes] = await Promise.all([
                fetchJson<{ month: string; amount: number; orders: number }[]>('/erp/reports/sales'),
                fetchJson<{ month: string; amount: number; orders: number }[]>('/erp/reports/purchase'),
                fetchJson<{ name: string; sku: string; stock: number; min_stock: number }[]>('/erp/reports/inventory'),
                fetchJson<{ name: string; value: number }[]>('/erp/reports/customers'),
                fetchJson<{ months: string[]; income: number[]; expense: number[]; profit: number[] }>('/erp/reports/profit-loss'),
            ]);
            return {
                sales_monthly: salesRes.map(r => ({ month: r.month, value: r.amount, count: r.orders })),
                sales_table: salesRes,
                purchase_monthly: purchaseRes.map(r => ({ month: r.month, value: r.amount, count: r.orders })),
                purchase_table: purchaseRes,
                inventory_chart: inventoryRes,
                customer_ranking: customersRes,
                pnl: pnlRes,
            };
        },
    });

    const tabs = [
        { key: 'sales',     label: isChinese ? '销售报表' : 'Sales Report' },
        { key: 'purchase',  label: isChinese ? '采购报表' : 'Purchase Report' },
        { key: 'inventory', label: isChinese ? '库存报表' : 'Inventory Report' },
        { key: 'customers', label: isChinese ? '客户排名' : 'Customer Ranking' },
        { key: 'pnl',       label: isChinese ? '损益表' : 'P&L Statement' },
    ];

    if (isLoading) {
        return (
            <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 60 }}>
                {t('erp.loading', '加载中...')}
            </div>
        );
    }

    const salesMonthly = data?.sales_monthly ?? [];
    const purchaseMonthly = data?.purchase_monthly ?? [];
    const inventoryChart = data?.inventory_chart ?? [];
    const customerRanking = data?.customer_ranking ?? [];
    const pnl = data?.pnl ?? { months: [], income: [], expense: [], profit: [] };
    const salesTable = data?.sales_table ?? [];
    const purchaseTable = data?.purchase_table ?? [];

    const pnlData = (pnl.months ?? []).map((m, i) => ({
        month: m,
        income: pnl.income[i] ?? 0,
        expense: pnl.expense[i] ?? 0,
        profit: pnl.profit[i] ?? 0,
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            ...btnTab,
                            background: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                            border: activeTab === tab.key ? 'none' : '1px solid var(--border-subtle)',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Sales Report ── */}
            {activeTab === 'sales' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ChartCard title={t('erp.reports.salesTrend', '月度销售趋势')}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={salesMonthly}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                                <Tooltip {...tooltipStyle} />
                                <Legend />
                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.salesAmount', '销售额')} />
                                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.orderCount', '订单数')} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <DataTable
                        headers={[
                            isChinese ? '月份' : 'Month',
                            isChinese ? '订单数' : 'Orders',
                            isChinese ? '销售额' : 'Amount',
                        ]}
                        rows={salesTable.map(r => [r.month, r.orders, r.amount.toFixed(2)])}
                    />
                </div>
            )}

            {/* ── Purchase Report ── */}
            {activeTab === 'purchase' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ChartCard title={t('erp.reports.purchaseTrend', '月度采购趋势')}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={purchaseMonthly}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                                <Tooltip {...tooltipStyle} />
                                <Legend />
                                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.purchaseAmount', '采购额')} />
                                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.orderCount', '订单数')} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <DataTable
                        headers={[
                            isChinese ? '月份' : 'Month',
                            isChinese ? '订单数' : 'Orders',
                            isChinese ? '采购额' : 'Amount',
                        ]}
                        rows={purchaseTable.map(r => [r.month, r.orders, r.amount.toFixed(2)])}
                    />
                </div>
            )}

            {/* ── Inventory Report ── */}
            {activeTab === 'inventory' && (
                <ChartCard title={t('erp.reports.inventoryLevels', '各产品库存量')}>
                    <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={inventoryChart} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <Tooltip {...tooltipStyle} />
                            <Legend />
                            <Bar dataKey="stock" fill="#3b82f6" radius={[0, 4, 4, 0]} name={t('erp.reports.currentStock', '当前库存')} />
                            <Bar dataKey="min_stock" fill="#ef4444" radius={[0, 4, 4, 0]} name={t('erp.reports.minStock', '最低库存')} opacity={0.6} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* ── Customer Ranking ── */}
            {activeTab === 'customers' && (
                <ChartCard title={t('erp.reports.topCustomers', 'Top 10 客户贡献')}>
                    <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={customerRanking.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <Tooltip {...tooltipStyle} />
                            <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} name={t('erp.reports.salesAmount', '销售额')} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* ── P&L Statement ── */}
            {activeTab === 'pnl' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ChartCard title={t('erp.reports.pnlChart', '收支利润对比')}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={pnlData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                                <Tooltip {...tooltipStyle} />
                                <Legend />
                                <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.income', '收入')} />
                                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.expense', '支出')} />
                                <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name={t('erp.reports.profit', '利润')} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <DataTable
                        headers={[
                            isChinese ? '月份' : 'Month',
                            isChinese ? '收入' : 'Income',
                            isChinese ? '支出' : 'Expense',
                            isChinese ? '利润' : 'Profit',
                        ]}
                        rows={pnlData.map(r => [r.month, r.income.toFixed(2), r.expense.toFixed(2), r.profit.toFixed(2)])}
                    />
                </div>
            )}
        </div>
    );
}
