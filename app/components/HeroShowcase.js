'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Table, FileText, Presentation, Check, Sparkles, Download, ArrowUp,
  Bold, Italic, Underline, AlignLeft, List, Link2,
  Filter, ArrowUpDown, Percent, BarChart3, Sigma,
  Type, Image as ImageIcon, Shapes, LayoutGrid, Play,
  Database, PieChart, Hash, MessageSquareQuote, Layers,
} from 'lucide-react';

// Hero 演示：左侧聊天、右侧文档预览 —— 刻意与真实工作台同构，
// 首页看到的就是登录后会用到的界面。
//
// 一轮完整叙事：指令逐字输入 → 发送成气泡 → AI 逐步处理 → 文档生成 → 产出文件。
// 三个文档循环，对话会累积，跑满一轮后清空重来。
// 全部用 DOM + CSS 绘制，无图片资源，任意分辨率与缩放下都清晰。

const KIND_ICONS = [Table, FileText, Presentation];
const KIND_TINTS = ['#22c55e', '#3b82f6', '#f97316'];
const COLUMN_LETTERS = ['A', 'B', 'C', 'D'];

const TOOLBAR_ICONS = [
  [Sigma, Percent, Filter, ArrowUpDown, BarChart3],
  [Bold, Italic, Underline, AlignLeft, List, Link2],
  [Type, ImageIcon, Shapes, LayoutGrid, Play],
];
const RAIL_ICONS = [
  [Database, Layers, PieChart],
  [Hash, Hash, Hash],
  [LayoutGrid, LayoutGrid, LayoutGrid, LayoutGrid],
];

// 节奏刻意放慢：让人看得清每一步在发生什么，而不是一闪而过。
const TYPE_MS = 52;        // 每字符
const SEND_DELAY = 520;    // 打完到发送
const STEP_MS = 720;       // 每个处理步骤
const SETTLE_DELAY = 420;  // 最后一步到文档落地
const HOLD_MS = 4200;      // 结果停留

