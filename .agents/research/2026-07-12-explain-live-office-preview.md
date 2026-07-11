# AionUi-style Live Office Preview in OfficeWeb

## What It Is

OfficeWeb now mirrors AionUi WebUI's Office preview lifecycle: start a workspace watcher before agent generation, react to `workspaceOfficeWatch.fileAdded`, launch `officecli watch` for the new file, and open the existing right-hand iframe against a same-origin streaming proxy.

## Why Preview Was Missing

`lib/office/watch-manager.js` already implemented the OfficeCLI watch process, and the dashboard already had a right preview panel. They were disconnected: no route called `startWatch`, the chat client did not subscribe to `workspaceOfficeWatch.fileAdded`, and `/api/process` did not start AionCore's workspace Office watcher.

## Components

| Component | Purpose |
|---|---|
| `/api/process` | Resolves conversation workspace and starts AionCore Office watch before generation |
| `useAioncoreChat` | Buffers/handles `workspaceOfficeWatch.fileAdded` and exposes the live artifact |
| `/office-preview/start` | Validates the file is inside the workspace, starts OfficeCLI watch, persists output metadata |
| `/office-preview/proxy` | Authenticated same-origin proxy for OfficeCLI HTML, assets, API and SSE |
| Dashboard | Opens the existing right panel when `officeArtifact` changes |

## Data Flow

1. Browser confirms WebSocket readiness.
2. `/api/process` creates/loads the AionCore conversation.
3. It reads `extra.workspace` and calls `/api/fs/office-watch/start` before sending the prompt.
4. Agent creates a `.pptx`, `.docx`, `.xlsx` or `.xls` file.
5. AionCore emits `workspaceOfficeWatch.fileAdded`.
6. The hook associates the event with the Mongo task, buffering it if the event beats the `/api/process` response.
7. `/office-preview/start` launches `officecli watch` and updates `outputFile`/`outputFilename`.
8. Dashboard opens the right panel using the streaming proxy URL.
9. OfficeCLI SSE updates refresh preview content as the agent continues writing.

## Edge Cases

- File paths must resolve beneath the conversation workspace.
- Only supported Office extensions can start a preview.
- Events arriving before task binding are buffered and replayed.
- The proxy rewrites OfficeCLI's absolute `/events`, `/`, and `/api/*` browser requests to the task-scoped prefix.
- Preview and download routes remain protected by the OfficeWeb login.

## Quick Reference

Start at `app/api/process/route.js` for watcher bootstrap, `app/hooks/useAioncoreChat.js` for file events, and `lib/office/watch-manager.js` for the resident OfficeCLI process.

