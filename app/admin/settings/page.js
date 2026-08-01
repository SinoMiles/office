'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const TABS = [
  ['llm', '大模型接口'],
  ['wechat', '微信登录'],
  ['billing', '计费策略'],
  ['wechatPay', '微信支付'],
  ['referral', '邀请奖励'],
  ['recharge', '充值码'],
  ['runtime', '版本升级'],
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
  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeRefresh, setRuntimeRefresh] = useState(0);

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
            priceMultiplier: storedBilling.priceMultiplier ?? 8,
          },
          llm: data.settings.find((item) => item.key === 'llm')?.value || { apiKey: '', model: 'deepseek-v4-flash' },
          wechat: data.settings.find((item) => item.key === 'wechat')?.value || { appId: '', appSecret: '' },
          referral: {
            enabled: true, inviterCredits: 5000, inviteeCredits: 2000, maxRewardedInvites: 20,
            ...(data.settings.find((item) => item.key === 'referral')?.value || {}),
          },
        });
      } catch (error) {
        toast.error(error.message || '读取设置失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (activeTab !== 'runtime') return undefined;
    let cancelled = false;
    let pollTimer;
    const loadRuntime = async () => {
      setRuntimeLoading(true);
      try {
        const response = await fetch('/api/admin/runtime/officecli', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || '版本检测失败');
        if (cancelled) return;
        setRuntimeStatus(payload.runtime);
        if (payload.runtime.updating || payload.runtime.lastCheck?.state === 'running') {
          pollTimer = setTimeout(loadRuntime, 2500);
        }
      } catch (error) {
        if (!cancelled) toast.error(error.message || '版本检测失败');
      } finally {
        if (!cancelled) setRuntimeLoading(false);
      }
    };
    void loadRuntime();
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [activeTab, runtimeRefresh]);

  async function upgradeRuntime() {
    setRuntimeLoading(true);
    try {
      const response = await fetch('/api/admin/runtime/officecli', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || '升级任务启动失败');
      toast.success(payload.alreadyRunning ? '升级任务正在执行' : '升级任务已启动，完成后会自动切换');
      setRuntimeStatus((current) => current ? { ...current, updating: true } : current);
      setRuntimeRefresh((value) => value + 1);
    } catch (error) {
      toast.error(error.message || '升级任务启动失败');
    } finally {
      setRuntimeLoading(false);
    }
  }

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div style={billingGroupStyle}>
              <h3 style={billingGroupTitleStyle}>统一销售倍率</h3>
              <p style={billingGroupDescriptionStyle}>最终费用 = DeepSeek 官方成本 × 销售倍率。所有用户使用同一倍率，修改后只影响新创建的任务。</p>
              <label style={labelStyle}>销售倍率<div style={{ position: 'relative' }}><input type="number" min="1" max="100" step="0.5" className="input-base" style={{ width: '100%', paddingRight: '48px' }} value={settings.billing.priceMultiplier} onChange={(event) => setSettings((current) => ({ ...current, billing: { ...current.billing, priceMultiplier: Number(event.target.value) } }))} /><span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '.75rem' }}>倍</span></div></label>
            </div>

            <div style={billingGroupStyle}>
              <h3 style={billingGroupTitleStyle}>DeepSeek V4 Flash 成本基准</h3>
              <p style={billingGroupDescriptionStyle}>供应商成本由代码版本维护，后台不可修改。固定换算：¥1 = 1,000 Credits。</p>
              <div style={{ display: 'grid', gap: '10px', color: 'var(--text-muted)', fontSize: '.86rem' }}>
                {[
                  ['缓存未命中输入', 1],
                  ['缓存命中输入', 0.02],
                  ['输出', 2],
                ].map(([label, cost]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                    <span>{label}</span>
                    <span><b style={{ color: 'var(--text-main)' }}>成本 ¥{cost}</b> → 售价 ¥{(cost * settings.billing.priceMultiplier).toFixed(2)} / 百万 Tokens</span>
                  </div>
                ))}
                <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>预计 Token 毛利率</span>
                  <b style={{ color: '#047857' }}>{settings.billing.priceMultiplier > 0 ? ((1 - 1 / settings.billing.priceMultiplier) * 100).toFixed(1) : '0.0'}%</b>
                </div>
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

      {activeTab === 'referral' && (
        <section className="premium-stat-card">
          <h2 style={headingStyle}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>邀请奖励</h2>
          <div style={{ padding: '13px 16px', marginBottom: '18px', border: '1px solid #bfdbfe', borderRadius: '12px', background: '#f0f7ff' }}>
            <div style={{ color: '#1d4ed8', fontWeight: 750 }}>奖励在被邀请人绑定手机号时才发放</div>
            <div style={{ marginTop: '3px', color: '#4b6b96', fontSize: '.78rem', lineHeight: 1.65 }}>
              新用户通过手机号验证后才能获得奖励，一个手机号只能绑定一个账号，可有效控制批量注册风险。
            </div>
          </div>
          <div style={{ display: 'grid', gap: '20px', maxWidth: '680px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
              <input type="checkbox" checked={settings.referral.enabled !== false} onChange={(event) => setSettings((current) => ({ ...current, referral: { ...current.referral, enabled: event.target.checked } }))} />
              启用邀请机制（关闭后工作台不再显示邀请入口，已产生的奖励不受影响）
            </label>
            <label style={labelStyle}>邀请人每成功邀请一位获得（Credits）<input type="number" min="0" className="input-base" value={settings.referral.inviterCredits} onChange={(event) => setSettings((current) => ({ ...current, referral: { ...current.referral, inviterCredits: event.target.value } }))} /></label>
            <label style={labelStyle}>被邀请人额外获得（Credits）<input type="number" min="0" className="input-base" value={settings.referral.inviteeCredits} onChange={(event) => setSettings((current) => ({ ...current, referral: { ...current.referral, inviteeCredits: event.target.value } }))} /></label>
            <label style={labelStyle}>
              单个用户最多可获奖励的邀请数
              <input type="number" min="0" className="input-base" value={settings.referral.maxRewardedInvites} onChange={(event) => setSettings((current) => ({ ...current, referral: { ...current.referral, maxRewardedInvites: event.target.value } }))} />
              <span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>填 0 表示不限。邀请是拉新手段，不设上限就会变成可以无限刷的额度来源。</span>
            </label>
            <div>{saveButton('referral')}</div>
          </div>
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

      {activeTab === 'runtime' && (
        <section className="premium-stat-card">
          <h2 style={headingStyle}><span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>OfficeGPT 工具运行时</h2>
          {!runtimeStatus ? (
            <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>{runtimeLoading ? '正在检测版本...' : '暂时无法读取版本信息'}</div>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                {[
                  ['当前版本', runtimeStatus.activeVersion || '未安装'],
                  ['最新版本', runtimeStatus.latestVersion || '检测失败'],
                  ['运行方式', runtimeStatus.source === 'managed' ? '自动更新版本' : '项目内置版本'],
                  ['更新状态', runtimeStatus.updating ? '正在升级' : runtimeStatus.updateAvailable ? '发现新版本' : '已是最新版'],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '18px', border: '1px solid var(--border)', borderRadius: '13px', background: 'var(--surface)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '.78rem', marginBottom: '8px' }}>{label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 750, color: label === '更新状态' && runtimeStatus.updateAvailable ? '#b45309' : 'var(--text-main)' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '16px 18px', borderRadius: '13px', background: '#f8fafc', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '.84rem', lineHeight: 1.8 }}>
                {runtimeStatus.updating ? (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '7px', color: 'var(--text-main)', fontWeight: 700 }}>
                      <span>{runtimeStatus.lastCheck?.phase || '正在升级'}</span>
                      <span>{Math.max(0, Math.min(100, Number(runtimeStatus.lastCheck?.percent || 0)))}%</span>
                    </div>
                    <div style={{ height: '8px', overflow: 'hidden', borderRadius: '999px', background: '#e2e8f0' }}>
                      <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, Number(runtimeStatus.lastCheck?.percent || 0)))}%`, borderRadius: 'inherit', background: 'var(--primary)', transition: 'width .3s ease' }} />
                    </div>
                    {runtimeStatus.lastCheck?.download?.total ? (
                      <div style={{ marginTop: '6px', fontSize: '.76rem' }}>
                        已下载 {(runtimeStatus.lastCheck.download.received / 1024 / 1024).toFixed(1)} / {(runtimeStatus.lastCheck.download.total / 1024 / 1024).toFixed(1)} MB
                        {runtimeStatus.lastCheck.download.bytesPerSecond ? ` · ${(runtimeStatus.lastCheck.download.bytesPerSecond / 1024).toFixed(0)} KB/s` : ''}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div><b style={{ color: 'var(--text-main)' }}>自动更新：</b>{runtimeStatus.automatic.enabled ? '已启用' : '已关闭'}，每 {runtimeStatus.automatic.intervalHours} 小时检查一次，新版本发布满 {runtimeStatus.automatic.minimumReleaseAgeHours} 小时后才会安装。</div>
                <div><b style={{ color: 'var(--text-main)' }}>上次检查：</b>{runtimeStatus.lastCheck?.checkedAt ? new Date(runtimeStatus.lastCheck.checkedAt).toLocaleString('zh-CN', { hour12: false }) : '暂无记录'}</div>
                {runtimeStatus.lastCheck?.error ? <div style={{ color: '#b91c1c' }}><b>上次失败：</b>{runtimeStatus.lastCheck.error}</div> : null}
                {runtimeStatus.checkError ? <div style={{ color: '#b45309' }}><b>在线检测：</b>{runtimeStatus.checkError}</div> : null}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                <button type="button" className="btn btn-outline" disabled={runtimeLoading || runtimeStatus.updating} onClick={() => setRuntimeRefresh((value) => value + 1)}>
                  {runtimeLoading && !runtimeStatus.updating ? '检测中...' : '检查更新'}
                </button>
                <button type="button" className="btn btn-primary" disabled={runtimeLoading || runtimeStatus.updating || (!runtimeStatus.updateAvailable && runtimeStatus.source === 'managed')} onClick={() => void upgradeRuntime()}>
                  {runtimeStatus.updating ? '升级中...' : runtimeStatus.source !== 'managed' ? '启用自动更新版本' : '立即升级'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
