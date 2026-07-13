# History Refresh Investigation

**Date:** 2026-07-13
**Bug:** Refreshing lost the open conversation and historical replies displayed only “处理完成”.
**Urgency:** 🟡 High
**Status:** Fixed

## Symptoms

- The currently open completed conversation was not restored after refreshing the dashboard.
- Opening its sidebar entry showed a generic completion placeholder instead of the assistant response.
- Task records were configured for automatic deletion after 24 hours.

## Root Cause

1. The dashboard did not persist or restore the active task identifier.
2. On Next.js 16, the finish route read asynchronous `params` without `await`. Its task ID was therefore `undefined`; MongoDB updated zero rows while the endpoint still returned success. Historical rendering then substituted “处理完成” for the empty response instead of consulting AionCore's durable message database.
3. The Task schema defined a 24-hour TTL index, so MongoDB eventually deleted history records.

## Fix Applied

| File | Change |
|---|---|
| `app/dashboard/page.js` | Remember and restore the last open task; use recovered AionCore messages and honest database fallbacks. |
| `app/api/tasks/[id]/finish/route.js` | Await Next.js route params and reject zero-row updates instead of reporting false success. |
| `app/api/tasks/[id]/conversation/route.js` | Load full paginated AionCore message history for the task conversation. |
| `lib/aioncore/chat-reducer.js` | Normalize HTTP history `position` fields into UI roles. |
| `models/Task.js`, `lib/db.js` | Remove the 24-hour task TTL and migrate existing records/index. |
| `test/aioncore-chat-reducer.test.mjs` | Cover AionCore HTTP history normalization. |

## Verification

- [x] AionCore history endpoint format verified against the local service.
- [x] HTTP history normalization has regression coverage.
- [x] Existing tests pass.
- [x] ESLint passes without new errors.

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Active conversation was not restored on refresh | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | ⚪ Dashboard | Small |
| 2 | Historical reply ignored AionCore's durable history | 🟡 High | 🟡 Medium | 🟡 High | 🟠 Excellent | 🟢 All chat history | Medium |
| 3 | Task history had an unintended 24-hour TTL | 🟡 High | 🟡 Medium | 🔴 Critical | 🟠 Excellent | 🟡 All task records | Small |

## Similar Patterns Found

No other user-facing history collection has a TTL. Preview/output files may still expire independently, but their metadata and conversation text now remain.

## Prevention

Treat AionCore as the durable conversation source and MongoDB Task as product metadata/cache. Never display a success placeholder when durable content is unavailable, and do not attach TTL indexes to user-visible history without an explicit retention policy.
