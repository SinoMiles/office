'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CircleDollarSign, CreditCard, ListChecks, RefreshCw, TrendingUp, UserPlus, Users } from 'lucide-react';

const statusText = { created: '待支付', paying: '支付中', crediting: '入账中', paid: '已支付', closed: '已关闭', failed: '失败' };
const statusColor = { paid: '#059669', failed: '#dc2626', closed: '#64748b', created: '#d97706', paying: '#2563eb', crediting: '#7c3aed' };

function number(value, digits = 0) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function dateTime(value) {
  return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '—';
}

function StatCard({ icon: Icon, label, value, note, color, growth }) {
  return <div className="premium-stat-card" style={{ padding: '22px', minHeight: '130px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <div><div style={{ color: 'var(--text-muted)', fontSize: '.84rem', marginBottom: '10px' }}>{label}</div><div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{value}</div></div>
      <span style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', borderRadius: '13px', background: `${color}18`, color }}><Icon size={21} /></span>
    </div>
    <div style={{ marginTop: '10px', color: growth == null ? 'var(--text-muted)' : growth >= 0 ? '#059669' : '#dc2626', fontSize: '.78rem' }}>{growth != null ? `${growth >= 0 ? '↑' : '↓'} ${Math.abs(growth)}%　` : ''}{note}</div>
  </div>;
}

function TrendChart({ daily }) {
  const width = 900;
  const height = 230;
  const padding = 24;
  const max = Math.max(1, ...daily.flatMap((row) => [row.activeUsers, row.users]));
  const points = (key) => daily.map((row, index) => `${padding + index * ((width - padding * 2) / Math.max(1, daily.length - 1))},${height - padding - (row[key] / max) * (height - padding * 2)}`).join(' ');
  return <div style={{ overflowX: 'auto' }}>
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '620px', height: '230px', display: 'block' }} role="img" aria-label="新增用户和日活趋势">
      {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={padding} y1={padding + ratio * (height - padding * 2)} x2={width - padding} y2={padding + ratio * (height - padding * 2)} stroke="#e8edf3" />)}
      <polyline points={points('activeUsers')} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points('users')} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {daily.map((row, index) => <g key={row.date}><circle cx={padding + index * ((width - padding * 2) / Math.max(1, daily.length - 1))} cy={height - padding - (row.activeUsers / max) * (height - padding * 2)} r="3" fill="#10b981"><title>{row.date} 日活 {row.activeUsers}，新增 {row.users}</title></circle></g>)}
    </svg>
  </div>;
}

