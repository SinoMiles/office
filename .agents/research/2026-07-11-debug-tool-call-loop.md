# Bug Investigation Report

**Date:** 2026-07-11  
**Bug:** Generation ended with `The agent exceeded the maximum tool-call turns`.  
**Urgency:** 🟡 High  
**Status:** Fixed

## Symptoms

The web client rendered the server error after a document-generation request instead of completing the generated file flow.

## Root Cause

**What:** The agent ran a four-turn tool-call loop after receiving an Office document tool call.  
**Where:** `lib/ai/deepseek-agent.js` (previous loop ending in the maximum-turn error).  
**Why:** The web product has one document-generation tool per user request, but the control flow waited for the model to produce a separate final answer. A model that continued to choose the same tool exhausted the arbitrary loop limit.

## Fix Applied

| File | Change | Risk |
|---|---|---|
| `lib/ai/deepseek-agent.js` | Complete the request immediately after a successful OfficeCLI document call and emit a confirmed completion message. | Low |

## Verification

- [x] The maximum-tool-turn branch was removed from the generation path.
- [x] The OfficeCLI failure reason is now returned directly.
- [ ] Live DeepSeek request requires the configured account key and user session.

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Repeated tool-call loop could fail every document request. | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 module | Small |

## Prevention

Treat a completed OfficeCLI generation as the terminal state for a web request. If OfficeCLI fails, surface that concrete error instead of asking the model to retry indefinitely.
