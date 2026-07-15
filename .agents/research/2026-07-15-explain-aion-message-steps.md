# AionUi message steps and OfficeWeb integration

## Overview

AionCore already emits ordered `thinking`, `text`, `tool_group`, `tool_call`, and `acp_tool_call` messages. AionUi preserves those messages as a turn timeline and only groups adjacent tool messages for its `View Steps` presentation. OfficeWeb previously reduced the entire assistant turn to one `thought`, one `progress`, and one `content` value, which removed repeated and interleaved steps from the UI.

## Key components

| Component | Purpose | Location |
|---|---|---|
| AionUi `mergeMessage` | Preserves boundaries between text/thinking blocks and merges tool updates by call identity | `AionUi/packages/desktop/src/renderer/pages/conversation/Messages/hooks.ts` |
| AionUi `MessageList` | Groups adjacent tools into summaries without flattening the whole turn | `AionUi/packages/desktop/src/renderer/pages/conversation/Messages/MessageList.tsx` |
| AionUi `MessageToolGroupSummary` | Renders `View Steps` and expandable tool details | `AionUi/packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.tsx` |
| OfficeWeb reducer | Adapts AionCore stream/history messages into ordered UI blocks | `lib/aioncore/chat-reducer.js` |
| OfficeWeb timeline | Renders thinking, text, grouped tools, status and details | `app/components/AionMessageTimeline.js` |

## Execution and data flow

1. AionCore sends `message.stream` over the existing same-origin WebSocket bridge.
2. `useAioncoreChat` queues the events and calls `mergeStreamMessages`.
3. Contiguous text/thinking chunks merge only with the immediately preceding matching block. Tool updates continue to merge by call ID.
4. `mapMessagesToUi` creates an ordered `blocks` array for each assistant turn.
5. Adjacent tool events form one `tools` block; intervening text or thinking starts a new block.
6. `AionMessageTimeline` renders the blocks in source order. Tool groups expose `View Steps`, while individual tools expose available input/output details.

```text
AionCore message.stream
  -> mergeStreamMessages (preserve boundaries)
  -> mapMessagesToUi (ordered blocks)
  -> dashboard assistant message
  -> AionMessageTimeline
       thinking / text / View Steps / text / ...
```

## Dependencies

Depends on the existing AionCore message types and WebSocket bridge. No new backend endpoint or protocol branch is introduced. The timeline uses the existing `lucide-react`, `react-markdown`, and `remark-gfm` dependencies.

The dashboard depends on both the new `blocks` representation and legacy `thought/progress/content` fields. Legacy fields remain populated for persistence, completion synchronization, and compatibility with old task records.

## Edge cases

| Scenario | Behavior |
|---|---|
| Repeated chunks for the same active text | Merged while contiguous |
| Text with a tool between chunks | Remains two visible text blocks |
| Tool status update | Replaces the matching call by call ID |
| Missing tool input/output | Tool row remains visible without a detail expander |
| Old history without `blocks` | Uses the previous Thinking/TaskProgress/Markdown renderer |
| Running group | Expanded by default; completed group can be reopened |

## Git history

The multi-file workspace baseline was committed as `9b725dc`. This message-step integration is layered on top and does not alter the HTTP/WS bridge.

## Quick reference

To modify the event adaptation, start at `mapMessagesToUi` in `lib/aioncore/chat-reducer.js`.

To modify the visual treatment, start at `app/components/AionMessageTimeline.js`.

To debug missing steps, inspect raw `message.stream` type, `msg_id`, and tool `call_id`, then verify the resulting assistant `blocks` order.

To add tests, extend `test/aioncore-chat-reducer.test.mjs` with an ordered stream sequence.
