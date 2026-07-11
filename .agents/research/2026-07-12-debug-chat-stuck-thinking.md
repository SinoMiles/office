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

## Root Cause

The refactored hook treated every `message.stream` payload as a renderable message and required `msg_id` before updating runtime. Control events such as `finish` do not need to be renderable and may not carry a message ID. The implementation also omitted AionUi's canonical `turn.completed` event and did not fully match AionUi's `thought`/`data` wire shapes.

## Fix

- Runtime reduction now occurs before render-message filtering.
- Added `turn.completed` and `ai_waiting_input` terminal handling.
- Added `thought`, string `data`, and tool-group `data[]` compatibility.
- Added structured `[OfficeWeb:AionChat]` console logs across process initiation, WS proxy, browser socket, inbound/outbound events, history, reducer transitions and cancellation.
- Logs summarize identifiers and keys rather than printing prompts, document contents, cookies or tokens.

## Verification

| Check | Result |
|---|---|
| Unit tests | 8/8 passed |
| Targeted ESLint | Passed |
| Production build | Passed |

