'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const TABS = [
  ['llm', '大模型接口'],
  ['wechat', '微信登录'],
  ['billing', '计费策略'],
  ['wechatPay', '微信支付'],
  ['recharge', '充值码'],
];

const headingStyle = { fontSize: '1.3rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 };
const labelStyle = { display: 'grid', gap: '7px', fontWeight: 500 };
const billingGroupStyle = { padding: '20px', border: '1px solid var(--border)', borderRadius: '14px', background: '#fff' };
const billingGroupTitleStyle = { fontSize: '1rem', margin: 0, color: 'var(--text-main)', fontWeight: 700 };
const billingGroupDescriptionStyle = { margin: '5px 0 16px', color: 'var(--text-muted)', fontSize: '.82rem', lineHeight: 1.6 };

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('llm');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(10000);
  const [rechargeValidDays, setRechargeValidDays] = useState(365);
  const [generatedRechargeCode, setGeneratedRechargeCode] = useState('');
  const [wechatPayStatus, setWechatPayStatus] = useState({ configured: false, missing: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || '读取设置失败');
        setWechatPayStatus(data.wechatPay || { configured: false, missing: [] });
        const storedBilling = data.settings.find((item) => item.key === 'billing')?.value || {};
        setSettings({
          billing: {
            creditsPerCny: storedBilling.creditsPerCny ?? 100,
            reservationInputTokens: storedBilling.reservationInputTokens ?? 16000,
            reservationOutputTokens: storedBilling.reservationOutputTokens ?? 8192,
            discountRates: { FREE: 1, PRO: 0.8, ENTERPRISE: 0.5, ...storedBilling.discountRates },
            models: {
              ...storedBilling.models,
              'deepseek-v4-flash': { inputCreditsPer1K: 2, outputCreditsPer1K: 8, cachedInputCreditsPer1K: 0.5, ...storedBilling.models?.['deepseek-v4-flash'] },
            },
          },
          llm: data.settings.find((item) => item.key === 'llm')?.value || { apiKey: '', model: 'deepseek-v4-flash' },
          wechat: data.settings.find((item) => item.key === 'wechat')?.value || { appId: '', appSecret: '' },
        });
      } catch (error) {
        toast.error(error.message || '读取设置失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function saveSetting(key) {
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key, value: settings[key] }]),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '保存失败');
      toast.success(`${TABS.find(([tab]) => tab === key)?.[1] || '设置'}已保存`);
    } catch (error) {
      toast.error(error.message || '保存失败');
    } finally {
      setSavingKey('');
    }
  }

  async function generateRechargeCode() {
    try {
      const response = await fetch('/api/admin/billing/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: rechargeAmount, validDays: rechargeValidDays }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '充值码生成失败');
      setGeneratedRechargeCode(payload.code);
      toast.success('一次性充值码已生成');
    } catch (error) {
      toast.error(error.message || '充值码生成失败');
    }
  }

  if (loading) return <div>加载中...</div>;
  if (!settings) return <div>设置加载失败，请刷新后重试。</div>;

  const saveButton = (key) => (
    <button type="button" className="btn btn-primary" disabled={Boolean(savingKey)} onClick={() => void saveSetting(key)}>
      {savingKey === key ? '保存中...' : `保存${TABS.find(([tab]) => tab === key)?.[1]}`}
    </button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.35s ease-out', maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '24px', letterSpacing: '-0.03em', fontWeight: 800 }}>系统设置</h1>

      <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '6px', marginBottom: '24px', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--surface)' }}>
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)} style={{ padding: '10px 16px', border: 0, borderRadius: '10px', cursor: 'pointer', fontWeight: 700, color: activeTab === key ? 'white' : 'var(--text-muted)', background: activeTab === key ? 'var(--primary)' : 'transparent' }}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'llm' && (
        <section className="premium-stat-card">
          <h2 style={headingStyle}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>大模型接口（LLM）配置</h2>
          <div style={{ display: 'grid', gap: '20px', maxWidth: '680px' }}>
            <label style={labelStyle}>DeepSeek API Key<input type="password" className="input-base" value={settings.llm.apiKey || ''} onChange={(event) => setSettings((current) => ({ ...current, llm: { ...current.llm, apiKey: event.target.value } }))} placeholder="sk-..." /></label>
            <label style={labelStyle}>默认模型<input type="text" className="input-base" value={settings.llm.model || ''} onChange={(event) => setSettings((current) => ({ ...current, llm: { ...current.llm, model: event.target.value } }))} /></label>
            <div>{saveButton('llm')}</div>
          </div>
        </section>
      )}

      {activeTab === 'wechat' && (
        <section className="premium-stat-card">
          <h2 style={headingStyle}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>微信登录（WeChat OAuth）</h2>
          <div style={{ display: 'grid', gap: '20px', maxWidth: '680px' }}>
            <label style={labelStyle}>AppID（网站应用）<input type="text" className="input-base" value={settings.wechat.appId || ''} onChange={(event) => setSettings((current) => ({ ...current, wechat: { ...current.wechat, appId: event.target.value } }))} placeholder="wx..." /></label>
            <label style={labelStyle}>AppSecret<input type="password" className="input-base" value={settings.wechat.appSecret || ''} onChange={(event) => setSettings((current) => ({ ...current, wechat: { ...current.wechat, appSecret: event.target.value } }))} placeholder="••••••••" /></label>
            <div>{saveButton('wechat')}</div>
          </div>
        </section>
      )}

      {activeTab === 'billing' && (
        <section className="premium-stat-card">
          <h2 style={{ ...headingStyle, marginBottom: '16px' }}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>计费策略</h2>
          <div style={{ padding: '13px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', border: '1px solid #a7f3d0', borderRadius: '12px', background: '#f0fdf8' }}>
            <div><div style={{ color: '#047857', fontWeight: 750 }}>按实际 Token 直接结算</div><div style={{ marginTop: '3px', color: '#527066', fontSize: '.78rem' }}>任务完成后一次性扣款，不产生预授权扣款和余额退回流水。</div></div>
            <span style={{ flexShrink: 0, padding: '5px 9px', borderRadius: '999px', background: '#d1fae5', color: '#047857', fontSize: '.72rem', fontWeight: 750 }}>已启用</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div style={billingGroupStyle}>
              <h3 style={billingGroupTitleStyle}>Token 单价</h3>
              <p style={billingGroupDescriptionStyle}>模型：deepseek-v4-flash，单位为每 1,000 Tokens 消耗的 Credits。</p>
              <div style={{ display: 'grid', gap: '14px' }}>
                {[['inputCreditsPer1K', '输入 Tokens'], ['outputCreditsPer1K', '输出 Tokens'], ['cachedInputCreditsPer1K', '缓存输入 Tokens']].map(([key, label]) => <label key={key} style={labelStyle}>{label}<div style={{ position: 'relative' }}><input type="number" min="0" step="0.001" className="input-base" style={{ width: '100%', paddingRight: '92px' }} value={settings.billing.models['deepseek-v4-flash'][key]} onChange={(event) => setSettings((current) => ({ ...current, billing: { ...current.billing, models: { ...current.billing.models, 'deepseek-v4-flash': { ...current.billing.models['deepseek-v4-flash'], [key]: Number(event.target.value) } } } }))} /><span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '.72rem' }}>Credits / 1K</span></div></label>)}
              </div>
            </div>

            <div style={billingGroupStyle}>
              <h3 style={billingGroupTitleStyle}>会员计费倍率</h3>
              <p style={billingGroupDescriptionStyle}>最终费用 = Token 原价 × 会员倍率。1 表示原价，0.8 表示八折。</p>
              <div style={{ display: 'grid', gap: '14px' }}>
                {[['FREE', '免费用户'], ['PRO', '专业版'], ['ENTERPRISE', '企业版']].map(([level, label]) => <label key={level} style={labelStyle}>{label}<div style={{ position: 'relative' }}><input type="number" min="0" max="1" step="0.05" className="input-base" style={{ width: '100%', paddingRight: '58px' }} value={settings.billing.discountRates[level]} onChange={(event) => setSettings((current) => ({ ...current, billing: { ...current.billing, discountRates: { ...current.billing.discountRates, [level]: Number(event.target.value) } } }))} /><span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '.72rem' }}>× 原价</span></div></label>)}
              </div>
            </div>

            <div style={billingGroupStyle}>
              <h3 style={billingGroupTitleStyle}>充值换算</h3>
              <p style={billingGroupDescriptionStyle}>用于微信支付充值时，将人民币金额换算为到账 Credits。</p>
              <label style={labelStyle}>每 ¥1 到账 Credits<div style={{ position: 'relative' }}><input type="number" min="1" step="1" className="input-base" style={{ width: '100%', paddingRight: '88px' }} value={settings.billing.creditsPerCny} onChange={(event) => setSettings((current) => ({ ...current, billing: { ...current.billing, creditsPerCny: Number(event.target.value) } }))} /><span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '.72rem' }}>Credits / ¥1</span></div></label>
            </div>

            <div style={billingGroupStyle}>
              <h3 style={billingGroupTitleStyle}>任务额度校验</h3>
              <p style={billingGroupDescriptionStyle}>仅用于开始任务前估算最低余额，不会冻结或扣除余额；最终仍按实际 Token 结算。</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <label style={labelStyle}>估算输入 Tokens<input type="number" min="0" step="1000" className="input-base" value={settings.billing.reservationInputTokens} onChange={(event) => setSettings((current) => ({ ...current, billing: { ...current.billing, reservationInputTokens: Number(event.target.value) } }))} /></label>
                <label style={labelStyle}>估算输出 Tokens<input type="number" min="0" step="1000" className="input-base" value={settings.billing.reservationOutputTokens} onChange={(event) => setSettings((current) => ({ ...current, billing: { ...current.billing, reservationOutputTokens: Number(event.target.value) } }))} /></label>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '20px', paddingTop: '18px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>{saveButton('billing')}</div>
        </section>
      )}

      {activeTab === 'wechatPay' && (
        <section className="premium-stat-card">
          <h2 style={headingStyle}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>微信支付 API v3</h2>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: wechatPayStatus.configured ? '#d1fae5' : '#fee2e2', color: wechatPayStatus.configured ? '#047857' : '#b91c1c', fontWeight: 700 }}>{wechatPayStatus.configured ? '配置完整，可以收款' : '配置未完成'}</div>
          <p style={{ marginTop: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>支付密钥、商户私钥和微信平台公钥只从服务器环境变量读取，不会发送到浏览器，也无需在此保存。</p>
          {!wechatPayStatus.configured ? <div style={{ marginTop: '12px', padding: '12px', borderRadius: '9px', background: '#fff7f7', color: '#b91c1c', lineHeight: 1.6 }}>缺少：{wechatPayStatus.missing.join('、')}</div> : <div style={{ marginTop: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>回调地址：{wechatPayStatus.notifyUrl}</div>}
        </section>
      )}

      {activeTab === 'recharge' && (
        <section className="premium-stat-card">
          <h2 style={headingStyle}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>一次性充值码</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '18px' }}>充值码明文只在创建时显示，数据库仅保存不可逆哈希；每个码只能兑换一次。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '18px', maxWidth: '680px' }}>
            <label style={labelStyle}>Credits<input className="input-base" type="number" min="1" value={rechargeAmount} onChange={(event) => setRechargeAmount(Number(event.target.value))} /></label>
            <label style={labelStyle}>有效天数<input className="input-base" type="number" min="1" max="3650" value={rechargeValidDays} onChange={(event) => setRechargeValidDays(Number(event.target.value))} /></label>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => void generateRechargeCode()}>生成充值码</button>
          {generatedRechargeCode ? <div style={{ marginTop: '14px', padding: '14px', border: '1px dashed var(--primary)', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><code style={{ wordBreak: 'break-all', fontWeight: 700 }}>{generatedRechargeCode}</code><button type="button" className="btn btn-outline" onClick={() => { void navigator.clipboard.writeText(generatedRechargeCode); toast.success('已复制'); }}>复制</button></div> : null}
        </section>
      )}
    </div>
  );
}
