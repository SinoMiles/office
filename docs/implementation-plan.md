# AionUi-style AI + OfficeCLI integration plan

Mode: standalone. Risk posture: balanced. Target: a safe working MVP first, then production worker isolation.

| Phase | Task | Size | Urgency | Risk | ROI | Blast Radius | LOE | Status |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Foundation | Extract the untracked Next.js app into an independent project | S | High | Low | High | Medium | 1h | Done |
| Security | Remove browser-supplied shell execution and hard-coded JWT fallback | S | Critical | Medium | Critical | High | 2h | Done |
| Agent | Replace fenced CLI scripts with DeepSeek structured tool calls | M | Critical | Medium | Critical | High | 1d | Done |
| Office | Execute validated operations through `@officecli/sdk` | M | Critical | Medium | Critical | High | 1d | Done |
| Artifact | Persist generated files and real OfficeCLI HTML previews per user/task | M | High | Medium | High | High | 1d | Done |
| UI | Replace synthetic command preview with authenticated real preview/download | M | High | Medium | High | Medium | 1d | Done |
| Reliability | Add a durable queue, cancellation, retries, worker recovery and progress events | L | High | High | High | High | 3-5d | Pending |
| Isolation | Run Office workers in restricted per-task containers with CPU/memory/network quotas | L | Critical | High | Critical | High | 3-5d | Pending |
| Storage | Move local artifacts to S3-compatible object storage with retention policies | M | High | Medium | High | Medium | 2d | Pending |
| Quality | Add agent contract tests, route authorization tests and end-to-end generation tests | L | High | Low | High | Medium | 3d | Pending |

## Acceptance criteria

- A browser can no longer submit executable shell.
- DeepSeek can request an Office document only through an allowlisted structured tool.
- OfficeCLI creates an editable file and its own HTML renderer provides the preview.
- Preview and download require authentication and task ownership.
- Production build passes.
- Public deployment remains blocked until worker isolation, queueing and tests are complete.

## Rollback

The original half-built application remains unchanged under `/Users/miles/Downloads/OfficeCLI/web-app`. The new implementation is isolated under `/Users/miles/Documents/office/OfficeWeb`; rollback is switching back to the original directory, not reverting individual unsafe endpoints.
