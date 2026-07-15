# Multi-file preview workspace refactor

## Scope

Preserve the existing AionCore HTTP/WebSocket bridge and `workspaceOfficeWatch.fileAdded` event. Replace the one-task/one-preview assumption with backward-compatible task artifacts and an AionUi-style tabbed preview workspace.

## Dependency and blast-radius map

- `Task.outputFile` was written by the preview-start API and read by preview proxy, download API, active-task recovery, and history UI.
- `useAioncoreChat` already receives the correct file-added lifecycle event; no protocol change is required.
- `watch-manager` already supports arbitrary string keys, so artifact-scoped keys add concurrency without changing process behavior.
- Existing tasks remain readable through the legacy `outputFile` fallback.

## Incremental changes

1. Add embedded `artifacts` while retaining legacy output fields.
2. Make preview and download routes artifact-aware through optional IDs.
3. Map artifacts onto the assistant turn that created them.
4. Add preview tabs and explicit file-card opening; history does not auto-open a file.

## Rollback

The feature can be rolled back at the UI and route layers without a data migration. Existing `outputFile` continues to be updated, and the new embedded field is additive.
