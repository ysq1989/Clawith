/**
 * BOM — Bill of Materials management with split-panel layout:
 * product list on the left, BOM table for the selected product on the right.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { fetchJson } from '../../services/api';
import { useDialog } from '../../components/Dialog/DialogProvider';

/* ─── Types ─── */
interface Product {
    id: string;
    name: string;
    sku: string;
    unit?: string;
}

interface BomItem {
    id: string;
    product_id: string;
    material_id: string;
    material_name: string;
    quantity: number;
    unit: string;
}

interface BomResponse {
    items: BomItem[];
    total: number;
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
        queryKey: ['bom-searchable-select', apiPath, search, page],
        queryFn: () => fetchJson<any>(`${apiPath}?search=${encodeURIComponent(search)}&page=${page}&page_size=10`),
        enabled: open,
    });

    const items = Array.isArray(data) ? data : (data?.items ?? []);
    const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / (Array.isArray(data) ? data.length : (data?.page_size ?? 10))));
    const selectedItem = items.find((i: any) => i.id === value);
    const displayLabel = selectedItem ? selectedItem.name : '';

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

/* ─── BOM Form (Add / Edit) ─── */
function BomForm({
    productId, bomItem, onClose, isChinese,
}: {
    productId: string;
    bomItem?: BomItem;
    onClose: (saved: boolean) => void;
    isChinese: boolean;
}) {
    const queryClient = useQueryClient();
    const [materialId, setMaterialId] = useState(bomItem?.material_id ?? '');
    const [materialName, setMaterialName] = useState(bomItem?.material_name ?? '');
    const [quantity, setQuantity] = useState(String(bomItem?.quantity ?? ''));
    const [unit, setUnit] = useState(bomItem?.unit ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!materialId) { setError(isChinese ? '请选择物料' : 'Please select a material'); return; }
        if (!quantity || parseFloat(quantity) <= 0) { setError(isChinese ? '请输入有效数量' : 'Please enter a valid quantity'); return; }
        setSaving(true); setError('');
        try {
            const body = {
                product_id: productId,
                material_id: materialId,
                material_name: materialName,
                quantity: parseFloat(quantity),
                unit,
            };
            if (bomItem) {
                await fetchJson(`/erp/boms/${bomItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
            } else {
                await fetchJson('/erp/boms', { method: 'POST', body: JSON.stringify(body) });
            }
            queryClient.invalidateQueries({ queryKey: ['erp-boms', productId] });
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
                    {bomItem ? (isChinese ? '编辑 BOM 行' : 'Edit BOM Line') : (isChinese ? '新增 BOM 行' : 'Add BOM Line')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {isChinese ? '物料 *' : 'Material *'}
                        </label>
                        {bomItem ? (
                            <input
                                value={materialName}
                                disabled
                                style={{ ...inputStyle, width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                            />
                        ) : (
                            <SearchableSelect
                                value={materialId}
                                onChange={(id, item) => {
                                    setMaterialId(id);
                                    setMaterialName(item.name ?? '');
                                    if (item.unit && !unit) setUnit(item.unit);
                                }}
                                placeholder={isChinese ? '-- 搜索选择物料 --' : '-- Search Material --'}
                                apiPath="/erp/products"
                                isChinese={isChinese}
                            />
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {isChinese ? '数量 *' : 'Quantity *'}
                            </label>
                            <input type="number" min={0} step={0.01} value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {isChinese ? '单位' : 'Unit'}
                            </label>
                            <input value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
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
export default function BOM() {
    const { t, i18n } = useTranslation();
    const isChinese = i18n.language?.startsWith('zh');
    const queryClient = useQueryClient();
    const dialog = useDialog();

    const [search, setSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBom, setEditingBom] = useState<BomItem | undefined>(undefined);

    /* Product list */
    const { data: productData, isLoading: productsLoading } = useQuery({
        queryKey: ['erp-products-bom', search],
        queryFn: () => fetchJson<any>(`/erp/products?search=${encodeURIComponent(search)}&page=1&page_size=100`),
    });

    const products: Product[] = Array.isArray(productData) ? productData : (productData?.items ?? []);

    /* BOM items for selected product */
    const { data: bomData, isLoading: bomLoading } = useQuery({
        queryKey: ['erp-boms', selectedProduct?.id],
        queryFn: () => fetchJson<BomResponse>(`/erp/boms?product_id=${selectedProduct!.id}`),
        enabled: !!selectedProduct,
    });

    const bomItems: BomItem[] = selectedProduct
        ? (Array.isArray(bomData) ? bomData : (bomData?.items ?? []))
        : [];

    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchJson(`/erp/boms/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            if (selectedProduct) {
                queryClient.invalidateQueries({ queryKey: ['erp-boms', selectedProduct.id] });
            }
        },
    });

    const handleDelete = async (id: string) => {
        const ok = await dialog.confirm(
            isChinese ? '确定删除此 BOM 行？' : 'Are you sure you want to delete this BOM line?',
            { title: isChinese ? '删除 BOM' : 'Delete BOM', danger: true, confirmLabel: isChinese ? '删除' : 'Delete' },
        );
        if (ok) deleteMutation.mutate(id);
    };

    return (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)', minHeight: 400 }}>
            {/* ── Left Panel: Product List ── */}
            <div style={{
                width: 300, flexShrink: 0,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
                <div style={{ padding: '12px 12px 0' }}>
                    <div style={{ position: 'relative' }}>
                        <IconSearch size={16} stroke={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('erp.bom.searchProduct', '搜索产品...')}
                            style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                        />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0 4px' }}>
                        {t('erp.bom.selectProduct', '选择产品查看其 BOM')}
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {productsLoading ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                            {t('erp.loading', '加载中...')}
                        </div>
                    ) : products.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                            {t('erp.noData', '暂无数据')}
                        </div>
                    ) : products.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            style={{
                                padding: '10px 12px', cursor: 'pointer',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: selectedProduct?.id === p.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                                borderLeft: selectedProduct?.id === p.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (selectedProduct?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selectedProduct?.id === p.id ? 'rgba(59,130,246,0.1)' : 'transparent'; }}
                        >
                            <div style={{ fontSize: 13, fontWeight: selectedProduct?.id === p.id ? 600 : 400, color: 'var(--text-primary)' }}>
                                {p.name}
                            </div>
                            {p.sku && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>SKU: {p.sku}</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right Panel: BOM Table ── */}
            <div style={{
                flex: 1,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
                {selectedProduct ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {selectedProduct.name}
                                </span>
                                {selectedProduct.sku && (
                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                                        SKU: {selectedProduct.sku}
                                    </span>
                                )}
                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                                    - {isChinese ? '物料清单' : 'Bill of Materials'}
                                </span>
                            </div>
                            <button
                                style={btnPrimary}
                                onClick={() => { setEditingBom(undefined); setShowForm(true); }}
                            >
                                <IconPlus size={16} stroke={2} />
                                {t('erp.bom.addLine', '新增 BOM 行')}
                            </button>
                        </div>

                        {/* Table */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th style={thStyle}>{t('erp.bom.materialName', '物料名称')}</th>
                                        <th style={thStyle}>{t('erp.bom.quantity', '数量')}</th>
                                        <th style={thStyle}>{t('erp.bom.unit', '单位')}</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>{t('erp.actions', '操作')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bomLoading ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.loading', '加载中...')}</td></tr>
                                    ) : bomItems.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{t('erp.bom.noBomData', '暂无 BOM 数据，点击右上角新增')}</td></tr>
                                    ) : bomItems.map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={tdStyle}>{item.material_name}</td>
                                            <td style={tdStyle}>{item.quantity}</td>
                                            <td style={tdStyle}>{item.unit}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => { setEditingBom(item); setShowForm(true); }}
                                                        style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                                        title={isChinese ? '编辑' : 'Edit'}
                                                    >
                                                        <IconEdit size={14} stroke={1.5} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                                                        title={isChinese ? '删除' : 'Delete'}
                                                    >
                                                        <IconTrash size={14} stroke={1.5} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                        {t('erp.bom.pleaseSelectProduct', '请从左侧选择一个产品以查看其 BOM')}
                    </div>
                )}
            </div>

            {/* ── Dialogs ── */}
            {showForm && selectedProduct && (
                <BomForm
                    productId={selectedProduct.id}
                    bomItem={editingBom}
                    isChinese={isChinese}
                    onClose={() => { setShowForm(false); setEditingBom(undefined); }}
                />
            )}
        </div>
    );
}
