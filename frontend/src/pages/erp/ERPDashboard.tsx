/**
 * ERP Dashboard — Overview page with stats cards, sales trend chart, and recent orders.
 *
 * Uses react-query for data fetching, Recharts for visualization,
 * and the project's CSS variables / i18n pattern.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { IconUsers, IconReceipt2, IconAlertTriangle, IconCurrencyDollar } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';

/* ─── Types ─── */
interface DashboardStats {
    total_customers: number;
    monthly_sales: number;
    pending_orders: number;
    low_stock_alerts: number;
}

interface SalesTrendItem {
    month: string;
    sales: number;
    orders: number;
}

interface RecentOrder {
    id: string;
    order_no: string;
    customer_name: string;
    total_amount: number;
    status: string;
    created_at: string;
}

interface DashboardData {
    stats: DashboardStats;
    sales_trend: SalesTrendItem[];
    recent_orders: RecentOrder[];
}

/* ─── Status colors ─── */
const ORDER_STATUS_COLOR: Record<string, string> = {
    draft: '#8b8b9e',
    confirmed: '#3b82f6',
    processing: '#f59e0b',
    shipped: '#8b5cf6',
    completed: '#22c55e',
    cancelled: '#ef4444',
};

const ORDER_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
    draft:      { zh: '草稿',   en: 'Draft' },
    confirmed:  { zh: '已确认', en: 'Confirmed' },
    processing: { zh: '处理中', en: 'Processing' },
    shipped:    { zh: '已发货', en: 'Shipped' },
    completed:  { zh: '已完成', en: 'Completed' },
    cancelled:  { zh: '已取消', en: 'Cancelled' },
};

/* ─── Sub-components ─── */
function StatusBadge({ status, isChinese }: { status: string; isChinese: boolean }) {
    const color = ORDER_STATUS_COLOR[status] ?? 'var(--text-tertiary)';
    const label = isChinese
        ? (ORDER_STATUS_LABELS[status]?.zh ?? status)
        : (ORDER_STATUS_LABELS[status]?.en ?? status);
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

function StatCard({
    icon, label, value, color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
}) {
    return (
        <div style={{
            padding: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 16,
            flex: '1 1 200px',
        }}>
            <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            </div>
        </div>
    );
}

/* ─── Main component ─── */
export default function ERPDashboard() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');

    const { data, isLoading } = useQuery({
        queryKey: ['erp-dashboard'],
        queryFn: () => fetchJson<DashboardData>('/erp/dashboard'),
    });

    if (isLoading) {
        return (
            <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 60 }}>
                {t('erp.loading', '加载中...')}
            </div>
        );
    }

    const stats = data?.stats;
    const salesTrend = data?.sales_trend ?? [];
    const recentOrders = data?.recent_orders ?? [];

    const formatCurrency = (v: number) =>
        isChinese ? `¥${v.toLocaleString()}` : `$${v.toLocaleString()}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* ── Stat cards ── */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <StatCard
                    icon={<IconUsers size={22} stroke={1.5} />}
                    label={t('erp.dashboard.totalCustomers', '客户总数')}
                    value={stats?.total_customers ?? 0}
                    color="#3b82f6"
                />
                <StatCard
                    icon={<IconCurrencyDollar size={22} stroke={1.5} />}
                    label={t('erp.dashboard.monthlySales', '本月销售额')}
                    value={formatCurrency(stats?.monthly_sales ?? 0)}
                    color="#22c55e"
                />
                <StatCard
                    icon={<IconReceipt2 size={22} stroke={1.5} />}
                    label={t('erp.dashboard.pendingOrders', '待处理订单')}
                    value={stats?.pending_orders ?? 0}
                    color="#f59e0b"
                />
                <StatCard
                    icon={<IconAlertTriangle size={22} stroke={1.5} />}
                    label={t('erp.dashboard.lowStockAlerts', '库存预警数')}
                    value={stats?.low_stock_alerts ?? 0}
                    color="#ef4444"
                />
            </div>

            {/* ── Charts row ── */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* Sales trend line chart */}
                <div style={{
                    flex: '2 1 400px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: 20,
                }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t('erp.dashboard.salesTrend', '销售趋势（最近6个月）')}
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={salesTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="sales"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name={t('erp.dashboard.sales', '销售额')}
                            />
                            <Line
                                type="monotone"
                                dataKey="orders"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name={t('erp.dashboard.orders', '订单数')}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Placeholder for a pie or bar chart */}
                <div style={{
                    flex: '1 1 280px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: 20,
                }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t('erp.dashboard.orderStatusDist', '订单状态分布')}
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={salesTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                }}
                            />
                            <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} name={t('erp.dashboard.orders', '订单数')} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Recent orders ── */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 20,
            }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t('erp.dashboard.recentOrders', '最近订单')}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>{t('erp.order.orderNo', '订单号')}</th>
                                <th style={thStyle}>{t('erp.order.customer', '客户')}</th>
                                <th style={thStyle}>{t('erp.order.amount', '金额')}</th>
                                <th style={thStyle}>{t('erp.order.status', '状态')}</th>
                                <th style={thStyle}>{t('erp.order.date', '日期')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                                        {t('erp.noData', '暂无数据')}
                                    </td>
                                </tr>
                            ) : recentOrders.map(order => (
                                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}>{order.order_no}</td>
                                    <td style={tdStyle}>{order.customer_name}</td>
                                    <td style={tdStyle}>{formatCurrency(order.total_amount)}</td>
                                    <td style={tdStyle}><StatusBadge status={order.status} isChinese={isChinese} /></td>
                                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ─── Table cell styles ─── */
const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '10px 12px', color: 'var(--text-primary)',
};
