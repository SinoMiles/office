# Chat Stuck in Thinking — Debug Report

## Reproduction

- Trigger: submit a message from the OfficeWeb dashboard.
- Actual: optimistic runtime enters `starting`, but the UI can remain processing after AionCore completes.
- Expected: `finish`, `turn.completed`, error, cancellation or a terminal turn state releases processing.
- Regression: introduced by the chat-kernel refactor in `fb57ffe`.

## Ranked Hypotheses and Results

| # | Hypothesis | Likelihood | Result | Evidence |
|---|---|---|---|---|
| 1 | A terminal stream event without `msg_id` is discarded | High | Confirmed | Hook returned before calling `reduceRuntime`; AionUi treats `finish` as a control event. |
| 2 | OfficeWeb omitted canonical `turn.completed` | High | Confirmed | AionUi subscribes to `turn.completed`; OfficeWeb only subscribed to `chat:turn:state` and `message.stream`. |
| 3 | Payload/type mapping differs from AionUi | High | Confirmed | AionUi uses `thought` and carries text/tool payloads in `data`; OfficeWeb primarily expected `thinking` and `content`. |

## Issue Rating Table

| Finding | Urgency | Risk | ROI | Blast Radius |
|---|---|---|---|---|
| Terminal events ignored without `msg_id` | Critical | High: every completed task can remain loading | Excellent | Chat runtime and task completion sync |
| Missing `turn.completed` subscription | Critical | High: no canonical recovery path | Excellent | Chat runtime only |
| AionUi payload mismatch | High | Medium: missing thought/content/tool display | Excellent | Chat message rendering only |
| No end-to-end console trace | High | Low runtime risk, high diagnostic cost | Good | Process, WS proxy, browser bridge and reducer |
| AionCore starts before browser WebSocket is ready | Critical | High: early and terminal events can all be lost | Excellent | Message submission path |
| Permission events were rendered but never confirmed | Critical | High: command/tool execution waits forever | Excellent | Tool execution and skill invocation |

## Root Cause

The refactored hook treated every `message.stream` payload as a renderable message and required `msg_id` before updating runtime. Control events such as `finish` do not need to be renderable and may not carry a message ID. The implementation also omitted AionUi's canonical `turn.completed` event and did not fully match AionUi's `thought`/`data` wire shapes.

Runtime console evidence also confirmed a sequencing race: `chat:history:load` was queued because the socket was not open, while `/api/process` had already instructed AionCore to generate. A short response could therefore complete before the browser subscribed to any event.

## Fix

- Runtime reduction now occurs before render-message filtering.
- Added `turn.completed` and `ai_waiting_input` terminal handling.
- Added `thought`, string `data`, and tool-group `data[]` compatibility.
- Added structured `[OfficeWeb:AionChat]` console logs across process initiation, WS proxy, browser socket, inbound/outbound events, history, reducer transitions and cancellation.
- Logs summarize identifiers and keys rather than printing prompts, document contents, cookies or tokens.
- Added an explicit WebSocket readiness promise. Dashboard submission now waits up to eight seconds for `/ws` to open before calling `/api/process`; timeout becomes a visible error instead of an infinite loading state.
- Added automatic one-time confirmation for `permission` and `acp_permission`, including pending-confirmation recovery on conversation load/reconnect. It prefers `proceed_once` and never persists `always_allow`, so no permission UI is required without weakening future backend policy.

## Verification

| Check | Result |
|---|---|
| Unit tests | 8/8 passed |
| Targeted ESLint | Passed |
| Production build | Passed |
