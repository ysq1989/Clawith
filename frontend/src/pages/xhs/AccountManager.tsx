/**
 * XHS Accounts — Manage Xiaohongshu accounts.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { useState } from 'react';
import { IconPlus, IconTrash, IconLogin } from '@tabler/icons-react';

export default function AccountManager() {
    const queryClient = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [name, setName] = useState('');
    const [alias, setAlias] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['xhs-accounts'],
        queryFn: () => fetchJson('/xhs/accounts'),
    });

    const addMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['xhs-accounts'] }); setShowAdd(false); setName(''); setAlias(''); },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/xhs/accounts/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['xhs-accounts'] }),
    });

    const items = (data as any)?.items || [];

    return (
        <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #ff2442, #ff6b81)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconPlus size={16} /> 添加账号
                </button>
            </div>

            {showAdd && (
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e8ecf1', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>账号名称</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="如：品牌官方号" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>别名（可选）</label>
                        <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="如：brand_official" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={() => name && addMutation.mutate({ name, alias })} disabled={!name} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: name ? '#ff2442' : '#ccc', color: '#fff', cursor: name ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>保存</button>
                </div>
            )}

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden' }}>
                {items.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                        <div>暂无账号，点击"添加账号"开始</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e8ecf1', background: '#f8fafc' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>账号名称</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>别名</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>状态</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((acc: any) => (
                                <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{acc.name}</td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{acc.alias || '-'}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: acc.status === 'active' ? '#10b98115' : '#ef444415', color: acc.status === 'active' ? '#10b981' : '#ef4444', fontSize: 12 }}>
                                            {acc.status === 'active' ? '正常' : '异常'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <button onClick={() => deleteMutation.mutate(acc.id)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }} title="删除">
                                            <IconTrash size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
