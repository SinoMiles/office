'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState(10000);
  const [rechargeValidDays, setRechargeValidDays] = useState(365);
  const [generatedRechargeCode, setGeneratedRechargeCode] = useState('');
  const [wechatPayStatus, setWechatPayStatus] = useState({ configured: false, missing: [] });

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        setWechatPayStatus(data.wechatPay || { configured: false, missing: [] });
        const storedBilling = data.settings.find(s => s.key === 'billing')?.value || {};
        const billing = {
          creditsPerCny: storedBilling.creditsPerCny ?? 100,
          reservationInputTokens: storedBilling.reservationInputTokens ?? 16000,
          reservationOutputTokens: storedBilling.reservationOutputTokens ?? 8192,
          discountRates: { FREE: 1, PRO: 0.8, ENTERPRISE: 0.5, ...storedBilling.discountRates },
          models: {
            ...storedBilling.models,
            'deepseek-v4-flash': { inputCreditsPer1K: 2, outputCreditsPer1K: 8, cachedInputCreditsPer1K: 0.5, ...storedBilling.models?.['deepseek-v4-flash'] },
          },
        };
        const llm = data.settings.find(s => s.key === 'llm')?.value || { apiKey: '', model: 'deepseek-v4-flash' };
        const wechat = data.settings.find(s => s.key === 'wechat')?.value || { appId: '', appSecret: '' };
        setSettings({ billing, llm, wechat });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchSettings(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = [
        { key: 'billing', value: settings.billing },
        { key: 'llm', value: settings.llm },
        { key: 'wechat', value: settings.wechat }
      ];
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('保存成功！');
      } else {
        toast.error('保存失败: ' + data.error);
      }
    } catch (e) {
      toast.error('请求异常');
    }
  };

  const handleGenerateRechargeCode = async () => {
    const response = await fetch('/api/admin/billing/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: rechargeAmount, validDays: rechargeValidDays }) });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error || '充值码生成失败');
    setGeneratedRechargeCode(payload.code);
    toast.success('一次性充值码已生成');
  };

  if (loading || !settings) return <div>加载中...</div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '32px', letterSpacing: '-0.03em', fontWeight: 800 }}>系统设置</h1>
      
      <form onSubmit={handleSave} className="bento-grid" style={{ maxWidth: '1200px' }}>
        <div className="premium-stat-card bento-col-6" style={{ height: '100%' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 }}>
            <span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>
            大模型接口 (LLM) 配置
          </h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Deepseek API Key</label>
            <input 
              type="password" 
              className="input-base" 
              value={settings.llm.apiKey} 
              onChange={e => setSettings({...settings, llm: {...settings.llm, apiKey: e.target.value}})}
              placeholder="sk-..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>默认模型</label>
            <input 
              type="text" 
              className="input-base" 
              value={settings.llm.model} 
              onChange={e => setSettings({...settings, llm: {...settings.llm, model: e.target.value}})}
            />
          </div>
        </div>

        <div className="premium-stat-card bento-col-6" style={{ height: '100%' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 }}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>微信支付 API v3</h2>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: wechatPayStatus.configured ? '#d1fae5' : '#fee2e2', color: wechatPayStatus.configured ? '#047857' : '#b91c1c', fontWeight: 700, fontSize: '0.82rem' }}>{wechatPayStatus.configured ? '配置完整，可以收款' : '配置未完成'}</div>
          <p style={{ marginTop: '14px', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.7 }}>支付密钥、商户私钥和微信平台公钥只从服务器环境变量读取，不会发送到浏览器。</p>
          {!wechatPayStatus.configured ? <div style={{ marginTop: '12px', padding: '12px', borderRadius: '9px', background: '#fff7f7', color: '#b91c1c', fontSize: '0.75rem', lineHeight: 1.6 }}>缺少：{wechatPayStatus.missing.join('、')}</div> : <div style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.75rem', wordBreak: 'break-all' }}>回调地址：{wechatPayStatus.notifyUrl}</div>}
        </div>

        <div className="premium-stat-card bento-col-6" style={{ height: '100%' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 }}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>一次性充值码</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: '18px' }}>充值码明文只在创建时显示，数据库仅保存不可逆哈希；每个码只能兑换一次。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <label style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>Credits<input className="input-base" type="number" min="1" value={rechargeAmount} onChange={(event) => setRechargeAmount(Number(event.target.value))} /></label>
            <label style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>有效天数<input className="input-base" type="number" min="1" max="3650" value={rechargeValidDays} onChange={(event) => setRechargeValidDays(Number(event.target.value))} /></label>
          </div>
          <button type="button" className="btn btn-outline" onClick={handleGenerateRechargeCode}>生成充值码</button>
          {generatedRechargeCode ? <div style={{ marginTop: '14px', padding: '14px', border: '1px dashed var(--primary)', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><code style={{ wordBreak: 'break-all', fontWeight: 700 }}>{generatedRechargeCode}</code><button type="button" className="btn btn-outline" onClick={() => { void navigator.clipboard.writeText(generatedRechargeCode); toast.success('已复制'); }}>复制</button></div> : null}
        </div>

        <div className="premium-stat-card bento-col-6" style={{ height: '100%' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 }}>
            <span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>
            商用计费策略（Credits）
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: '18px' }}>余额单位为 Credits；模型返回的真实输入、输出与缓存 Token 将按以下价格结算。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              ['inputCreditsPer1K', '输入 / 1K Tokens'],
              ['outputCreditsPer1K', '输出 / 1K Tokens'],
              ['cachedInputCreditsPer1K', '缓存输入 / 1K Tokens'],
            ].map(([key, label]) => <label key={key} style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>{label}<input type="number" min="0" step="0.001" className="input-base" value={settings.billing.models['deepseek-v4-flash'][key]} onChange={e => setSettings((current) => ({ ...current, billing: { ...current.billing, models: { ...current.billing.models, 'deepseek-v4-flash': { ...current.billing.models['deepseek-v4-flash'], [key]: Number(e.target.value) } } } }))} /></label>)}
            <label style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>Credits / ¥1<input type="number" min="1" step="1" className="input-base" value={settings.billing.creditsPerCny} onChange={e => setSettings((current) => ({ ...current, billing: { ...current.billing, creditsPerCny: Number(e.target.value) } }))} /></label>
            <label style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>预留输入 Tokens<input type="number" min="0" step="1000" className="input-base" value={settings.billing.reservationInputTokens} onChange={e => setSettings((current) => ({ ...current, billing: { ...current.billing, reservationInputTokens: Number(e.target.value) } }))} /></label>
            <label style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>预留输出 Tokens<input type="number" min="0" step="1000" className="input-base" value={settings.billing.reservationOutputTokens} onChange={e => setSettings((current) => ({ ...current, billing: { ...current.billing, reservationOutputTokens: Number(e.target.value) } }))} /></label>
            {['FREE', 'PRO', 'ENTERPRISE'].map((level) => <label key={level} style={{ display: 'grid', gap: '7px', fontWeight: 500 }}>{level} 计费倍率<input type="number" min="0" max="1" step="0.05" className="input-base" value={settings.billing.discountRates[level]} onChange={e => setSettings((current) => ({ ...current, billing: { ...current.billing, discountRates: { ...current.billing.discountRates, [level]: Number(e.target.value) } } }))} /></label>)}
          </div>
        </div>

        <div className="premium-stat-card bento-col-6" style={{ height: '100%' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 }}>
            <span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>
            微信登录 (WeChat OAuth)
          </h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>AppID (网站应用)</label>
            <input 
              type="text" 
              className="input-base" 
              value={settings.wechat?.appId || ''} 
              onChange={e => setSettings({...settings, wechat: {...settings.wechat, appId: e.target.value}})}
              placeholder="wx..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>AppSecret</label>
            <input 
              type="password" 
              className="input-base" 
              value={settings.wechat?.appSecret || ''} 
              onChange={e => setSettings({...settings, wechat: {...settings.wechat, appSecret: e.target.value}})}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="bento-col-12" style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '16px', paddingBottom: '48px' }}>
          <button 
            type="submit" 
            style={{ 
              padding: '16px 32px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, #059669 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '16px', 
              fontSize: '1rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(16, 185, 129, 0.5)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.4)'; }}
          >
            保存系统配置
          </button>
        </div>
      </form>
    </div>
  );
}