export default function HeroShowcase({ items, doneLabel, steps, chat }) {
  const [index, setIndex] = useState(0);
  // phase: typing → sent → 处理中(step 0/1/2) → done
  const [state, setState] = useState({ index: 0, chars: 0, phase: 'typing', step: -1 });
  const timers = useRef([]);

  useEffect(() => {
    const current = items[index];
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const at = (ms, next) => timers.current.push(setTimeout(() => setState(next), ms));
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (reduceMotion) {
      // 仍放进定时器：effect 体内同步 setState 会引发级联渲染。
      at(0, { index, chars: current.prompt.length, phase: 'done', step: steps.length });
      timers.current.push(setTimeout(() => setIndex((v) => (v + 1) % items.length), 6000));
      return clear;
    }

    for (let i = 1; i <= current.prompt.length; i += 1) {
      at(i * TYPE_MS, { index, chars: i, phase: 'typing', step: -1 });
    }
    let t = current.prompt.length * TYPE_MS + SEND_DELAY;
    at(t, { index, chars: 0, phase: 'sent', step: -1 });
    for (let s = 0; s < steps.length; s += 1) {
      t += STEP_MS;
      at(t, { index, chars: 0, phase: 'working', step: s });
    }
    t += SETTLE_DELAY;
    at(t, { index, chars: 0, phase: 'done', step: steps.length });
    timers.current.push(setTimeout(() => setIndex((v) => (v + 1) % items.length), t + HOLD_MS));

    return clear;
  }, [index, items, steps.length]);

  const active = items[index];
  const Icon = KIND_ICONS[index] || Table;
  const tint = KIND_TINTS[index];
  const onCurrent = state.index === index;
  const phase = onCurrent ? state.phase : 'typing';
  const typed = onCurrent && phase === 'typing' ? active.prompt.slice(0, state.chars) : '';
  const settled = phase === 'done';
  const sent = phase !== 'typing';
  const stepIndex = onCurrent ? state.step : -1;
  // 对话累积：本轮之前已完成的条目留在上方，跑满一轮后自然清空。
  const history = items.slice(0, index);

  return (
    <div className="showcase">
      <div className="showcase-bar">
        <span className="showcase-dot" style={{ background: '#ff5f57' }} />
        <span className="showcase-dot" style={{ background: '#febc2e' }} />
        <span className="showcase-dot" style={{ background: '#28c840' }} />
        <span className="showcase-file">
          <Icon size={13} color={tint} />
          {active.file}
        </span>
        <span className={`showcase-status${settled ? ' is-done' : ''}`}>
          {settled ? <><Check size={12} /> {doneLabel}</> : <span className="showcase-spinner" />}
        </span>
      </div>

      <div className="showcase-split">
        {/* ---------- 左：聊天 ---------- */}
        <section className="chat-pane">
          <div className="chat-log">
            {history.map((past) => (
              <div className="chat-turn is-past" key={past.file}>
                <p className="chat-bubble is-user">{past.prompt}</p>
                <div className="chat-bubble is-ai">
                  <p>{past.reply}</p>
                  <span className="chat-file"><Check size={11} />{past.result}</span>
                </div>
              </div>
            ))}

            {sent ? (
              <div className="chat-turn" key={active.file}>
                <p className="chat-bubble is-user">{active.prompt}</p>
                <div className="chat-bubble is-ai">
                  <div className="chat-steps">
                    {steps.map((step, i) => (
                      <span className={`chat-step${i < stepIndex ? ' is-done' : ''}${i === stepIndex ? ' is-active' : ''}`} key={step}>
                        {i < stepIndex ? <Check size={11} /> : <i />}
                        {step}
                      </span>
                    ))}
                  </div>
                  {settled ? (
                    <>
                      <p className="chat-reply">{active.reply}</p>
                      <span className="chat-file is-fresh">
                        <Icon size={11} color={tint} />
                        {active.result}
                        <b><Download size={10} />{chat.download}</b>
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* 输入框：未发送时逐字打字，发送后回到占位态 */}
          <div className={`chat-input${sent ? ' is-idle' : ''}`}>
            <span className="chat-input-text">
              {typed || (sent ? <em>{chat.placeholder}</em> : null)}
              {!sent ? <i className="chat-caret" /> : null}
            </span>
            <span className={`chat-send${!sent && typed ? ' is-ready' : ''}`}><ArrowUp size={13} /></span>
          </div>
        </section>

        {/* ---------- 右：文档预览 ---------- */}
        <section className="doc-pane">
          <div className="showcase-toolbar">
            {active.tabs.map((tab, tabIndex) => (
              <span className={`tool-tab${tabIndex === 0 ? ' is-on' : ''}`} key={tab}>{tab}</span>
            ))}
            <span className="tool-sep" />
            {(TOOLBAR_ICONS[index] || TOOLBAR_ICONS[0]).map((ToolIcon, iconIndex) => (
              <span className={`tool-btn${iconIndex === 0 ? ' is-on' : ''}`} key={iconIndex}><ToolIcon size={13} /></span>
            ))}
            <span className="tool-grow" />
            <span className="tool-chip" style={{ color: tint, borderColor: `${tint}55`, background: `${tint}18` }}>
              <Sparkles size={11} /> AI
            </span>
          </div>

          <div className="doc-inner">
            <aside className="showcase-rail">
              {active.rail.map((label, railIndex) => {
                const RailIcon = (RAIL_ICONS[index] || RAIL_ICONS[0])[railIndex] || Hash;
                return (
                  <span className={`rail-item${railIndex === 1 ? ' is-on' : ''}`} key={label}>
                    <RailIcon size={13} color={railIndex === 1 ? tint : undefined} />
                    {label}
                  </span>
                );
              })}
            </aside>

            <div className="showcase-main">
              <div className="showcase-formula">
                <span className="formula-cell">{index === 0 ? 'B2' : 'fx'}</span>
                <span className="formula-text">{active.formula}</span>
              </div>
              <div className="showcase-stage">
                <div className="showcase-doc" key={index}>
                  {index === 0 ? <SheetDoc data={active.sheet} settled={settled} /> : null}
                  {index === 1 ? <TextDoc data={active.text} settled={settled} /> : null}
                  {index === 2 ? <SlideDoc data={active.slide} settled={settled} /> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="showcase-statusbar">
            <span>{settled ? active.status : `${chat.thinking}…`}</span>
            <span className="statusbar-right">{active.kind} · OfficeGPT</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function SheetDoc({ data, settled }) {
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const flagged = data?.flagged ?? -1;
  const template = `28px repeat(${columns.length}, minmax(0, 1fr))`;
  return (
    <div className="doc-sheet">
      <div className="sheet-cols" style={{ gridTemplateColumns: template }}>
        <span />
        {columns.map((_, columnIndex) => (
          <span className={columnIndex === 1 ? 'is-on' : ''} key={COLUMN_LETTERS[columnIndex]}>{COLUMN_LETTERS[columnIndex]}</span>
        ))}
      </div>
      <div className="sheet-head" style={{ gridTemplateColumns: template }}>
        <span className="sheet-rownum">1</span>
        {columns.map((label) => <span key={label}>{label}</span>)}
      </div>
      {rows.map((row, rowIndex) => (
        <div
          className={`sheet-row${settled && rowIndex === flagged ? ' is-flagged' : ''}${rowIndex === 0 ? ' is-selected' : ''}`}
          key={row[0]}
          style={{ gridTemplateColumns: template, animationDelay: `${120 + rowIndex * 80}ms` }}
        >
          <span className="sheet-rownum">{rowIndex + 2}</span>
          {row.map((cell, cellIndex) => (
            <span key={cell} className={cellIndex === 0 ? '' : `num${cell.startsWith('−') ? ' down' : cell.startsWith('+') ? ' up' : ''}`}>{cell}</span>
          ))}
          {rowIndex === 0 ? <i className="sheet-handle" /> : null}
        </div>
      ))}
      <div className="sheet-chart">
        <div className="sheet-chart-grid">{[0, 1, 2].map((line) => <i key={line} />)}</div>
        {rows.slice(0, 4).map((row, chartIndex) => (
          <span key={row[0]} style={{ height: settled ? `${[62, 48, 34, 78][chartIndex]}%` : '5%', transitionDelay: `${chartIndex * 85}ms` }} />
        ))}
      </div>
    </div>
  );
}

function TextDoc({ data, settled }) {
  return (
    <div className="doc-text">
      <div className="text-ruler">
        {Array.from({ length: 26 }, (_, tick) => <i key={tick} className={tick % 4 === 0 ? 'is-major' : ''} />)}
      </div>
      <div className="text-page">
        <h4 className="text-heading">{data?.title}</h4>
        <p className={`text-para is-before${settled ? ' is-out' : ''}`}>{data?.before}</p>
        <p className={`text-para is-after${settled ? ' is-in' : ''}`}>{data?.after}</p>
        {(data?.rest || []).map((line, lineIndex) => (
          <p className="text-para" key={line} style={{ animationDelay: `${200 + lineIndex * 100}ms` }}>{line}</p>
        ))}
        <span className={`text-comment${settled ? ' is-in' : ''}`}>
          <MessageSquareQuote size={12} />
          {data?.comment}
        </span>
      </div>
    </div>
  );
}

function SlideDoc({ data, settled }) {
  const chart = data?.chart || [];
  return (
    <div className="doc-slide-wrap">
      <div className="slide-strip">
        {[0, 1, 2, 3].map((slideIndex) => (
          <span className={`slide-thumb${slideIndex === 1 ? ' is-on' : ''}`} key={slideIndex}>
            <b>{slideIndex + 1}</b><i /><i />
          </span>
        ))}
      </div>
      <div className="doc-slide">
        <h4 className="slide-heading">{data?.title}</h4>
        <div className="slide-body">
          <ul className="slide-bullets">
            {(data?.bullets || []).map((bullet, bulletIndex) => (
              <li key={bullet} style={{ animationDelay: `${180 + bulletIndex * 100}ms` }}>{bullet}</li>
            ))}
          </ul>
          <div className="slide-chart">
            <div className="slide-chart-grid">{[0, 1, 2].map((line) => <i key={line} />)}</div>
            {chart.map(([label, height], chartIndex) => (
              <span key={label} style={{ height: settled ? `${height}%` : '6%', transitionDelay: `${chartIndex * 85}ms` }}>
                <b>{label}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
