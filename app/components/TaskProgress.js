'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, XCircle } from 'lucide-react';
import { useI18n } from '@/app/i18n/I18nProvider';
import { dashboardExtra } from '@/app/i18n/dashboardCopy';

function elapsed(startedAt, now, copy) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return seconds < 60 ? `${seconds} ${copy.second}` : `${Math.floor(seconds / 60)} ${copy.minute} ${seconds % 60} ${copy.second}`;
}

export default function TaskProgress({ progress }) {
  const { locale } = useI18n(); const copy = dashboardExtra(locale);
  const [ticks, setTicks] = useState(0);
  const [manuallyCollapsed, setManuallyCollapsed] = useState(false);
  const done = Boolean(progress?.done);
  const collapsed = done || manuallyCollapsed;
  const now = progress?.startedAt + (ticks * 1000);

  useEffect(() => {
    if (done) return undefined;
    const timer = window.setInterval(() => setTicks((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [done]);

  if (!progress) return null;
  const steps = progress.steps || [];
  const Icon = done ? CheckCircle2 : Loader2;

  return (
    <div style={{ marginBottom: '14px', border: '1px solid #dbeafe', background: '#f8fbff', borderRadius: '12px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setManuallyCollapsed((value) => !value)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 13px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#1e3a5f' }}
      >
        <Icon size={16} className={done ? '' : 'spin-anim'} color={done ? '#16a34a' : 'var(--primary)'} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{progress.subject || copy.processing}</span>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{done ? `${copy.completed} · ${elapsed(progress.startedAt, now, copy)}` : elapsed(progress.startedAt, now, copy)}</span>
        <ChevronDown size={16} style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .2s' }} />
      </button>
      {!collapsed && (
        <div style={{ padding: '0 13px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {steps.map((step, index) => {
            const StepIcon = step.status === 'completed' ? CheckCircle2 : step.status === 'error' ? XCircle : Loader2;
            return (
              <div key={`${step.id || step.title || 'step'}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem', color: step.status === 'error' ? '#dc2626' : '#475569' }}>
                <StepIcon size={15} className={step.status === 'running' ? 'spin-anim' : ''} color={step.status === 'completed' ? '#16a34a' : step.status === 'error' ? '#dc2626' : '#64748b'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div>{step.title}</div>
                  {step.detail && <div style={{ marginTop: '2px', color: '#94a3b8' }}>{step.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
