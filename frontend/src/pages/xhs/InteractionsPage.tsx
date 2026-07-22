/**
 * XHS Interactions — Comment management and note interactions.
 * Browse notes, view details, post comments, like/bookmark.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../services/api';
import {
    IconSearch, IconHeart, IconBookmark, IconMessage, IconExternalLink, IconRefresh,
} from '@tabler/icons-react';

/* ─── Note Detail Panel ─── */
function NoteDetailPanel({ noteId, xsecToken, onClose }: {
    noteId: string; xsecToken?: string; onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [comment, setComment] = useState('');

    const { data: detail, isLoading } = useQuery({
        queryKey: ['xhs-note-detail', noteId],
        queryFn: () => {
            const params = new URLSearchParams();
            if (xsecToken) params.set('xsec_token', xsecToken);
            return fetchJson(`/xhs/notes/${noteId}?${params.toString()}`);
        },
    });

    const d = detail as any || {};

    const likeMutation = useMutation({
        mutationFn: () => fetchJson(`/xhs/notes/${noteId}/like${xsecToken ? `?xsec_token=${xsecToken}` : ''}`, { method: 'POST' }),
    });

    const bookmarkMutation = useMutation({
        mutationFn: () => fetchJson(`/xhs/notes/${noteId}/bookmark${xsecToken ? `?xsec_token=${xsecToken}` : ''}`, { method: 'POST' }),
    });

    const commentMutation = useMutation({
        mutationFn: (content: string) => fetchJson(`/xhs/notes/${noteId}/comment`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, xsec_token: xsecToken }),
        }),
        onSuccess: () => { setComment(''); queryClient.invalidateQueries({ queryKey: ['xhs-note-detail', noteId]); },
    });

    return (
        <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
            background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ecf1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.title || '笔记详情'}
                </h3>
                <button onClick={onClose} style={{
                    padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0',
                    background: '#fff', cursor: 'pointer', fontSize: 12,
                }}>关闭</button>
            </div>

            {isLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>加载中...</div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {/* Note info */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>{d.title}</div>
                        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                            {d.desc || d.content || '无内容'}
                        </div>
                    </div>

                    {/* Images */}
                    {d.note_image_list && d.note_image_list.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {d.note_image_list.map((img: any, i: number) => (
                                <div key={i} style={{
                                    width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
                                    background: '#f1f5f9',
                                }}>
                                    <img src={img.url || img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: '#64748b' }}>
                        <span>👍 {d.liked_count || d.interact_info?.liked_count || 0}</span>
                        <span>💬 {d.comment_count || d.interact_info?.comment_count || 0}</span>
                        <span>⭐ {d.collected_count || d.interact_info?.collected_count || 0}</span>
                        <span>↗️ {d.share_count || d.interact_info?.share_count || 0}</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                        <button onClick={() => likeMutation.mutate()} style={actionBtnStyle} disabled={likeMutation.isPending}>
                            <IconHeart size={16} /> {likeMutation.isPending ? '...' : '点赞'}
                        </button>
                        <button onClick={() => bookmarkMutation.mutate()} style={actionBtnStyle} disabled={bookmarkMutation.isPending}>
                            <IconBookmark size={16} /> {bookmarkMutation.isPending ? '...' : '收藏'}
                        </button>
                    </div>

                    {/* Comment section */}
                    <div style={{ borderTop: '1px solid #e8ecf1', paddingTop: 16 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>评论区</h4>

                        {/* Comments list */}
                        {(d.comments || []).map((c: any, i: number) => (
                            <div key={i} style={{
                                padding: '10px 12px', borderRadius: 8, background: '#f8fafc',
                                marginBottom: 8,
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', marginBottom: 4 }}>
                                    {c.user_nickname || '匿名用户'}
                                </div>
                                <div style={{ fontSize: 13, color: '#334155' }}>{c.content}</div>
                            </div>
                        ))}

                        {/* Post comment */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <input
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && comment && commentMutation.mutate(comment)}
                                placeholder="输入评论..."
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}
                            />
                            <button onClick={() => comment && commentMutation.mutate(comment)} disabled={!comment || commentMutation.isPending} style={{
                                padding: '8px 14px', borderRadius: 6, border: 'none',
                                background: comment ? '#ff2442' : '#ccc', color: '#fff',
                                cursor: comment ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500,
                            }}>
                                {commentMutation.isPending ? '...' : '发送'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main ─── */
export default function InteractionsPage() {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [activeToken, setActiveToken] = useState<string | undefined>();

    const { data: searchData, isLoading: searchLoading } = useQuery({
        queryKey: ['xhs-search', keyword],
        queryFn: () => fetchJson(`/xhs/search?keyword=${encodeURIComponent(keyword)}`),
        enabled: !!keyword,
        staleTime: 60_000,
    });

    const feeds = ((searchData as any)?.feeds || []) as any[];

    const handleSearch = () => {
        if (searchInput.trim()) setKeyword(searchInput.trim());
    };

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Search bar */}
            <div style={{
                background: '#fff', borderRadius: 12, padding: 16,
                border: '1px solid #e8ecf1', marginBottom: 20,
            }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <IconSearch size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="搜索小红书笔记关键词..."
                            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                        />
                    </div>
                    <button onClick={handleSearch} style={{
                        padding: '8px 18px', borderRadius: 8, border: 'none',
                        background: '#ff2442', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <IconSearch size={14} /> 搜索
                    </button>
                </div>
            </div>

            {/* Search results */}
            {keyword && (
                <div style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', overflow: 'hidden',
                }}>
                    <div style={{
                        padding: '14px 20px', borderBottom: '1px solid #e8ecf1',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                            搜索结果：{keyword}
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>
                                {feeds.length} 条
                            </span>
                        </h3>
                        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['xhs-search', keyword] })} style={{
                            padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0',
                            background: '#fff', cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <IconRefresh size={12} /> 刷新
                        </button>
                    </div>

                    {searchLoading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>搜索中...</div>
                    ) : feeds.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                            <div>未找到相关笔记</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, padding: 16 }}>
                            {feeds.map((feed: any, i: number) => (
                                <div key={i} style={{
                                    border: '1px solid #e8ecf1', borderRadius: 10, overflow: 'hidden',
                                    cursor: 'pointer', transition: 'box-shadow 0.2s',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                                    onClick={() => { setActiveNoteId(feed.note_id || feed.id); setActiveToken(feed.xsec_token); }}
                                >
                                    {/* Cover */}
                                    <div style={{
                                        height: 140, background: '#f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden',
                                    }}>
                                        {feed.cover ? (
                                            <img src={feed.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: 32 }}>📝</span>
                                        )}
                                    </div>
                                    <div style={{ padding: 12 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.4, maxHeight: 40, overflow: 'hidden' }}>
                                            {feed.title || feed.display_title || '无标题'}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 10 }}>
                                            <span>👍 {feed.liked_count || 0}</span>
                                            <span>💬 {feed.comment_count || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty state when no search */}
            {!keyword && (
                <div style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', padding: 60, textAlign: 'center', color: '#94a3b8',
                }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>搜索并互动小红书笔记</div>
                    <div style={{ fontSize: 12 }}>输入关键词搜索笔记，查看评论并互动</div>
                </div>
            )}

            {/* Note detail side panel */}
            {activeNoteId && (
                <NoteDetailPanel
                    noteId={activeNoteId}
                    xsecToken={activeToken}
                    onClose={() => { setActiveNoteId(null); setActiveToken(undefined); }}
                />
            )}
        </div>
    );
}

const actionBtnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0',
    background: '#fff', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 4, color: '#64748b',
};
