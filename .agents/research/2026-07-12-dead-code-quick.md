# Dead Code Scan Report

**Date:** 2026-07-12
**Mode:** Quick (chat refactor, HEAD~5)
**Scope:** OfficeWeb chat transport, debug endpoints and AionCore startup

## Summary

| Confidence | Count | Action |
|---|---:|---|
| High | 6 | Removed with explicit user approval |
| Excluded | 1 | Retained because it has a live entry-point reference |

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Effort |
|---|---|---|---|---|---|---|---|
| 1 | `lib/api/ws.js` legacy WebSocket client, zero references | High | Low | Medium: competing transport implementations | Excellent | One orphan file | Trivial |
| 2 | `/api/debug` payload dump route, zero references | High | Low | High: accidental content logging and public endpoint surface | Excellent | One orphan route | Trivial |
| 3 | Launcher hard-coded AionCore debug logging | Medium | Low | Medium: noisy production output | Good | One startup argument | Trivial |
| 4 | Unused hook return fields (`rawMessages`, `conversationId`, `isConnected`, `runtime`) | Medium | Low | Low: misleading public surface | Good | Hook only | Trivial |
| 5 | Unused `stopGeneration` callback | Medium | Low | Low: duplicates cancellation semantics | Good | Hook only | Trivial |

## Removed

- `lib/api/ws.js`
- `app/api/debug/route.js`

## Retained

- `lib/aioncore/launcher.js`: live dynamic import from `instrumentation.js`; logging now defaults to `info` and can be overridden with `AIONCORE_LOG_LEVEL`.