function RevenueBars({ daily }) {
  const values = daily.map((row) => row.revenue);
  const max = Math.max(1, ...values);
  return <div style={{ height: '230px', display: 'flex', alignItems: 'end', gap: daily.length > 30 ? '2px' : '6px', paddingTop: '20px' }}>
    {daily.map((row) => <div key={row.date} title={`${row.date}　¥${number(row.revenue, 2)}`} style={{ flex: 1, minWidth: '3px', height: `${Math.max(2, (row.revenue / max) * 100)}%`, borderRadius: '4px 4px 1px 1px', background: row.revenue ? 'linear-gradient(180deg,#34d399,#10b981)' : '#e8edf3' }} />)}
  </div>;
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('统计数据加载失败');
      setData(await response.json());
    } finally { setLoading(false); }
  }, [days]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/analytics?days=${days}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('统计数据加载失败');
        return response.json();
      })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch(() => { if (!cancelled) setData({ summary: {}, daily: [], payments: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);
  const summary = data?.summary || {};
  const paidCount = useMemo(() => data?.payments?.filter((item) => item.status === 'paid').length || 0, [data]);

  return <div style={{ animation: 'fadeIn .35s ease-out' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '20px', marginBottom: '26px' }}>
      <div><h1 style={{ fontSize: '2rem', marginBottom: '7px', fontWeight: 800 }}>数据统计</h1><p style={{ color: 'var(--text-muted)' }}>收入、用户增长、活跃度与业务运行概况</p></div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{[7, 30, 90].map((item) => <button key={item} onClick={() => { setLoading(true); setDays(item); }} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '9px', background: days === item ? 'var(--primary)' : 'white', color: days === item ? 'white' : 'var(--text-main)', cursor: 'pointer' }}>{item} 天</button>)}<button onClick={load} aria-label="刷新" style={{ width: '36px', height: '36px', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: '9px', background: 'white', cursor: 'pointer' }}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button></div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(205px,1fr))', gap: '16px', marginBottom: '20px', opacity: loading ? .65 : 1 }}>
      <StatCard icon={CircleDollarSign} label={`近 ${days} 天收入`} value={`¥${number(summary.periodRevenue, 2)}`} note={`今日 ¥${number(summary.todayRevenue, 2)}`} growth={summary.revenueGrowth} color="#10b981" />
      <StatCard icon={UserPlus} label={`近 ${days} 天新增用户`} value={number(summary.newUsers)} note={`累计 ${number(summary.totalUsers)} 人`} growth={summary.userGrowth} color="#6366f1" />
      <StatCard icon={Activity} label="今日活跃用户（DAU）" value={number(summary.dauUsers)} note={`近 7 天活跃 ${number(summary.wauUsers)} 人`} color="#f59e0b" />
      <StatCard icon={ListChecks} label={`近 ${days} 天任务`} value={number(summary.periodTasks)} note={`完成率 ${number(summary.completionRate, 1)}%`} growth={summary.taskGrowth} color="#0ea5e9" />
      <StatCard icon={Users} label="累计付费用户" value={number(summary.totalPayingUsers)} note={`累计用户 ${number(summary.totalUsers)}`} color="#8b5cf6" />
      <StatCard icon={TrendingUp} label="累计收入" value={`¥${number(summary.totalRevenue, 2)}`} note={`累计任务 ${number(summary.totalTasks)}`} color="#ef4444" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,.8fr)', gap: '18px', marginBottom: '20px' }}>
      <section className="premium-stat-card" style={{ padding: '24px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 style={{ fontSize: '1.05rem' }}>用户增长与活跃趋势</h2><div style={{ display: 'flex', gap: '14px', fontSize: '.76rem', color: 'var(--text-muted)' }}><span>● <b style={{ color: '#10b981' }}>日活</b></span><span>● <b style={{ color: '#6366f1' }}>新增</b></span></div></div><TrendChart daily={data?.daily || []} /></section>
      <section className="premium-stat-card" style={{ padding: '24px' }}><h2 style={{ fontSize: '1.05rem' }}>每日收入</h2><RevenueBars daily={data?.daily || []} /></section>
    </div>

    <section className="premium-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 22px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}><div><h2 style={{ fontSize: '1.08rem', marginBottom: '4px' }}>充值流水</h2><span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>最近 30 笔订单，其中 {paidCount} 笔支付成功</span></div><CreditCard color="var(--primary)" size={22} /></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px', fontSize: '.84rem' }}><thead><tr style={{ background: 'var(--background)', textAlign: 'left' }}>{['创建时间','用户','订单号','金额','Credits','状态','支付时间'].map((title) => <th key={title} style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>{title}</th>)}</tr></thead><tbody>{(data?.payments || []).map((order) => <tr key={order.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '13px 16px' }}>{dateTime(order.createdAt)}</td><td style={{ padding: '13px 16px', fontWeight: 600 }}>{order.email}</td><td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{order.outTradeNo}</td><td style={{ padding: '13px 16px', fontWeight: 700 }}>¥{number(order.amount, 2)}</td><td style={{ padding: '13px 16px' }}>{number(order.credits, 2)}</td><td style={{ padding: '13px 16px' }}><span style={{ color: statusColor[order.status], background: `${statusColor[order.status]}14`, padding: '4px 8px', borderRadius: '8px' }}>{statusText[order.status] || order.status}</span></td><td style={{ padding: '13px 16px' }}>{dateTime(order.paidAt)}</td></tr>)}</tbody></table>{!loading && !data?.payments?.length && <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>暂无充值订单</div>}</div>
    </section>
  </div>;
}
