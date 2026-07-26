'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Table, FileText, Presentation, Check, CornerDownLeft, Sparkles,
  Bold, Italic, Underline, AlignLeft, List, Link2,
  Filter, ArrowUpDown, Percent, BarChart3, Sigma,
  Type, Image as ImageIcon, Shapes, LayoutGrid, Play,
  Database, PieChart, Hash, MessageSquareQuote, Layers,
} from 'lucide-react';

// Hero 里原本放的是一张 1024×1024 的方形示意图 —— 一眼假，也没有传达产品做什么。
// 这里换成真实感的循环演示：打字输入一句自然语言指令，对应的
// Excel / Word / PPT 结果随之生成，并配上真实办公软件应有的完整外壳。
//
// 关键取舍：文档内容用真实文字与真实数据，而不是灰色占位条 —— 占位条
// 无论排得多整齐都像线框图，一眼就能看出不是产品截图。
// 全部用 DOM + CSS 绘制，没有图片资源，任意分辨率与缩放下都清晰。

const KIND_ICONS = [Table, FileText, Presentation];
const KIND_TINTS = ['#22c55e', '#3b82f6', '#f97316'];
const COLUMN_LETTERS = ['A', 'B', 'C', 'D'];

// 每种文档的工具条图标，对应各自软件真正会出现的功能
const TOOLBAR_ICONS = [
  [Sigma, Percent, Filter, ArrowUpDown, BarChart3],
  [Bold, Italic, Underline, AlignLeft, List, Link2],
  [Type, ImageIcon, Shapes, LayoutGrid, Play],
];
// 左侧导航项的图标
const RAIL_ICONS = [
  [Database, Layers, PieChart],
  [Hash, Hash, Hash],
  [LayoutGrid, LayoutGrid, LayoutGrid, LayoutGrid],
];

const TYPE_MS = 34;
const HOLD_MS = 3400;

export default function HeroShowcase({ items, doneLabel, steps }) {
  const [index, setIndex] = useState(0);
  // 打字进度带上它所属的 index。这样切换文档时无需在 effect 里同步重置状态 ——
  // 只要 progress.index 与当前 index 不一致，派生出来的就是「尚未开始」。
  const [progress, setProgress] = useState({ index: 0, chars: 0, settled: false });
  const timers = useRef([]);

  useEffect(() => {
    const current = items[index];
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (reduceMotion) {
      // 仍然放进定时器：effect 体内同步 setState 会引发级联渲染。
      timers.current.push(setTimeout(() => setProgress({ index, chars: current.prompt.length, settled: true }), 0));
      return clear;
    }

    for (let i = 1; i <= current.prompt.length; i += 1) {
      timers.current.push(setTimeout(() => setProgress({ index, chars: i, settled: false }), i * TYPE_MS));
    }
    const typingDone = current.prompt.length * TYPE_MS;
    timers.current.push(setTimeout(() => setProgress({ index, chars: current.prompt.length, settled: true }), typingDone + 300));
    timers.current.push(setTimeout(() => setIndex((value) => (value + 1) % items.length), typingDone + HOLD_MS));

    return clear;
  }, [index, items]);

  const active = items[index];
  const Icon = KIND_ICONS[index] || Table;
  const tint = KIND_TINTS[index];
  const onCurrent = progress.index === index;
  const typed = onCurrent ? active.prompt.slice(0, progress.chars) : '';
  const settled = onCurrent && progress.settled;
  const ratio = active.prompt.length ? progress.chars / active.prompt.length : 0;
  const activeStep = settled ? 3 : Math.min(2, Math.floor(ratio * 3));
  const railIcons = RAIL_ICONS[index] || RAIL_ICONS[0];

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

      <div className="showcase-toolbar">
        {active.tabs.map((tab, tabIndex) => (
          <span className={`tool-tab${tabIndex === 0 ? ' is-on' : ''}`} key={tab}>{tab}</span>
        ))}
        <span className="tool-sep" />
        {(TOOLBAR_ICONS[index] || TOOLBAR_ICONS[0]).map((ToolIcon, iconIndex) => (
          <span className={`tool-btn${iconIndex === 0 ? ' is-on' : ''}`} key={iconIndex}>
            <ToolIcon size={13} />
          </span>
        ))}
        <span className="tool-grow" />
        <span className="tool-chip" style={{ color: tint, borderColor: `${tint}55`, background: `${tint}18` }}>
          <Sparkles size={11} /> AI
        </span>
      </div>

      <div className="showcase-body">
        <aside className="showcase-rail">
          {active.rail.map((label, railIndex) => {
            const RailIcon = railIcons[railIndex] || railIcons[0];
            return (
              <span className={`rail-item${railIndex === 1 ? ' is-on' : ''}`} key={label}>
                <RailIcon size={13} color={railIndex === 1 ? tint : undefined} />
                {label}
              </span>
            );
          })}
          <span className="rail-spacer" />
          <div className="rail-steps">
            {steps.map((step, stepIndex) => (
              <span className={`rail-step${stepIndex < activeStep ? ' is-done' : ''}${stepIndex === activeStep ? ' is-active' : ''}`} key={step}>
                {stepIndex < activeStep ? <Check size={11} /> : <i />}
                {step}
              </span>
            ))}
          </div>
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
        <span>{active.status}</span>
        <span className="statusbar-right">{active.kind} · OfficeGPT</span>
      </div>

      <div className="showcase-prompt">
        <CornerDownLeft size={14} color="#64748b" />
        <span className="showcase-typed">
          {typed}
          {!settled ? <i className="showcase-caret" /> : null}
        </span>
      </div>
    </div>
  );
}

