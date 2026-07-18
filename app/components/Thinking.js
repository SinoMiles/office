'use client';

import { useState } from 'react';
import { Brain, ChevronDown, Loader2 } from 'lucide-react';
import { useI18n } from '@/app/i18n/I18nProvider';
import { dashboardExtra } from '@/app/i18n/dashboardCopy';

// Mirrors AionUi's MessageThinking: a real thought is only rendered when the
// model actually streams reasoning. It stays open while streaming, then
// collapses automatically when the thought is complete.
export default function Thinking({ thought }) {
  const { locale } = useI18n(); const copy = dashboardExtra(locale);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  if (!thought || !thought.description) return null;
  const done = Boolean(thought.done);
  const expanded = done ? manuallyExpanded : true;

  return (
    <div style={{ marginBottom: '14px', border: '1px solid #ede9fe', background: '#faf9ff', borderRadius: '12px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setManuallyExpanded((value) => !value)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 13px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#4c1d95' }}
      >
        {done ? <Brain size={16} color="#8b5cf6" /> : <Loader2 size={16} className="spin-anim" color="#8b5cf6" />}
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{thought.subject || copy.deepThinking}</span>
        <ChevronDown size={16} style={{ transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }} />
      </button>
      {expanded && (
        <div style={{ padding: '0 13px 12px', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '260px', overflowY: 'auto' }}>
          {thought.description}
        </div>
      )}
    </div>
  );
}
