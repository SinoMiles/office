# AionUi parity implementation plan

## Mode: Standalone informed by feature-gap audit

Source: `2026-07-15-explain-aionui-gap-audit.md`. The user explicitly approved all listed implementation items with a balanced, incremental delivery approach. Desktop-only host integration, Git staging, editable snapshots, and runtime model billing controls remain excluded.

## Feature summary

| Aspect | Details |
|---|---|
| What | Complete OfficeWeb handling of existing AionCore message types, add safe file-workspace browsing and generic previews, and improve streaming/preview resilience |
| Why | Make generated work understandable, discoverable, and recoverable at commercial Web UI quality |
| Scope | Plans, statuses, tips, tools, scroll, copy/time, workspace files, generic preview, retry/path safeguards |

## Rated tasks

| # | Task | Size | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort/LOE |
|---|---|---|---|---|---|---|---|---|
| 1 | Complete message adapter for plans, tips, statuses and tool states | M | 🟡 High | 🟢 Medium | 🟡 High | 🟠 Excellent | 🟢 4 files | Medium / 4h |
| 2 | Add user-controlled streaming follow, jump-to-latest, copy and timestamp | M | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | 🟢 3 files | Medium / 4h |
| 3 | Add authenticated task-scoped workspace listing and file delivery | M | 🟡 High | 🟡 High | 🟡 High | 🟢 Good | 🟢 4 files | Medium / 6h |
| 4 | Add collapsible workspace browser and generic preview tabs | M | 🟡 High | 🟢 Medium | 🟡 High | 🟢 Good | 🟢 5 files | Medium / 8h |
| 5 | Add Office preview delay, path normalization, retry and error states | M | 🟢 Medium | ⚪ Low | 🟢 Medium | 🟠 Excellent | 🟢 4 files | Medium / 4h |
| 6 | Add regression tests and end-to-end verification | M | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | 🟢 3 files | Medium / 4h |

## Impact analysis

| Area | Files affected | Risk | Notes |
|---|---|---|---|
| Message adapter | `chat-reducer`, timeline components | Medium | Must preserve legacy history fields |
| Task model/process | Task workspace metadata and initialization | Medium | Additive schema field |
| API | Task-scoped workspace list/file routes | High | Path authorization is mandatory |
| Dashboard | Scroll controller and workspace/preview composition | Medium | Extract components to limit rerenders |
| Preview | Artifact retry and generic file viewers | Medium | Office iframe remains unchanged |
| Tests | Reducer and workspace path policy | Low | Pure helpers where possible |

## Phases

| Phase | Tasks | Acceptance |
|---|---|---|
| A: Message completeness | 1 | No supported message type silently disappears; canceled tools terminate |
| B: Conversation UX | 2 | Upward scrolling is respected; latest button/copy/time work |
| C: Workspace API | 3 | Users can only list/read files inside their own task workspace |
| D: Workspace UI | 4 | Files are searchable and open in typed preview tabs |
| E: Resilience | 5 | Office preview races/path aliases/retry have explicit handling |
| F: Verification | 6 | Unit suite, lint and development compilation pass |

## Risks and mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Arbitrary filesystem exposure | Medium | High | Resolve real paths and enforce task workspace prefix on every request |
| Message duplication | Medium | Medium | Preserve contiguous merge rules and add ordered-block fixtures |
| Dashboard rerender cost | Medium | Medium | Extract memo-friendly workspace/timeline components and use stable callbacks |
| Large/binary file loading | Medium | Medium | Stream files and cap inline text previews |
| Existing task has no workspace field | High | Low | Resolve from artifacts/original file and retain empty-state fallback |

## Test and rollback

| Phase | Tests | Rollback |
|---|---|---|
| A | Reducer fixtures for plan/tip/status/canceled ACP calls | Revert new block branches; legacy fields remain |
| B | Scroll state helper and clipboard UI smoke test | Remove controller component |
| C | Path policy traversal and ownership tests | Remove task-scoped routes/schema field |
| D | File type mapping and preview open/close smoke test | Hide workspace panel; Office tabs remain |
| E | Path alias and retry-state tests | Restore immediate Office open |

## Deliverables

All implementation is additive around the existing same-origin HTTP/WS bridge. No additional external service is introduced.