function SheetDoc({ data, settled }) {
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const flagged = data?.flagged ?? -1;
  const template = `30px repeat(${columns.length}, minmax(0, 1fr))`;
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
          style={{ gridTemplateColumns: template, animationDelay: `${150 + rowIndex * 90}ms` }}
        >
          <span className="sheet-rownum">{rowIndex + 2}</span>
          {row.map((cell, cellIndex) => (
            <span
              key={cell}
              className={cellIndex === 0 ? '' : `num${cell.startsWith('−') ? ' down' : cell.startsWith('+') ? ' up' : ''}`}
            >
              {cell}
            </span>
          ))}
          {rowIndex === 0 ? <i className="sheet-handle" /> : null}
        </div>
      ))}
      <div className="sheet-chart">
        <div className="sheet-chart-grid">{[0, 1, 2].map((line) => <i key={line} />)}</div>
        {rows.slice(0, 4).map((row, chartIndex) => (
          <span
            key={row[0]}
            style={{ height: settled ? `${[62, 48, 34, 78][chartIndex]}%` : '5%', transitionDelay: `${chartIndex * 85}ms` }}
          />
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
        {/* 润色前后同处一页：结果落地时旧句删除线淡出、新句高亮浮现，
            这是「AI 改了什么」最直观的表达 */}
        <p className={`text-para is-before${settled ? ' is-out' : ''}`}>{data?.before}</p>
        <p className={`text-para is-after${settled ? ' is-in' : ''}`}>{data?.after}</p>
        {(data?.rest || []).map((line, lineIndex) => (
          <p className="text-para" key={line} style={{ animationDelay: `${220 + lineIndex * 110}ms` }}>{line}</p>
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
            <b>{slideIndex + 1}</b>
            <i />
            <i />
          </span>
        ))}
      </div>
      <div className="doc-slide">
        <h4 className="slide-heading">{data?.title}</h4>
        <div className="slide-body">
          <ul className="slide-bullets">
            {(data?.bullets || []).map((bullet, bulletIndex) => (
              <li key={bullet} style={{ animationDelay: `${200 + bulletIndex * 110}ms` }}>{bullet}</li>
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
