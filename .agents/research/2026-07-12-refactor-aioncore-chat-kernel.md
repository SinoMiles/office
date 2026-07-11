# AionCore Chat Kernel Refactoring Plan

**Date:** 2026-07-12
**Target:** `app/hooks/useAioncoreChat.js`
**Strategy:** Incremental migration with a parallel protocol layer

## Current State

- The 263-line hook owns connection lifecycle, retries, event parsing, frame batching, message merging, runtime state and UI mapping.
- `app/dashboard/page.js` is the only direct consumer and expects `{ messages, isProcessing, sendMessage, loadConversation, cancelGeneration }`.
- There are no chat protocol, reconnect or reducer tests.
- The browser connects directly to `ws://127.0.0.1:9123/ws`.

## Risk Assessment

| Target | Lines | Blast Radius | Tests | Urgency | ROI | Effort |
|---|---:|---:|---|---|---|---|
| `useAioncoreChat.js` | 263 | 1 direct UI consumer, server integration transitive | None | High | Excellent | Medium |
| `dashboard/page.js` | 1160 | Page-local | None | High, but only chat integration is in scope | Good | Small integration change |

## Dependencies

### Upstream

| Dependency | Use | Risk |
|---|---|---|
| Browser WebSocket | realtime AionCore events | High: deployment, auth and reconnect behavior |
| AionCore REST API | conversation/history/message lifecycle | High: protocol compatibility |
| React hooks | UI subscription lifecycle | Medium |

### Downstream

| Dependent | Impact |
|---|---|
| `app/dashboard/page.js` | Public hook shape stays stable; no visual rewrite |
| `/api/process` | Remains task/billing orchestrator; AionCore base URL becomes centralized |
| task completion sync | Must receive reliable terminal runtime state |

## Blast Radius

| Risk Level | Files | Description |
|---|---:|---|
| Direct | 1 | Existing chat hook |
| Immediate | 1 | Dashboard consumer |
| Supporting | 6-10 | Protocol, store, bridge, proxy, server and tests |

## Step-by-Step Plan

| Step | Change | Verification |
|---|---|---|
| 1 | Add pure message reducer and runtime store based on AionUi semantics | Node unit tests |
| 2 | Add resilient same-origin WebSocket bridge with queue, heartbeat response, reconnect and resync event | Node unit tests where practical |
| 3 | Add authenticated same-origin REST proxy and HTTP-server `/ws` upgrade proxy | Tests, build, startup smoke test |
| 4 | Replace hook internals while preserving the dashboard-facing API | Lint, build, manual code-flow review |
| 5 | Remove per-token debug posting and automatic permission approval | Tests and source scan |

## Rollback

The new protocol layer is added in parallel before switching the hook. If integration fails, revert the final hook/server commit; the previous hook remains recoverable from Git. No database schema or stored data is changed.

## Status

| Step | Tests | Build | Status |
|---|---|---|---|
| Baseline | 1 passed | N/A | Existing full lint has 13 unrelated errors |
| Protocol reducer/runtime | 5 passed | Passed | Complete |
| Same-origin HTTP/WS bridge | Target lint passed | Passed | Complete |
| Hook migration | Target lint passed | Passed | Complete |
| Server smoke test | HTTP 200; unauthenticated WS 401 | Passed | Complete |

## Final Build Verification

| Check | Result |
|---|---|
| `npm test` | 5/5 passed |
| Targeted ESLint | Passed |
| `npm run build` | Passed |
| Production HTTP smoke test | `/login` returned 200 |
| WebSocket authentication smoke test | unauthenticated `/ws` upgrade returned 401 |

The production build retains one pre-existing Turbopack NFT tracing warning caused by dynamic filesystem usage in the process route import graph. The full repository lint remains red on unrelated admin/navigation/dashboard findings recorded at baseline; the changed chat files pass targeted lint.
