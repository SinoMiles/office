'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Check, Copy, Gift, Link2, Users } from 'lucide-react';

// 账单页底部的邀请入口。数据自己拉，不挂在账单接口上 ——
// 账单会翻页，邀请数据不会，绑在一起只会让每次翻页都多查一遍。
export default function ReferralCard({ locale = 'zh-CN' }) {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/user/referral', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (active && payload?.success) setData(payload); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!data?.enabled) return null;

  const link = `${window.location.origin}/register?invite=${data.code}`;
  const copy = async (value, kind) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === 'code' ? '邀请码已复制' : '邀请链接已复制');
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      toast.error('复制失败，请手动选择后复制');
    }
  };

  const stat = (label, value, tone) => (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.1, color: tone || 'var(--text-main)' }}>{value}</div>
    </div>
  );

  return (
    <div className="glass-card" style={{ marginTop: '14px', background: 'white', padding: '16px 18px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <span style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', borderRadius: '9px', background: 'var(--primary-light)', color: 'var(--primary)' }}><Gift size={16} /></span>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>邀请好友得 Credits</h2>
      </div>
      <p style={{ margin: '0 0 14px 40px', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.65 }}>
        好友通过你的链接注册并<b>绑定手机号</b>后，你获得 <b style={{ color: 'var(--primary)' }}>{data.inviterCredits.toLocaleString(locale)}</b> Credits，
        对方额外获得 <b style={{ color: 'var(--primary)' }}>{data.inviteeCredits.toLocaleString(locale)}</b> Credits。
        {data.maxRewardedInvites > 0 ? ` 每个账号最多可获奖励 ${data.maxRewardedInvites} 次。` : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: '12px', alignItems: 'stretch' }}>
        <div style={{ padding: '12px 14px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--background)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '5px' }}>我的邀请码</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <code style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '2px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{data.code}</code>
            <button type="button" onClick={() => void copy(data.code, 'code')} title="复制邀请码" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer', color: copied === 'code' ? 'var(--primary)' : 'var(--text-muted)' }}>
              {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '5px' }}>邀请链接</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem', color: 'var(--text-main)' }}>{link}</span>
            <button type="button" className="btn btn-outline" onClick={() => void copy(link, 'link')} style={{ flexShrink: 0, padding: '6px 11px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
              {copied === 'link' ? <Check size={14} /> : <Link2 size={14} />} 复制
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px' }}>
        {stat('已邀请', data.invitedCount.toLocaleString(locale))}
        {stat('已到账奖励', `${data.earnedCredits.toLocaleString(locale)} Credits`, 'var(--primary)')}
        {/* 「待绑定」必须单独列出来：不然邀请人只会看到人数涨了、额度没动，以为坏了 */}
        {stat('待对方绑定手机号', data.pendingCount.toLocaleString(locale), data.pendingCount ? '#d97706' : undefined)}
      </div>

      {data.invitees.length > 0 && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} /> 查看邀请记录
          </summary>
          <div style={{ marginTop: '10px', display: 'grid', gap: '7px', maxHeight: '190px', overflowY: 'auto' }}>
            {data.invitees.map((item) => (
              <div key={`${item.email}-${item.joinedAt}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 11px', borderRadius: '9px', background: 'var(--background)', fontSize: '0.82rem' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                <span style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(item.joinedAt).toLocaleDateString(locale)}</span>
                <span style={{ flexShrink: 0, padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: item.rewarded ? '#d1fae5' : '#fef3c7', color: item.rewarded ? '#059669' : '#b45309' }}>
                  {item.rewarded ? '奖励已到账' : '待绑定手机号'}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
