# AionUi WebUI 与 OfficeWeb 架构对照

## 结论

“AionUi 的 renderer 直接绑定 Electron IPC 和 SQLite，所以 OfficeWeb 必须直接处理 9123 的 WebSocket 裸流并重写整套状态管理”这一判断不准确，且遗漏了 AionUi 已存在的纯 WebUI 实现。

AionUi 当前架构已经把大部分业务能力改造成 AionCore REST + WebSocket：同一套 renderer 在 Electron 中可使用 IPC 处理桌面原生能力，在浏览器 WebUI 中则通过同源 HTTP、`/ws` 反向代理和适配层运行。OfficeWeb 确实有自己的产品页面、账户、计费、任务与文档预览需求，不能简单复制整个 AionUi；但聊天会话、实时事件、运行态、消息合并、重连和错误处理应优先参考或抽取 AionUi 的现有实现，而不是平行重写。

## 原说法逐项判定

| 说法 | 判定 | 证据 |
|---|---|---|
| AionUi 原始形态是 Electron 桌面应用 | 部分正确 | 项目仍包含 Electron 壳和桌面原生功能，但已有不启动 Electron 的独立 WebUI CLI。 |
| `conversationRuntimeViewStore.ts` 直接绑定 Electron IPC | 错误 | 该文件是纯内存状态机，只导入存储类型，不导入 Electron、IPC 或 SQLite。 |
| AionUi 状态层重度依赖 SQLite 双向同步，浏览器无法复用 | 误导 | SQLite 位于 AionCore 后端；renderer 通过 REST 读取会话/消息，通过 WS 接收实时事件。浏览器不直接访问 SQLite。 |
| OfficeWeb 必须直接接 9123 WebSocket | 当前实现如此，但不是唯一方案 | OfficeWeb 硬编码 `ws://127.0.0.1:9123/ws`；AionUi WebUI 使用同源 `/api/*` 与 `/ws` 代理，更适合远程浏览器、HTTPS、认证和部署。 |
| 高频 token 需要清洗、节流和合并 | 正确 | 流式增量确实需要归并；AionUi 已有按消息类型处理和 50ms thought throttle，OfficeWeb 又写了一套 RAF 队列。 |
| 因此必须自己重写整套 Reducer | 错误 | 技术需求存在，但 AionUi 已有可参考的 bridge、runtime store、message hooks、历史分页和重连恢复逻辑。 |

## 关键组件

| 组件 | 作用 | 位置 |
|---|---|---|
| WebUI CLI | 不启动 Electron，启动静态站点、AionCore、认证和持久化 | `AionUi/scripts/webui.ts` |
| HTTP/WS bridge | 为 renderer 提供与旧 bridge 相同的接口形状 | `AionUi/packages/desktop/src/common/adapter/httpBridge.ts` |
| IPC bridge facade | 会话、消息、数据库读取实际映射到 REST/WS；仅原生能力保留 IPC | `AionUi/packages/desktop/src/common/adapter/ipcBridge.ts` |
| Browser adapter | 浏览器中用 WebSocket 替代 Electron preload/IPC，含认证与重连 | `AionUi/packages/desktop/src/common/adapter/browser.ts` |
| Runtime view store | 与传输和数据库无关的会话运行态状态机 | `AionUi/packages/desktop/src/renderer/pages/conversation/runtime/conversationRuntimeViewStore.ts` |
| Aionrs message hook | 消费 `message.stream`，处理 thought、工具、完成和错误 | `AionUi/packages/desktop/src/renderer/pages/conversation/platforms/aionrs/useAionrsMessage.ts` |
| OfficeWeb chat hook | 直接连接 9123，自行进行 RAF 批处理和消息归并 | `OfficeWeb/app/hooks/useAioncoreChat.js` |

## 实际数据流

### AionUi WebUI

Browser renderer → 同源 REST `/api/conversations/...` → web-host 反向代理 → AionCore → SQLite

Browser renderer ← 同源 WebSocket `/ws` ← web-host 转发 ← AionCore 实时事件

renderer 通过 `ipcBridge` facade 调用，因此多数 UI 代码不关心底层究竟是 Electron IPC 还是 HTTP/WS。

### OfficeWeb 当前实现

Next.js 页面 → OfficeWeb API route → `http://127.0.0.1:9123/api/...` → AionCore

浏览器页面 → 硬编码 `ws://127.0.0.1:9123/ws` → AionCore

`useAioncoreChat` 收到 `message.stream` 后按帧批处理，再自行合并 text/thinking/tool 消息，并再次映射成 OfficeWeb UI 数据。

## 现有 OfficeWeb 实现的具体风险

1. `useEffect` 依赖 `conversationId`，而事件回调会修改 `conversationId`，可能导致 WebSocket 反复断开重建。
2. 浏览器硬编码 `127.0.0.1:9123` 意味着远程访问时连接的是访客自己的电脑，而不是部署 OfficeWeb 的服务器；HTTPS 页面还会遇到 mixed-content 限制。
3. 发送队列在 socket 尚未 OPEN 时直接丢消息；AionUi browser adapter 有待发送队列和重连后 flush。
4. OfficeWeb 客户端主动每 30 秒发送 `ping`，而 AionUi 的 browser adapter 展示的协议是服务端发 `ping`、客户端回 `pong`；需以 AionCore协议为准，不能假定两者等价。
5. 每个 `message.stream` 都额外 POST `/api/debug`，高频 token 下会制造额外 HTTP 流量和服务器 I/O。
6. permission 事件被无条件 `proceed_always` 自动批准，属于明显的安全/产品语义偏差；AionUi 有正式 confirmation UI/API 流程。
7. `findIndex` 在每个碎片上扫描整个消息数组，长会话下成本会上升；AionUi 的现成消息 hooks 和 store 更值得参考。
8. OfficeWeb 的消息类型映射与 AionCore协议并行演进，后端新增 terminal/error/tool 类型时容易出现 spinner 卡住或内容覆盖，这从其近期多次 streaming 修复提交也能看出。

## 建议

不建议把 OfficeWeb 整体改造成 AionUi WebUI。OfficeWeb 的营销页、登录注册、用户管理、计费、任务下载和 Office 预览属于独立产品边界，应保留 Next.js 架构。

建议把“AI 会话内核”按 AionUi 当前 WebUI 实现对齐：

1. 以 AionUi 的 `httpBridge.ts`、`ipcBridge.ts`、browser adapter 和 message hooks 为事实参考。
2. 在 OfficeWeb 服务端建立同源 `/api/aioncore/*` 与 `/ws` 代理，浏览器不再直连硬编码的 9123。
3. 抽取或移植协议类型、运行态状态机、消息归并规则与 reconnect/resync 行为，而不是复制 AionUi 整个 UI。
4. 保留 OfficeWeb 自己的展示模型，但将“传输事件 → 规范化领域消息”放入独立、带测试的 adapter/reducer，页面 hook 只消费稳定状态。
5. 删除生产流中的逐 token `/api/debug` 写入，并恢复显式权限确认。

## Quick Reference

要理解 AionUi WebUI 入口，从 `AionUi/scripts/webui.ts` 开始。

要理解浏览器如何摆脱 Electron IPC，看 `AionUi/packages/desktop/src/common/adapter/httpBridge.ts`、`ipcBridge.ts` 和 `browser.ts`。

要修改 OfficeWeb 当前流式实现，从 `OfficeWeb/app/hooks/useAioncoreChat.js` 开始；首先处理同源代理、连接生命周期和协议归并边界。
