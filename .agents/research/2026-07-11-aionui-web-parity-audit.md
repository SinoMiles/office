# AionUi vs OfficeWeb user-facing parity audit

## Scope

Compared user-visible conversation state, streaming, genuine work status, document preview, history, cancellation, and recovery. Desktop-only command details, permission dialogs, local workspace browsing, MCP/ACP protocols, and internal tool payloads are explicitly out of scope.

## Already aligned

- Text-only turns stream text and no longer display an invented document plan.
- OfficeCLI progress is shown only after a real tool call and preview HTML comes from OfficeCLI `view html`.
- Progress auto-collapses after completion.
- A task chain supplies recent prior prompts and answers to the model.
- Artifact preview and download routes are authenticated and scoped to the task owner.

## Gaps

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Refreshing during a running task loses the live stream and progress UI; the task has no reconnect/status endpoint. AionUi hydrates active conversation runtime. | 🟡 High | 🟡 Medium | 🟡 High | 🟠 Excellent | 🟡 Dashboard + API | Medium |
| 2 | There is no user cancel/stop action. AionUi exposes a stop operation for the active turn. | 🟡 High | 🟡 Medium | 🟡 High | 🟢 Good | 🟡 Dashboard + API + agent | Medium |
| 3 | Opening a historical task displays only its final user/AI pair, not the whole `parentTaskId` conversation. AionUi reloads the complete conversation message history. | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟠 Excellent | 🟡 Dashboard + API | Small |
| 4 | A previous PPTX has no extractable content for a follow-up, and OfficeWeb always creates a new file rather than continuing to edit the existing artifact. AionUi works from a workspace file. | 🟡 High | 🟡 Medium | 🟡 High | 🟢 Good | 🟡 Agent + OfficeCLI integration | Medium/Large |
| 5 | When a user lacks balance after generation, output files can remain in storage but the task is marked failed. This is a task-lifecycle mismatch rather than an AionUi feature gap. | 🟢 Medium | 🟡 Medium | 🟢 Medium | 🟢 Good | ⚪ Process API | Small |
| 6 | No automated regression tests cover SSE parsing, task-chain history, or the real OfficeCLI event sequence. | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟢 Good | 🟡 API + UI | Medium |

## Recommended order

1. Add task status/reconnect and stop/cancel, so a long document job remains controllable after a refresh.
2. Render complete task chains in history, matching the current model context.
3. Add explicit “continue editing this file” behavior, including PPTX content extraction or an OfficeCLI read path.
4. Make billing settlement reserve/validate credit before expensive execution and add tests.

## Reference evidence

- AionUi consumes distinct `start`, `thought`, `content`, `tool_group`, and `finish` events in `packages/desktop/src/renderer/pages/conversation/platforms/aionrs/useAionrsMessage.ts`.
- AionUi hydrates running conversation state in `packages/desktop/src/renderer/pages/conversation/runtime/useConversationRuntimeView.ts` and exposes stop handling in `platforms/aionrs/AionrsSendBox.tsx`.
- AionUi starts an OfficeCLI watch viewer for real-time file preview in `Preview/components/viewers/OfficeWatchViewer.tsx`.
