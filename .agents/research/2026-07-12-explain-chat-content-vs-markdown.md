# Chat Content vs Markdown File Generation

## Finding

OfficeWeb did not create the Markdown file. AionCore's agent chose the `Write` tool and saved `年度述职大纲.md`, then returned only a summary. Recent conversation evidence shows the same AionUi/AionCore stack behaving both ways: conversation `3166eb11` streamed the complete outline directly, while `7749515d` and `9f5ce116` chose `Write` and produced `.md` files.

AionUi does not read Markdown files back into the chat response. Its `fileStream.contentUpdate` updates preview tabs only. Therefore this is agent policy variance, not a missing frontend Markdown renderer.

## Desired Product Rule

- Textual deliverables—outlines, reports, summaries, translations, analysis, polished copy—must stream completely in chat.
- The agent must not create `.md`/`.txt` merely to deliver requested text.
- OfficeCLI is injected only when the user explicitly requests a file such as PPT/PPTX, DOCX, XLSX or PDF.
- Internal instructions live in conversation context and are not appended to visible user messages.

## Implementation

`lib/aioncore/request-policy.js` provides a hidden conversation context and explicit-file intent classifier. New conversations exclude automatic `officecli` injection. Existing task chains receive the same context through the conversation PATCH endpoint. `/api/process` passes `inject_skills: ['officecli']` only for explicit file-generation requests.

## Examples

| Prompt | Workflow |
|---|---|
| `请帮我写一份年度述职 PPT 的详细大纲` | Full outline streamed in chat |
| `生成一段首页内容` | Content streamed in chat |
| `生成ppt` | OfficeCLI file workflow |
| `把上面的内容导出为 docx` | OfficeCLI file workflow |

## Verification

- Intent-policy tests cover direct-content and explicit-file prompts.
- All 15 unit tests pass.
- Targeted ESLint passes.
- Next.js production build passes.

