'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { RefreshCw, Undo2, X, Search, Loader2 } from 'lucide-react';

const STATUS_LABELS = {
  created: '待支付',
  paying: '支付中',
  crediting: '入账中',
  paid: '已支付',
  closed: '已关闭',
  failed: '失败',
  refunding: '退款中',
  partial_refunded: '部分退款',
  refunded: '已退款',
};

const STATUS_COLORS = {
  paid: { background: '#d1fae5', color: '#059669' },
  crediting: { background: '#fef3c7', color: '#b45309' },
  paying: { background: '#e0e7ff', color: '#4f46e5' },
  created: { background: '#e0e7ff', color: '#4f46e5' },
  refunding: { background: '#fef3c7', color: '#b45309' },
  partial_refunded: { background: '#ffedd5', color: '#c2410c' },
  refunded: { background: '#fee2e2', color: '#ef4444' },
  closed: { background: '#f1f5f9', color: '#64748b' },
  failed: { background: '#fee2e2', color: '#ef4444' },
};

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.closed;
  return <span style={{ padding: '4px 9px', borderRadius: '5px', fontSize: '0.78rem', fontWeight: 600, ...style }}>{STATUS_LABELS[status] || status}</span>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ paidOrders: 0, grossYuan: 0, refundedYuan: 0, netYuan: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ status: 'all', purpose: 'all', keyword: '' });
  const [keywordDraft, setKeywordDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [refundDialog, setRefundDialog] = useState({ open: false, order: null, amountStr: '', reason: '' });

  const fetchOrders = useCallback(async (page = 1, next = filters) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '20', status: next.status, purpose: next.purpose, ...(next.keyword ? { keyword: next.keyword } : {}) });
      const response = await fetch(`/api/admin/orders?${query}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || '加载失败');
      setOrders(data.orders);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchOrders(1), 0);
    return () => window.clearTimeout(timer);
  }, [fetchOrders]);

  const applyFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    void fetchOrders(1, next);
  };

  const handleSync = async (order) => {
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/sync`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || '同步失败');
      toast.success('已与微信侧对齐');
      await fetchOrders(pagination.page);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const openRefund = (order) => {
    setRefundDialog({ open: true, order, amountStr: order.refundableYuan.toFixed(2), reason: '' });
  };

  const submitRefund = async () => {
    const { order, amountStr, reason } = refundDialog;
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('请输入正确的退款金额');
    if (amount > order.refundableYuan) return toast.error(`最多可退 ¥${order.refundableYuan.toFixed(2)}`);
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountYuan: amount, reason }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || '退款失败');
      toast.success(data.message);
      setRefundDialog({ open: false, order: null, amountStr: '', reason: '' });
      await fetchOrders(pagination.page);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '6px' }}>订单管理</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '22px' }}>充值与订阅订单、退款处理，以及与微信侧的人工对账。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {[
          { label: '已支付订单', value: summary.paidOrders.toLocaleString('zh-CN') },
          { label: '支付总额', value: `¥${summary.grossYuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` },
          { label: '退款总额', value: `¥${summary.refundedYuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, tone: '#ef4444' },
          { label: '净收入', value: `¥${summary.netYuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, tone: '#059669' },
        ].map((card) => (
          <div key={card.label} className="glass-card" style={{ padding: '18px', background: 'white' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.tone || 'var(--text-main)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        <select className="input-base" style={{ width: 'auto', padding: '9px 12px' }} value={filters.status} onChange={(event) => applyFilter({ status: event.target.value })}>
          <option value="all">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input-base" style={{ width: 'auto', padding: '9px 12px' }} value={filters.purpose} onChange={(event) => applyFilter({ purpose: event.target.value })}>
          <option value="all">全部类型</option>
          <option value="recharge">充值</option>
          <option value="subscription">订阅</option>
        </select>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            className="input-base"
            style={{ width: '280px', padding: '9px 12px' }}
            placeholder="商户单号 / 微信交易号"
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') applyFilter({ keyword: keywordDraft.trim() }); }}
          />
          <button type="button" className="btn btn-outline" style={{ padding: '9px 14px' }} onClick={() => applyFilter({ keyword: keywordDraft.trim() })}><Search size={16} /></button>
        </div>
        <button type="button" className="btn btn-outline" style={{ padding: '9px 14px', marginLeft: 'auto' }} disabled={loading} onClick={() => void fetchOrders(pagination.page)}>
          {loading ? <Loader2 size={16} className="spin-anim" /> : <RefreshCw size={16} />} 刷新
        </button>
      </div>

      <div className="glass-card" style={{ background: 'white', padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--background)' }}>
                {['订单', '用户', '类型', '金额', '状态', '时间', '操作'].map((header) => (
                  <th key={header} style={{ padding: '12px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && orders.length === 0 && (
                <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>没有符合条件的订单</td></tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', fontWeight: 600 }}>{order.outTradeNo}</div>
                    {order.providerTransactionId && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '3px' }}>微信 {order.providerTransactionId}</div>}
                    {order.errorMessage && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '3px' }}>{order.errorMessage}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                    <div>{order.user?.email || '—'}</div>
                    {order.user && <span className={`badge badge-${order.user.membershipLevel?.toLowerCase() || 'free'}`}>{order.user.membershipLevel}</span>}
                  </td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                    {order.purpose === 'subscription'
                      ? <div><div style={{ fontWeight: 600 }}>订阅</div><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{order.planId} · {order.periodMonths} 个月</div></div>
                      : <div style={{ fontWeight: 600 }}>充值</div>}
                  </td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700 }}>¥{order.amountYuan.toFixed(2)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '3px' }}>{order.credits.toLocaleString('zh-CN')} Credits</div>
                    {order.refundedYuan > 0 && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '3px' }}>已退 ¥{order.refundedYuan.toFixed(2)}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                    <StatusBadge status={order.status} />
                    {order.refunds.length > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {order.refunds.map((refund) => <div key={refund.outRefundNo}>退款 ¥{(refund.refundFen / 100).toFixed(2)} · {refund.status}</div>)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    <div>{new Date(order.createdAt).toLocaleString('zh-CN')}</div>
                    {order.paidAt && <div style={{ color: '#059669', fontSize: '0.72rem', marginTop: '3px' }}>支付于 {new Date(order.paidAt).toLocaleString('zh-CN')}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '0.8rem' }} disabled={busyId === order.id} onClick={() => void handleSync(order)} title="以微信侧状态为准同步本地订单">
                        {busyId === order.id ? <Loader2 size={14} className="spin-anim" /> : <RefreshCw size={14} />} 对账
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', color: order.refundableYuan > 0 ? '#ef4444' : undefined }}
                        disabled={busyId === order.id || order.refundableYuan <= 0 || !['paid', 'partial_refunded'].includes(order.status)}
                        onClick={() => openRefund(order)}
                      >
                        <Undo2 size={14} /> 退款
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>共 {pagination.total.toLocaleString('zh-CN')} 条</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-outline" style={{ padding: '7px 12px' }} disabled={loading || pagination.page <= 1} onClick={() => void fetchOrders(pagination.page - 1)}>上一页</button>
            <span style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{pagination.page} / {pagination.totalPages}</span>
            <button type="button" className="btn btn-outline" style={{ padding: '7px 12px' }} disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void fetchOrders(pagination.page + 1)}>下一页</button>
          </div>
        </div>
      </div>

      {refundDialog.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }} onClick={() => setRefundDialog({ open: false, order: null, amountStr: '', reason: '' })} />
          <div style={{ position: 'relative', zIndex: 1, width: '440px', maxWidth: '100%', background: 'white', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>发起退款</h2>
              <button type="button" onClick={() => setRefundDialog({ open: false, order: null, amountStr: '', reason: '' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gap: '16px' }}>
              <div style={{ background: 'var(--background)', padding: '14px', borderRadius: '10px', fontSize: '0.85rem', lineHeight: 1.8 }}>
                <div>订单号：<code>{refundDialog.order?.outTradeNo}</code></div>
                <div>用户：{refundDialog.order?.user?.email}</div>
                <div>可退金额：<b>¥{refundDialog.order?.refundableYuan.toFixed(2)}</b></div>
                {refundDialog.order?.purpose === 'subscription' && <div style={{ color: '#c2410c' }}>⚠ 全额退款将同时撤销该用户的会员权益</div>}
              </div>
              <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                退款金额（元）
                <input className="input-base" type="number" min="0.01" step="0.01" max={refundDialog.order?.refundableYuan} value={refundDialog.amountStr} onChange={(event) => setRefundDialog((prev) => ({ ...prev, amountStr: event.target.value }))} />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                退款原因（会同步给微信）
                <input className="input-base" value={refundDialog.reason} onChange={(event) => setRefundDialog((prev) => ({ ...prev, reason: event.target.value }))} placeholder="用户申请退款" />
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                退款成功后会按比例扣回已发放的 Credits。若用户已消费，余额会被扣成负数，需补足后才能继续使用。
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setRefundDialog({ open: false, order: null, amountStr: '', reason: '' })}>取消</button>
                <button type="button" className="btn btn-primary" disabled={busyId === refundDialog.order?.id} onClick={() => void submitRefund()}>
                  {busyId === refundDialog.order?.id ? <><Loader2 size={15} className="spin-anim" /> 提交中…</> : '确认退款'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
