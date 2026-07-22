/**
 * XHS Content Calendar — Visual schedule management with calendar view.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconChevronLeft, IconChevronRight, IconPlus, IconX } from '@tabler/icons-react';

/* ─── Helpers ─── */
function getMonthDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekDay = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();
    const days: { date: Date; currentMonth: boolean }[] = [];
    // Previous month padding
    for (let i = startWeekDay - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        days.push({ date: d, currentMonth: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ date: new Date(year, month, i), currentMonth: true });
    }
    // Next month padding (fill to complete the last row)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), currentMonth: false });
    }
    return days;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const STATUS_DOT_COLOR: Record<string, string> = {
    draft: '#94a3b8',
    scheduled: '#f59e0b',
    publishing: '#3b82f6',
    published: '#10b981',
    failed: '#ef4444',
};

/* ─── Schedule Dialog ─── */
function QuickScheduleDialog({ accounts, onClose }: { accounts: any[]; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedTime, setSelectedTime] = useState('12:00');
    const [accountId, setAccountId] = useState('');

    const { data: contentData } = useQuery({
        queryKey: ['xhs-content', 'draft'],
        queryFn: () => fetchJson('/xhs/content?status=draft'),
    });
    const [contentId, setContentId] = useState('');

    const drafts = ((contentData as any)?.items || []) as any[];

    const scheduleMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/schedule', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-content'] });
            onClose();
        },
    });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 12, padding: 24, width: 420,
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>📅 新建排期</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <IconX size={18} />
                    </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>选择草稿</label>
                    <select value={contentId} onChange={e => setContentId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">选择要排期的内容</option>
                        {drafts.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>发布日期</label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>发布时间</label>
                        <input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)} style={inputStyle} />
                    </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>发布账号</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">选择账号</option>
                        {accounts.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondaryStyle}>取消</button>
                    <button
                        onClick={() => {
                            if (!contentId || !accountId || !selectedDate) return;
                            scheduleMutation.mutate({
                                content_id: contentId,
                                account_id: accountId,
                                scheduled_at: `${selectedDate}T${selectedTime}:00`,
                            });
                        }}
                        disabled={!contentId || !accountId}
                        style={{
                            ...btnPrimaryStyle,
                            background: (contentId && accountId) ? '#ff2442' : '#ccc',
                            cursor: (contentId && accountId) ? 'pointer' : 'not-allowed',
                        }}
                    >
                        确认排期
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main ─── */
export default function ContentCalendar() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [showSchedule, setShowSchedule] = useState(false);

    const { data: contentData } = useQuery({
        queryKey: ['xhs-content', 'all'],
        queryFn: () => fetchJson('/xhs/content'),
    });

    const { data: accountsData } = useQuery({
        queryKey: ['xhs-accounts'],
        queryFn: () => fetchJson('/xhs/accounts'),
    });

    const items = (contentData as any)?.items || [];
    const accounts = (accountsData as any)?.items || [];

    // Map content items by date (scheduled_at or created_at)
    const itemsByDate = useMemo(() => {
        const map: Record<string, any[]> = {};
        items.forEach((item: any) => {
            const dateStr = (item.scheduled_at || item.published_at || item.created_at || '').slice(0, 10);
            if (dateStr) {
                if (!map[dateStr]) map[dateStr] = [];
                map[dateStr].push(item);
            }
        });
        return map;
    }, [items]);

    const days = getMonthDays(year, month);

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };

    const monthLabel = `${year}年${month + 1}月`;
    const todayStr = new Date().toISOString().slice(0, 10);

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={prevMonth} style={navBtnStyle}><IconChevronLeft size={18} /></button>
                    <span style={{ fontSize: 18, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>{monthLabel}</span>
                    <button onClick={nextMonth} style={navBtnStyle}><IconChevronRight size={18} /></button>
                    <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                        background: '#fff', cursor: 'pointer', fontSize: 12,
                    }}>今天</button>
                </div>
                <button onClick={() => setShowSchedule(true)} style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #ff2442, #ff6b81)',
                    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <IconPlus size={16} /> 新建排期
                </button>
            </div>

            {/* Calendar grid */}
            <div style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden',
            }}>
                {/* Weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e8ecf1' }}>
                    {WEEKDAYS.map(d => (
                        <div key={d} style={{
                            padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                            color: '#64748b', background: '#f8fafc',
                        }}>{d}</div>
                    ))}
                </div>

                {/* Days */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {days.map((day, i) => {
                        const dateStr = day.date.toISOString().slice(0, 10);
                        const isToday = dateStr === todayStr;
                        const dayItems = itemsByDate[dateStr] || [];
                        return (
                            <div key={i} style={{
                                minHeight: 90, padding: 6,
                                borderRight: (i % 7 < 6) ? '1px solid #f1f5f9' : 'none',
                                borderBottom: (i < 35) ? '1px solid #f1f5f9' : 'none',
                                background: day.currentMonth ? '#fff' : '#fafbfc',
                                opacity: day.currentMonth ? 1 : 0.4,
                            }}>
                                <div style={{
                                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                                    color: isToday ? '#ff2442' : (day.currentMonth ? '#1e293b' : '#94a3b8'),
                                    marginBottom: 4,
                                    ...(isToday ? {
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 22, height: 22, borderRadius: '50%', background: '#ff2442', color: '#fff',
                                    } : {}),
                                }}>
                                    {day.date.getDate()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {dayItems.slice(0, 3).map((item: any) => (
                                        <div key={item.id} style={{
                                            fontSize: 10, padding: '2px 4px', borderRadius: 3,
                                            background: `${STATUS_DOT_COLOR[item.status] || '#94a3b8'}15`,
                                            color: STATUS_DOT_COLOR[item.status] || '#94a3b8',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }}>
                                            {item.title}
                                        </div>
                                    ))}
                                    {dayItems.length > 3 && (
                                        <div style={{ fontSize: 10, color: '#94a3b8' }}>+{dayItems.length - 3}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingLeft: 4 }}>
                {Object.entries(STATUS_DOT_COLOR).map(([key, color]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                        {({ draft: '草稿', scheduled: '排期中', publishing: '发布中', published: '已发布', failed: '失败' } as any)[key]}
                    </div>
                ))}
            </div>

            {showSchedule && (
                <QuickScheduleDialog accounts={accounts} onClose={() => setShowSchedule(false)} />
            )}
        </div>
    );
}

/* ─── Styles ─── */
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' };
const btnPrimaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600 };
const btnSecondaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 };
const navBtnStyle: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
};
