'use client';

import { useEffect, useRef, useState } from 'react';
import { Table, FileText, Presentation, Check, CornerDownLeft, Sparkles } from 'lucide-react';

// Hero 里原本放的是一张 1024×1024 的方形示意图 —— 一眼假，也没有传达产品做什么。
// 这里换成真实感的循环演示：打字输入一句自然语言指令，对应的
// Excel / Word / PPT 结果随之生成，并配上真实办公软件应有的完整外壳
// （侧栏、工具条、公式栏、行列标号、状态栏）。
//
// 全部用 DOM + CSS 绘制，没有图片资源，任意分辨率与缩放下都清晰。

const KIND_ICONS = [Table, FileText, Presentation];
const KIND_TINTS = ['#22c55e', '#3b82f6', '#f97316'];
const COLUMNS = ['A', 'B', 'C'];

const SHEET_ROWS = [
  ['华东', '1,284,900', '+12.4%'],
  ['华南', '968,320', '+8.1%'],
  ['华北', '742,150', '−3.6%'],
  ['西南', '531,780', '+21.7%'],
];

const TYPE_MS = 40;
const HOLD_MS = 3000;

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
  // 三步处理进度：打字时推进前两步，结果落地时全部完成。
  const ratio = active.prompt.length ? progress.chars / active.prompt.length : 0;
  const activeStep = settled ? 3 : Math.min(2, Math.floor(ratio * 3));

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

      {/* 工具条：分段的假控件，只提供“这是一个专业软件”的质感 */}
      <div className="showcase-toolbar">
        {active.tabs.map((tab, tabIndex) => (
          <span className={`tool-tab${tabIndex === 0 ? ' is-on' : ''}`} key={tab}>{tab}</span>
        ))}
        <span className="tool-sep" />
        {[16, 26, 16, 20].map((width, wIndex) => <span className="tool-pill" key={`${width}-${wIndex}`} style={{ width }} />)}
        <span className="tool-grow" />
        <span className="tool-chip" style={{ color: tint, borderColor: `${tint}55`, background: `${tint}18` }}>
          <Sparkles size={11} /> AI
        </span>
      </div>

      <div className="showcase-body">
        {/* 左侧导航：随文档类型切换内容 */}
        <aside className="showcase-rail">
          {active.rail.map((label, railIndex) => (
            <span className={`rail-item${railIndex === 1 ? ' is-on' : ''}`} key={label}>
              <i style={{ background: railIndex === 1 ? tint : 'rgba(255,255,255,.22)' }} />
              {label}
            </span>
          ))}
          <span className="rail-spacer" />
          <div className="rail-steps">
            {steps.map((step, stepIndex) => (
              <span className={`rail-step${stepIndex < activeStep ? ' is-done' : ''}${stepIndex === activeStep ? ' is-active' : ''}`} key={step}>
                <i />{step}
              </span>
            ))}
          </div>
        </aside>

        <div className="showcase-main">
          {/* 公式栏 / 属性栏 */}
          <div className="showcase-formula">
            <span className="formula-cell">{index === 0 ? 'B2' : 'fx'}</span>
            <span className="formula-text">{active.formula}</span>
          </div>

          <div className="showcase-stage">
            <div className="showcase-doc" key={index}>
              {index === 0 ? <SheetDoc settled={settled} /> : null}
              {index === 1 ? <TextDoc settled={settled} /> : null}
              {index === 2 ? <SlideDoc settled={settled} /> : null}
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

function SheetDoc({ settled }) {
  return (
    <div className="doc-sheet">
      <div className="sheet-cols">
        <span className="sheet-corner" />
        {COLUMNS.map((column) => <span key={column}>{column}</span>)}
      </div>
      <div className="sheet-head">
        <span className="sheet-rownum">1</span>
        {['区域', '销售额', '同比'].map((label) => <span key={label}>{label}</span>)}
      </div>
      {SHEET_ROWS.map((row, rowIndex) => (
        <div
          className={`sheet-row${settled && rowIndex === 2 ? ' is-flagged' : ''}`}
          key={row[0]}
          style={{ animationDelay: `${180 + rowIndex * 100}ms` }}
        >
          <span className="sheet-rownum">{rowIndex + 2}</span>
          <span>{row[0]}</span>
          <span className="num">{row[1]}</span>
          <span className={row[2].startsWith('−') ? 'num down' : 'num up'}>{row[2]}</span>
        </div>
      ))}
      <div className="sheet-chart">
        {[62, 48, 34, 78].map((height, chartIndex) => (
          <span key={height} style={{ height: settled ? `${height}%` : '6%', transitionDelay: `${chartIndex * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}

function TextDoc({ settled }) {
  return (
    <div className="doc-text">
      <div className="text-ruler">
        {Array.from({ length: 24 }, (_, tick) => <i key={tick} className={tick % 4 === 0 ? 'is-major' : ''} />)}
      </div>
      <div className="text-page">
        <div className="text-title" />
        {[96, 88, 72].map((width, lineIndex) => (
          <div className="text-line" key={width} style={{ width: `${width}%`, animationDelay: `${180 + lineIndex * 100}ms` }} />
        ))}
        <div className={`text-line is-revised${settled ? ' is-on' : ''}`} style={{ width: '84%' }} />
        {[92, 64].map((width, lineIndex) => (
          <div className="text-line" key={`b${width}`} style={{ width: `${width}%`, animationDelay: `${520 + lineIndex * 100}ms` }} />
        ))}
      </div>
    </div>
  );
}

function SlideDoc({ settled }) {
  return (
    <div className="doc-slide-wrap">
      <div className="slide-strip">
        {[0, 1, 2, 3].map((slideIndex) => (
          <span className={`slide-thumb${slideIndex === 1 ? ' is-on' : ''}`} key={slideIndex}>
            <b>{slideIndex + 1}</b>
          </span>
        ))}
      </div>
      <div className="doc-slide">
        <div className="slide-title" />
        <div className="slide-body">
          <div className="slide-bullets">
            {[0, 1, 2].map((bulletIndex) => (
              <span key={bulletIndex} style={{ animationDelay: `${240 + bulletIndex * 120}ms` }} />
            ))}
          </div>
          <div className="slide-chart">
            {[40, 66, 52, 88].map((height, chartIndex) => (
              <span key={height} style={{ height: settled ? `${height}%` : '8%', transitionDelay: `${chartIndex * 90}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
