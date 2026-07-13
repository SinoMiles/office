# Chat Stop Button and Thinking Stream Investigation

**Date:** 2026-07-13
**Bug:** Generation lost its stop control and streamed thinking displayed only the first fragment.
**Urgency:** 🟡 High
**Status:** Fixed

## Symptoms

- The composer switched back to the send button while AionCore was still running.
- The thinking panel showed one or two characters and rapidly changed instead of retaining the accumulated reasoning text.

## Root Cause

1. `app/dashboard/page.js` cleared `processLoading` in the request `finally` block immediately after starting the WebSocket turn. The button only read that local flag and ignored the authoritative AionCore runtime flag.
2. `lib/aioncore/chat-reducer.js` read initial thought text from `data.description`, appended later chunks to `content.content`, and then mapped the stale `data` value back to the UI. Separate thought messages also replaced the previous visible thought.

The reducer mismatch was introduced with the initial stream adapter in `fb57ffe6`/`6f85a3a`; the early loading reset existed in the original dashboard flow and became visible after the AionCore bridge replaced request-bound generation.

## Fix Applied

| File | Change |
|---|---|
| `app/dashboard/page.js` | Keep request loading active until a terminal runtime event and derive the composer control from local-or-runtime generation state. |
| `lib/aioncore/chat-reducer.js` | Normalize text extraction, accumulate thought chunks consistently, and preserve separate thought messages. |
| `test/aioncore-chat-reducer.test.mjs` | Add regression coverage for both same-message chunks and separate thought messages. |

## Verification

- [x] Reducer regression tests cover the original thought payload shape.
- [x] Existing test suite passes.
- [x] ESLint passes.
- [x] Composer render path uses the combined generation state.

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Stop control disappeared during active generation | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 page | Small |
| 2 | Thought stream mixed `data` and `content` storage and lost accumulated text | 🟡 High | 🟡 Medium | 🟡 High | 🟠 Excellent | 🟢 Chat stream adapter | Small |

## Similar Patterns Found

The same text/content extraction path also serves assistant response chunks; it now uses the shared normalizer. No other duplicate stream accumulator was found.

## Prevention

Keep transport payload normalization inside the adapter/reducer and test every supported AionCore payload shape. UI controls should read the authoritative runtime state, with local request state used only to bridge startup latency.
