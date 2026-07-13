# Stop Generation Investigation

**Date:** 2026-07-13
**Bug:** The visible stop-generation button did not stop AionCore execution.
**Urgency:** 🟡 High
**Status:** Fixed

## Root Cause

OfficeWeb emitted a non-existent WebSocket event named `chat:cancel`. AionUi actually cancels with an authenticated HTTP `POST /api/conversations/{conversation_id}/cancel` and requires the active `turn_id`. OfficeWeb also discarded `turn_id` on ordinary stream events, so it could not form the required request.

## Fix Applied

| File | Change |
|---|---|
| `app/hooks/useAioncoreChat.js` | Call AionCore's real cancel endpoint with the active turn ID and fall back to querying runtime state. |
| `lib/aioncore/chat-reducer.js` | Retain active turn IDs from stream events and model cancelling/terminal states. |
| `app/dashboard/page.js` | Await cancellation and show actual success/failure feedback. |
| `app/api/tasks/[id]/cancel/route.js` | Persist confirmed cancellation as terminal `cancelled` instead of leaving it in `cancelling`. |
| `test/aioncore-chat-reducer.test.mjs` | Cover turn retention, cancelling, and terminal release. |

## Verification

- [x] Cancellation protocol matched against AionUi's HTTP bridge.
- [x] Runtime fallback response format verified against the local AionCore service.
- [x] Regression tests cover the required turn ID lifecycle.
- [x] Tests and ESLint pass.

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Non-existent WebSocket cancellation event | 🟡 High | 🟡 Medium | 🟡 High | 🟠 Excellent | 🟢 All generated tasks | Small |
| 2 | Active turn ID was discarded | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | 🟢 Chat runtime | Small |
| 3 | Cancelled tasks remained in `cancelling` | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | 🟢 Task history/restore | Trivial |

## Similar Patterns Found

Message sending already uses AionCore's HTTP endpoint through `/api/process`; cancellation was the only remaining invented WebSocket command.

## Prevention

Keep command operations aligned with AionUi's HTTP bridge and use WebSocket only for realtime events. Add protocol tests whenever a command depends on runtime identifiers.
