# WebSocket Empty Error Investigation

**Date:** 2026-07-13
**Bug:** Next.js development overlay reports `[OfficeWeb:AionChat][ws] socket error {}` during mount.
**Urgency:** Medium
**Status:** Fixed

## Root Cause

React development Strict Mode creates the realtime client, runs effect cleanup, and creates it again. Cleanup closed the first WebSocket while it was still connecting. The browser emitted an empty `ErrorEvent` for that stale socket, and the unguarded error listener passed it to `console.error`. The replacement socket connected normally, so this was a lifecycle race rather than an AionCore outage.

## Fix

- Ignore events from sockets that are no longer the active client socket.
- Detach the active socket reference before intentional close.
- Let the close event remain the single reconnect trigger.
- Log actionable transport failures as warnings; readiness timeout remains an error.

## Verification

- The server log showed the first connection closing during client cleanup and the replacement connecting immediately afterward.
- Existing chat reducer, permission, request policy, and task runtime tests pass.

## Issue Rating

| Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|
| Stale WebSocket error is reported as an application error | Medium | Low | Medium | Excellent | Realtime client only | Small |

## Similar Patterns

No other browser transport error listener in the chat path reports an expected lifecycle event through `console.error`.
