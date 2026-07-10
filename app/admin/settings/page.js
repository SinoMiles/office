'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        const billing = data.settings.find(s => s.key === 'billing')?.value || {};
        const llm = data.settings.find(s => s.key === 'llm')?.value || { apiKey: '', model: 'deepseek-v4-flash' };
        const wechat = data.settings.find(s => s.key === 'wechat')?.value || { appId: '', appSecret: '' };
        setSettings({ billing, llm, wechat });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
          <h2 style={{ fontSize: '1.3rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', fontWeight: 700 }}>
            <span style={{ color: 'var(--primary)', marginRight: '8px' }}>✦</span>
            计费策略 (Tokens)
          </h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>处理费用倍率 (每 1000 Tokens 价格)</label>
            <input 
              type="number" 
              step="0.001"
              className="input-base" 
              value={settings.billing.inputTokenRate} 
              onChange={e => setSettings({...settings, billing: {...settings.billing, inputTokenRate: parseFloat(e.target.value)}})}
            />
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
