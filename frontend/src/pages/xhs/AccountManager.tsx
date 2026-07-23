/**
 * XHS Accounts — Manage Xiaohongshu accounts with QR code login flow.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import { IconPlus, IconTrash, IconLogin, IconRefresh, IconCheck, IconX } from '@tabler/icons-react';

/* ─── Login Status Badge ─── */
function LoginBadge({ status, lastLoginAt }: { status: string; lastLoginAt?: string }) {
    const isActive = status === 'active';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 4,
            background: isActive ? '#10b98115' : '#f59e0b15',
            color: isActive ? '#10b981' : '#f59e0b',
            fontSize: 12, fontWeight: 500,
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isActive ? '#10b981' : '#f59e0b',
            }} />
            {isActive ? '正常' : '未登录'}
            {lastLoginAt && (
                <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>
                    {new Date(lastLoginAt).toLocaleDateString('zh-CN')}
                </span>
            )}
        </span>
    );
}

/* ─── QR Code Login Dialog ─── */
function QRCodeLoginDialog({ accountId, accountName, onClose }: {
    accountId: string;
    accountName: string;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [qrState, setQrState] = useState<'loading' | 'ready' | 'scanning' | 'confirmed' | 'expired' | 'error'>('loading');
    const [qrData, setQrData] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState('');

    // Trigger QR code generation
    const triggerLogin = useCallback(async () => {
        setQrState('loading');
        try {
            const result = await fetchJson(`/xhs/accounts/${accountId}/login`, { method: 'POST' }) as any;
            if (result.logged_in) {
                setQrState('confirmed');
                queryClient.invalidateQueries({ queryKey: ['xhs-accounts'] });
                return;
            }
            if (result.success && result.qrcode_data_url) {
                setQrState('ready');
                setQrData(result.qrcode_data_url);
            } else if (result.success) {
                setQrState('ready');
                setQrData('');
            } else {
                setQrState('error');
                setErrorMsg(result.message || '无法生成二维码，请检查 Chrome CDP 是否已启动');
            }
        } catch {
            setQrState('error');
            setErrorMsg('请求失败，请检查 Chrome CDP 是否已启动');
        }
    }, [accountId, queryClient]);

    useEffect(() => {
        triggerLogin();
    }, [triggerLogin]);

    // Poll login status
    useEffect(() => {
        if (qrState !== 'ready' && qrState !== 'scanning') return;
        const interval = setInterval(async () => {
            try {
                const result = await fetchJson(`/xhs/accounts/${accountId}/status`) as any;
                if (result.logged_in) {
                    setQrState('confirmed');
                    queryClient.invalidateQueries({ queryKey: ['xhs-accounts'] });
                    clearInterval(interval);
                }
            } catch { /* ignore */ }
        }, 3000);
        return () => clearInterval(interval);
    }, [qrState, accountId, queryClient]);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 16, padding: 32, width: 360,
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)', textAlign: 'center',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>扫码登录小红书</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <IconX size={18} />
                    </button>
                </div>

                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
                    账号: <span style={{ fontWeight: 500 }}>{accountName}</span>
                </div>

                {/* QR Code Area */}
                <div style={{
                    width: 200, height: 200, margin: '0 auto 20px',
                    borderRadius: 12, border: '2px dashed #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f8fafc', overflow: 'hidden',
                }}>
                    {qrState === 'loading' && (
                        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontSize: 12 }}>生成中...</div>
                        </div>
                    )}
                    {qrState === 'ready' && !qrData && (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <div style={{ fontSize: 48, marginBottom: 8 }}>📱</div>
                            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                                请使用小红书App<br />扫描二维码
                            </div>
                        </div>
                    )}
                    {qrState === 'ready' && qrData && (
                        <img src={qrData} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                    {qrState === 'scanning' && (
                        <div style={{ textAlign: 'center', color: '#3b82f6' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                            <div style={{ fontSize: 12 }}>扫码中，请确认登录...</div>
                        </div>
                    )}
                    {qrState === 'confirmed' && (
                        <div style={{ textAlign: 'center', color: '#10b981' }}>
                            <IconCheck size={48} />
                            <div style={{ fontSize: 13, marginTop: 8, fontWeight: 500 }}>登录成功！</div>
                        </div>
                    )}
                    {qrState === 'expired' && (
                        <div style={{ textAlign: 'center', color: '#f59e0b' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⏰</div>
                            <div style={{ fontSize: 12 }}>二维码已过期</div>
                        </div>
                    )}
                    {qrState === 'error' && (
                        <div style={{ textAlign: 'center', color: '#ef4444' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>❌</div>
                            <div style={{ fontSize: 12, padding: '0 16px' }}>{errorMsg}</div>
                        </div>
                    )}
                </div>

                {/* Status text */}
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, minHeight: 16 }}>
                    {qrState === 'ready' && '打开小红书App → 扫一扫 → 扫描二维码'}
                    {qrState === 'scanning' && '已扫描，等待确认...'}
                    {qrState === 'confirmed' && '登录成功！可以关闭此窗口'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {(qrState === 'expired' || qrState === 'error') && (
                        <button onClick={triggerLogin} style={{
                            padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
                            background: '#fff', cursor: 'pointer', fontSize: 13,
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <IconRefresh size={14} /> 重新生成
                        </button>
                    )}
                    <button onClick={onClose} style={{
                        padding: '8px 16px', borderRadius: 6, border: 'none',
                        background: qrState === 'confirmed' ? '#10b981' : '#94a3b8',
                        color: '#fff', cursor: 'pointer', fontSize: 13,
                    }}>
                        {qrState === 'confirmed' ? '完成' : '关闭'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function AccountManager() {
    const queryClient = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [name, setName] = useState('');
    const [alias, setAlias] = useState('');
    const [loginAccountId, setLoginAccountId] = useState<string | null>(null);
    const [loginAccountName, setLoginAccountName] = useState('');

    // Edge node connection check (client-side Chrome CDP)
    const { data: edgeNodesData } = useQuery({
        queryKey: ['xhs-edge-nodes'],
        queryFn: () => fetchJson('/edge-nodes'),
        staleTime: 10_000,
    });
    const edgeNodes = (edgeNodesData as any)?.nodes || [];
    const hasConnectedClient = edgeNodes.length > 0;

    const { data, isLoading } = useQuery({
        queryKey: ['xhs-accounts'],
        queryFn: () => fetchJson('/xhs/accounts'),
    });

    const addMutation = useMutation({
        mutationFn: (body: any) => fetchJson('/xhs/accounts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['xhs-accounts'] });
            setShowAdd(false);
            setName('');
            setAlias('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/xhs/accounts/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['xhs-accounts'] }),
    });

    const handleDelete = (acc: any) => {
        if (confirm(`确定删除账号「${acc.name}」？`)) {
            deleteMutation.mutate(acc.id);
        }
    };

    const items = (data as any)?.items || [];

    return (
        <div style={{ maxWidth: 900 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                        小红书账号管理
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                        管理已绑定的小红书账号，通过扫码登录完成认证
                    </p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #ff2442, #ff6b81)',
                    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <IconPlus size={16} /> 添加账号
                </button>
            </div>

            {/* Edge Node Connection Status */}
            {hasConnectedClient ? (
                <div style={{
                    padding: '10px 16px', borderRadius: 8, marginBottom: 16,
                    background: '#d1fae5', border: '1px solid #10b981',
                    fontSize: 13, color: '#065f46',
                }}>
                    ✅ 客户端已连接 ({edgeNodes[0]?.node_id}) · Chrome CDP 就绪 · 平台: {edgeNodes[0]?.meta?.platform}
                </div>
            ) : (
                <div style={{
                    padding: '12px 16px', borderRadius: 8, marginBottom: 16,
                    background: '#fef3cd', border: '1px solid #ffc107',
                    fontSize: 13, color: '#856404', lineHeight: 1.6,
                }}>
                    ⚠️ <strong>未检测到客户端连接</strong><br />
                    请启动 Future Staff 客户端（electron-egg）以启用本地 Chrome CDP 功能。
                    <br />
                    <span style={{ fontSize: 12, color: '#a67c00' }}>
                        提示：客户端会自动连接到服务器，无需额外配置。
                    </span>
                </div>
            )}

            {/* Add form */}
            {showAdd && (
                <div style={{
                    background: '#fff', borderRadius: 12, padding: 24,
                    border: '1px solid #e8ecf1', marginBottom: 20,
                }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>添加新账号</h4>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>账号名称 <span style={{ color: '#ef4444' }}>*</span></label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：品牌官方号"
                                style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>别名（可选）</label>
                            <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="如：brand_official"
                                style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setShowAdd(false)} style={btnSecondaryStyle}>取消</button>
                            <button onClick={() => name && addMutation.mutate({ name, alias })} disabled={!name} style={{
                                ...btnPrimaryStyle,
                                background: name ? '#ff2442' : '#ccc',
                                cursor: name ? 'pointer' : 'not-allowed',
                            }}>保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account list */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden' }}>
                {isLoading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                        <div style={{ fontSize: 14, marginBottom: 4 }}>暂无账号</div>
                        <div style={{ fontSize: 12 }}>点击"添加账号"开始管理小红书账号</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e8ecf1', background: '#f8fafc' }}>
                                {['账号名称', '别名', '状态', '最后登录', '操作'].map(h => (
                                    <th key={h} style={{
                                        padding: '12px 16px', textAlign: h === '操作' ? 'right' : 'left',
                                        fontWeight: 600, color: '#64748b',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((acc: any) => (
                                <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{acc.name}</td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{acc.alias || '-'}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <LoginBadge status={acc.status} lastLoginAt={acc.last_login_at} />
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                                        {acc.last_login_at ? new Date(acc.last_login_at).toLocaleString('zh-CN') : '从未登录'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                            <button onClick={() => {
                                                setLoginAccountId(acc.id);
                                                setLoginAccountName(acc.name);
                                            }} style={actionBtnStyle} title="扫码登录">
                                                <IconLogin size={15} />
                                            </button>
                                            <button onClick={() => handleDelete(acc)} style={{ ...actionBtnStyle, color: '#ef4444' }} title="删除">
                                                <IconTrash size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Help text */}
            {items.length > 0 && (
                <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 8,
                    background: '#f0f9ff', border: '1px solid #bae6fd',
                    fontSize: 12, color: '#0369a1', lineHeight: 1.6,
                }}>
                    💡 <strong>提示：</strong>首次添加账号后，请点击「扫码登录」按钮完成认证。
                    Chrome 浏览器需要已开启 CDP 调试模式（端口 9222）。
                </div>
            )}

            {/* QR Code Login Dialog */}
            {loginAccountId && (
                <QRCodeLoginDialog
                    accountId={loginAccountId}
                    accountName={loginAccountName}
                    onClose={() => { setLoginAccountId(null); setLoginAccountName(''); }}
                />
            )}
        </div>
    );
}

/* ─── Shared Styles ─── */
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' };
const btnPrimaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600 };
const btnSecondaryStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 };
const actionBtnStyle: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 4, border: 'none',
    background: 'transparent', color: '#64748b', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
};
