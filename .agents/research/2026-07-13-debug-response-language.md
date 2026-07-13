# Response Language Investigation

**Date:** 2026-07-13
**Bug:** Thinking summaries and occasional final answers appeared in English for Chinese users.
**Urgency:** 🟢 Medium
**Status:** Fixed

## Root Cause

The OfficeWeb agent context was entirely English and contained no instruction to follow the user's language. The model therefore sometimes inherited English from system instructions, tools, or source material, especially for streamed thinking summaries.

## Fix Applied

| File | Change |
|---|---|
| `lib/aioncore/request-policy.js` | Require all user-visible output to follow the latest user-message language and add a validated product-locale fallback. |
| `app/api/process/route.js` | Derive the fallback from browser `Accept-Language` for new and continued conversations. |
| `test/aioncore-request-policy.test.mjs` | Cover the latest-message language rule and locale fallback. |

## Verification

- [x] New conversation context includes the language policy.
- [x] Continued conversations receive the updated context through `merge_extra`.
- [x] Invalid/missing locales safely fall back to `zh-CN`.
- [x] Tests and ESLint pass.

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | No language-following rule in the model context | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟠 Excellent | 🟢 All conversations | Small |
| 2 | No product-locale fallback for ambiguous messages | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | 🟢 Mixed/short prompts | Small |

## Similar Patterns Found

No front-end translation or hard-coded English response transformation was found. Existing English history remains unchanged; the policy applies when a conversation receives its next request.

## Prevention

Keep language behavior in the conversation policy rather than translating model output in the UI, so streaming text, thinking summaries, tool narration, and final responses stay consistent at the source.
