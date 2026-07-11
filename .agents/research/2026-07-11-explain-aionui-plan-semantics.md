# AionUi plan and thinking semantics

## What the reference UI does

AionUi treats `thinking` and `plan` as distinct stream message types. `useAionrsMessage.ts` only transforms and merges a plan when the backend actually emits a `plan` event. `MessagePlan.tsx` displays those received entries; it does not invent a checklist. `MessageThinking.tsx` similarly renders a real thought event and auto-collapses only after its status becomes `done`.

## Gap in OfficeWeb

OfficeWeb had emitted a fixed plan before DeepSeek decided whether the turn needed OfficeCLI. Therefore a pure text request was incorrectly shown as “creating editable file / rendering preview.”

## Applied behavior

OfficeWeb now starts with no progress UI. Text-only responses stream directly into the assistant message. A progress panel is created only when the server has a real OfficeCLI tool event, and its steps are derived from those events.

## Quick reference

`lib/ai/deepseek-agent.js` controls whether an execution event exists. `app/dashboard/page.js` creates the visible progress UI only upon such an event.
