# AionUi vs OfficeWeb chat, preview, and workspace gap audit

## Overview

OfficeWeb now consumes the core AionCore conversation stream, ordered thinking/tool/text blocks, permission confirmations, live Office preview events, and multi-file preview identities. The remaining difference is no longer a different backend architecture. Most gaps are renderer capabilities that AionUi builds on top of message types and filesystem APIs already exposed by AionCore.

## Key components compared

| Area | AionUi | OfficeWeb | Assessment |
|---|---|---|---|
| Ordered message timeline | Separate thinking/text/tool messages | Implemented as ordered blocks | Covered |
| Tool grouping | Normalized calls + `View Steps` | Basic grouped calls | Partial |
| Plans | `plan` message rendered as todo list | Ignored | Missing, high priority |
| Tips/status | success/warning/info/error and agent status | Only error tips | Missing, high priority |
| File changes | Write/edit diffs grouped by file | Only final Office artifacts | Missing, high priority |
| Permission | Visible approval UI + recovery | Automatic approval + recovery | Intentional product difference |
| Office previews | File-path tabs, watcher, retry | Artifact-path tabs, watcher proxy | Mostly covered |
| Generic previews | PDF/image/Markdown/HTML/code/diff/URL | Office plus legacy generated preview | Missing, medium priority |
| Workspace tree | Search, upload, rename, delete, refresh, changes | Output file cards only | Missing, high priority for “file workspace” |
| Auto-scroll | Pauses when user scrolls, jump-to-bottom control | Always scrolls on every message update | Missing, high priority |
| Tool detail recovery | Fetches full persisted result when stream is truncated | Displays only received detail | Missing, medium priority |
| Message actions | Copy/timestamp per completed turn | None | Missing, medium priority |
| Preview editing | Dirty state, save, close confirmation, shortcuts | Read-only Office preview | Not required for Office generation; later phase |
| Snapshot/history | Markdown/HTML snapshot history | None | Low priority |
| Model/thought selector | Runtime model and thought-level selection | Server-selected fixed model | Product decision, not a renderer bug |

## Data flow and missing branches

```text
AionCore message.stream
  -> OfficeWeb reducer
       covered: thinking, text, tool_group, tool_call, acp_tool_call, errors
       missing: plan, agent_status, success/info/warning tips, file_diff summaries
  -> OfficeWeb timeline
       covered: ordered blocks and expandable tool details
       partial: canceled/pending/in_progress normalization, truncated detail recovery
```

The preview path is separate:

```text
workspaceOfficeWatch.fileAdded
  -> OfficeWeb artifact persistence
  -> artifact-scoped officecli watcher
  -> tabbed iframe preview
```

This covers Office documents well. It does not provide AionUi's general workspace file tree or previews for source files, Markdown, images, PDF, diff, HTML, and URLs.

## Priority findings

### P0/P1: user-visible correctness

1. Add `plan` blocks and live plan-entry status updates. The backend message is currently silently discarded.
2. Normalize all tool states (`pending`, `in_progress`, `completed`, `error`, `canceled`) and nested ACP outputs. A canceled tool can currently appear to keep running.
3. Render structured `tips` and `agent_status`, especially retryable runtime/workspace errors.
4. Replace unconditional bottom scrolling with “follow while at bottom” plus a jump-to-latest button.
5. Add a conversation workspace file list driven by workspace listing and tool/file events. Output cards alone do not expose intermediate/source files.

### P2: commercial-quality workflow

6. Group WriteFile/edit diffs by file and allow opening the file or its diff.
7. Add generic preview adapters for PDF, image, Markdown/text/code, and diff before HTML/URL.
8. Add copy and timestamp actions once per completed assistant turn.
9. Add explicit retry for preview startup failure and structured empty/error states.
10. Delay opening a newly created Office file briefly and normalize macOS `/private/tmp` and `/private/var` aliases, matching AionUi's race/path safeguards.

### P3: optional desktop-derived features

11. Editable source previews with dirty tracking, save shortcuts, and close confirmation.
12. Snapshot/version history for editable Markdown/HTML.
13. Runtime model/thought-level selector if OfficeWeb later exposes multiple billable models.
14. Slash-command discovery (`available_commands`) and advanced artifacts such as cron/skill suggestions.

## Dependencies and platform boundaries

Plans, tips, statuses, tool normalization, auto-scroll, message actions, and retry UI need no new backend service. They consume existing stream/history data.

A true file workspace needs an authenticated same-origin wrapper over AionCore's workspace listing/read APIs and a safe download/open route. It is a new OfficeWeb feature but not a new external service.

Desktop-only actions such as “open in system application”, arbitrary host filesystem operations, drag files from Finder, and local Git staging should not be copied directly into the browser product.

## Edge cases and gotchas

| Scenario | Risk in OfficeWeb |
|---|---|
| User scrolls upward during streaming | Current effect forces the viewport back to bottom |
| Tool reports `canceled` | Current status mapping may leave it as running |
| ACP result is truncated | Detail panel cannot recover full content |
| File is emitted before fully written | Immediate watcher start can show a transient preview error |
| `/private/tmp` vs `/tmp` path | Same file can receive different identities |
| Agent emits a plan/status/tip | Message can disappear completely |
| Non-Office file is generated | No consistent file card/preview workflow |
| Preview watcher fails after refresh | API returns an error, but UI has no dedicated retry state |

## Git history

- `f637b27` added ordered AionCore steps.
- `9b725dc` added the multi-file preview workspace.
- Earlier preview restoration is in `81edcd7`.

## Quick Reference

**To modify message coverage:** start at `lib/aioncore/chat-reducer.js` and `app/components/AionMessageTimeline.js`.

**To modify workspace behavior:** add a workspace adapter beside `lib/office/artifacts.js` and an authenticated `/api/tasks/[id]/workspace` route rather than exposing filesystem paths directly.

**To debug missing UI:** compare the raw message `type`, `data`, and `content` against the reducer branches, then inspect the generated assistant `blocks`.

**To add tests:** extend `test/aioncore-chat-reducer.test.mjs` with plan, tip, canceled tool, nested ACP output, and interleaving cases.
