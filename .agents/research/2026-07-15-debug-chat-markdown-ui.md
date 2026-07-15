# Chat Markdown UI investigation

**Date:** 2026-07-15  
**Bug:** Ordered Aion message blocks rendered with raw Markdown defaults  
**Status:** Fixed

## Reproduction

Open an assistant response containing headings, a GFM table, lists, and horizontal rules after commit `f637b27`. The response enters `AionMessageTimeline` instead of the legacy dashboard renderer. Table columns collapse, headings inherit page-level sizes, and spacing becomes visually inconsistent.

## Root cause

`AionMessageTimeline.TextBlock` used bare `ReactMarkdown`, while the legacy dashboard path supplied custom renderers for tables, headings, code, lists, and links. The global `h1/h2/h3` rules were therefore applied to chat content, and GFM tables had no width or overflow constraints.

## Hypotheses checked

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| 1 | New timeline bypasses the styled Markdown renderer | Confirmed | Bare `ReactMarkdown` in `AionMessageTimeline.js` |
| 2 | Model output is malformed | Rejected | GFM parsed a table, but browser column sizing collapsed its first column |
| 3 | Chat panel width alone causes the issue | Partial | Narrow width exposes the table bug, but a responsive table wrapper fixes it |

## Fix

- Added shared `ChatMarkdown` with consistent GFM and syntax-highlighting renderers.
- Applied scoped editorial typography that does not inherit page-heading sizing.
- Added an overflow container and minimum table width for narrow chat columns.
- Reused the same renderer for generated Markdown file previews.

## Issue rating table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | New timeline bypassed styled Markdown rendering | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | 🟢 4 files | Small |
| 2 | Three Markdown surfaces had divergent styling | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟠 Excellent | 🟢 3 files | Small |

## Verification

- ESLint passes for all affected components.
- CSS selectors are scoped under `.chat-markdown`.
- Table rendering keeps a readable minimum width and scrolls inside narrow panes.
- Development server compiles the changed components.
