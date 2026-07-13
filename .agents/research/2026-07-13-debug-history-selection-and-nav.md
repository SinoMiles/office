# History Selection and Dashboard Navigation Investigation

**Date:** 2026-07-13
**Bug:** Selecting different history rows did not change the conversation, and the dashboard collapse icon was too far from the logo.
**Urgency:** 🟡 High
**Status:** Fixed

## Root Cause

All turns in a continued task chain share one AionCore conversation ID. The history API returned the entire shared conversation for every selected task, then `loadConversation` requested the same full WebSocket history and overwrote the selected result. The top navigation used `space-between` across a full-width container, pushing the collapse button away from the logo.

## Fix Applied

| File | Change |
|---|---|
| `lib/aioncore/chat-reducer.js` | Slice shared AionCore history at the selected task turn. |
| `app/api/tasks/[id]/conversation/route.js` | Return history only through the selected task's prompt chain. |
| `app/hooks/useAioncoreChat.js` | Allow binding a conversation without redundantly loading history. |
| `app/dashboard/page.js` | Switch selection immediately and prevent WebSocket history from overwriting it. |
| `app/components/TopNav.js` | Place the collapse control directly beside the logo. |

## Verification

- [x] Added regression coverage for selecting earlier and later turns in one shared conversation.
- [x] Existing tests pass.
- [x] ESLint passes without new errors.

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Shared history was returned and overwritten for every row | 🟡 High | 🟡 Medium | 🟡 High | 🟠 Excellent | 🟢 Continued conversations | Medium |
| 2 | Collapse icon used full-row `space-between` positioning | ⚪ Low | ⚪ Low | ⚪ Low | 🟢 Good | ⚪ Dashboard header | Trivial |

## Similar Patterns Found

New task creation still requests WebSocket history normally; only explicit history selection disables the redundant request.

## Prevention

Separate “bind this conversation for future messages” from “load its complete history”, and scope persisted history to the selected product task rather than only the shared transport conversation ID.
