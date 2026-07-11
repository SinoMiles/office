# 对齐计划：聊天 → OfficeCLI 全链路对齐 AionUI

目标：把 OfficeWeb 的「用户发消息 → DeepSeek agent → 调 OfficeCLI 生成文件 → 流式回传 → 实时预览」整条链路，
在**用户可见语义**上对齐 AionUI（aionrs 平台），同时清掉聊天相关的死代码、修掉坏引用。定位：面向普通用户，
不做桌面端才有的权限弹窗 / ACP / MCP / 多 agent 后端。

## 已确认的两个方向决策
1. 实时预览：改用 AionUI 的 **officecli watch 实时服务**（SSE 热刷新），不再用「每批 view html 快照 + 换版本号重载 iframe」。
2. 删除范围：**清聊天相关死代码 + 修坏引用**；工具箱/兑换等非聊天功能不整删，但把坏引用安全处理。

## 两边核心差异（对齐依据）
AionUI（`platforms/aionrs/useAionrsMessage.ts`）的流事件语义：`start / thought / content(text) / tool_group(带每工具状态) / finish(带 token 用量) / error`；
运行态 = `waitingResponse || streamRunning || hasActiveTools`；刷新后按后端会话状态**水合**运行态；`thought` 有真事件才显示、done 后自动收起。
预览（`OfficeWatchViewer.tsx`）：起 `officecli watch <file> --port`，web 模式经 `/api/office-watch-proxy/{port}` 代理 iframe，靠 SSE DOM 热替换。
已核实：`WatchServer` 是纯 SSE 中继（从不打开文件），编辑文档的 ResidentServer（即我们 SDK `create/open/batch` 连的进程）每次改动后
`WatchNotifier.NotifyIfWatching(file, …)` 把渲染 HTML 推给 watch → 组合可行，我们的 batch 写入会被自动实时推送。

OfficeWeb 现状缺口：
- 无「思考(thought)」——`deepseek-agent.js` 丢弃了 DeepSeek 的 `reasoning_content`。
- 流事件命名零散（task/text_delta/tool/progress/preview/text/complete），且前端挂着服务端**从不发**的 `plan/thinking/status` 处理。
- 预览是每批快照重载，不是 watch 实时服务。
- 死代码：网页搜索面板(`searchData/activeSearchData`)无任何后端；`msg.html/htmlResult` 当前流程从不写入。
- 坏引用：兑换码按钮调 `/api/user/billing/redeem`（路由不存在，点了 404）。

## 实施分阶段

### 阶段 A — 统一流式契约（server + client）
把 SSE 事件对齐成 AionUI 语义的一套：`start / thought / content / tool / preview / finish / error / cancelled`。
- `lib/ai/deepseek-agent.js`：
  - 捕获 `delta.reasoning_content` → `onEvent({type:'thought', subject, description})`（有才发，节流~50ms，呼应 AionUI）。
  - 文本增量事件名 `text_delta` → 统一为 `content`（或保留别名，前端只认一套）。
  - 起始发 `start`，结束用量并入 `finish`。
- `app/api/process/route.js`：透传上述事件；`complete` 更名/合并为 `finish` 并带 `usage/cost/balance/artifact`；持久化 `runtime.thought`/`runtime.progress` 供刷新水合。
- `app/dashboard/page.js`：`handleEvent` 精简为这套事件；删除 `plan/thinking/status` 死分支；运行态改为 `waiting||streaming||toolsActive` 组合模型。

### 阶段 B — 思考(thought)展示
- 新增 `app/components/Thinking.js`（或并入 TaskProgress）：显示 subject+description，运行中转圈、done 自动收起，仅在收到过 thought 时渲染（对齐 `MessageThinking`）。
- 消息模型加 `thought` 字段，`content` 到达后把 thought 标记 done。

### 阶段 C — officecli watch 实时预览（核心）
- 新增 `lib/office/watch-manager.js`（global 单例，仿 `task-runtime.js`）：`startWatch(filePath)` 选空闲端口、spawn `officecli watch <file> --port <port>`（binary 复用 SDK 解析/自动安装路径）、探活后返回 port；按 taskId/filePath 注册；`stopWatch()`；空闲 TTL 回收。
- 新增代理路由 `app/api/tasks/[id]/watch/[[...path]]/route.js`：鉴权 + 归属校验，反向代理到 `127.0.0.1:{port}`，**透传 SSE**（text/event-stream、禁缓冲、流式 passthrough），对齐 AionUI 的 `/api/office-watch-proxy/{port}`。
- `lib/office/executor.js`：批处理前确保该文件的 watch 已起；发一次 `preview`（带 watch 代理 URL），不再每批 view html。仍在**完成时**快照一次 `view html` 到 `preview.html`（供历史/刷新兜底）。
- `app/api/process/route.js`：任务完成/失败/取消时 `stopWatch()`；完成后保留 `preview.html` 静态兜底。
- `app/dashboard/page.js` + 预览面板：进行中 iframe 指向 watch 代理 URL（SSE 自动刷新、无需换版本号）；历史/已完成任务用静态 `preview.html`（现有 `/preview` 路由）。`officecli` 缺失/端口超时时展示错误 + 服务端安装命令提示（对齐 `resolveOfficeErrorActions`）。

### 阶段 D — 刷新后水合运行态
- `/api/tasks/active` 已有；`dashboard` 恢复逻辑改为：进行中 → 恢复 thought/进度/watch 预览 URL；对齐 AionUI「按后端状态水合、消息补齐」而非仅显示末条。

### 阶段 E — 清死代码 + 修坏引用（聊天范围）
- 删：`searchData/activeSearchData` 搜索面板与相关 state/分支；`msg.html/htmlResult` 渲染路径；前端 `plan/thinking/status` 死处理；`react-syntax-highlighter` 的 `doc_script/officecli` 隐藏 hack（改由预览承载）。
- `models/Task.js`：移除永不写入的 `htmlResult` 字段。
- 修坏引用：兑换码 → 要么实现最小 `/api/user/billing/redeem` 路由，要么先隐藏兑换入口（避免 404）。**建议先隐藏入口**，把充值统一走管理员充值（现有）。
- 依赖清理：核对并移除确无引用的 `duck-duck-scrape`、`googlethis`（搜索删后应为死依赖）；`cheerio` 若仅 executor 用则保留。
- 工具箱(PDF/格式转换依赖未部署的 gotenberg)：**不整删**，但在 `/api/tools/convert` 无 gotenberg 时返回明确错误提示，避免静默 500。

### 阶段 F — 验证
- `npm run build` 通过；`npm run lint` 无新增错误。
- 手动/脚本冒烟：纯文本对话（无预览、有 thought）、生成 PPTX（watch 实时刷新）、续编已有文件、刷新中途水合、停止、历史回看。
- 更新 `.agents/research/` 审计与 `docs/implementation-plan.md` 状态。

## 风险 / 说明
- watch 子进程 + 端口在多并发/多用户下需要隔离与配额（已在 implementation-plan.md 列为 Pending 的 Isolation/Reliability），本轮做单节点可用版 + 空闲回收，规模化留后续。
- SSE 反向代理在 Next(node runtime) 用流式 passthrough 实现；注意禁用压缩/缓冲。
- 若线上模型不返回 `reasoning_content`，thought 面板自动不显示（与 AionUI「有真事件才显示」一致），不算回归。
