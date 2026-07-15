# 多文件预览架构对照说明

## 结论

OfficeWeb 当前以单个 `activeArtifact` 和每个 Task 单个 `outputFile` 建模，因此新文件会覆盖当前预览状态，历史恢复也只能选择一个文件。AionUi 使用独立 Preview Workspace：一个文件对应一个 Preview Tab，以 `file_path` 作为首选身份，同一路径更新复用 Tab，不同路径并存。

## AionUi 关键组件

| 组件 | 职责 | 位置 |
| --- | --- | --- |
| `PreviewContext` | 管理 tabs、activeTabId、打开、切换、关闭、去重 | `packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx` |
| `PreviewPanel` | 渲染 Tab 栏和当前文件 Viewer | `packages/desktop/src/renderer/pages/conversation/Preview/components/PreviewPanel/PreviewPanel.tsx` |
| `useAutoPreviewOfficeFiles` | 监听当前 workspace 新文件并打开对应 Tab | `packages/desktop/src/renderer/hooks/file/useAutoPreviewOfficeFiles.ts` |
| `OfficeWatchViewer` | Viewer 挂载时根据 file_path/workspace 启动 watch | `packages/desktop/src/renderer/pages/conversation/Preview/components/viewers/OfficeWatchViewer.tsx` |
| Conversation index | 切换会话时关闭预览，防止跨会话残留 | `packages/desktop/src/renderer/pages/conversation/index.tsx` |

## 数据流

1. 当前 workspace 出现 Office 文件。
2. AionCore 发出 `workspaceOfficeWatch.fileAdded`。
3. 自动预览 Hook 通过 `file_path` 判断是否已知文件。
4. `openPreview` 优先按完整路径查找 Tab；存在则更新并激活，不存在则创建。
5. Viewer 挂载后用持久化路径重新启动 watch，临时端口不进入持久数据。
6. 切换历史会话时关闭 Preview Panel；历史文件由消息文件入口或 Workspace 文件树重新打开。

## AionUi Desktop 与 WebUI

WebUI 由 `web-host` 托管同一套编译后的 SPA renderer，并代理 AionCore API、WebSocket 和 Office watch。桌面版增加 Electron、本地系统打开、原生文件等能力；核心 PreviewContext、Tab UI 和 Viewer 逻辑是共享的，不是两套独立预览产品。

## OfficeWeb 建议

- 将单个 `activeArtifact` 改为当前会话的 `artifacts[] + activeArtifactId`。
- 消息下方展示属于该轮的文件卡片；点击后打开/切换右侧 Tab。
- 进入历史会话默认关闭预览，只恢复文件清单，不自动打开最后一个文件。
- 运行中新生成文件可以自动打开，并自动折叠左侧导航。
- 文件身份使用服务端 artifact id；`filePath` 用于同一文件版本归并，不以文件名作为唯一键。
- 将 watcher key 从 taskId 升级为 artifactId/file identity，支持同一轮多个文件并行预览。
- 长期增加独立 Artifact 模型，记录 conversationId、taskId/turnId、filePath、filename、type、version、createdAt、status。

## 边界情况

| 场景 | 推荐行为 |
| --- | --- |
| 同一路径持续修改 | 保留一个 Tab，实时更新 |
| 同名但不同路径 | 两个独立 Artifact/Tab |
| 一轮生成 PPT 和 Excel | 两个文件卡片和两个 Tab |
| 切换会话 | 清空当前 Preview Tabs，避免串会话 |
| 刷新页面 | 恢复文件清单；用户点击后根据路径自愈 watcher |
| 文件已删除 | 文件卡片显示不可用，不自动切换到其他文件 |

## Quick Reference

**OfficeWeb 修改入口：** `models/Task.js`、`app/hooks/useAioncoreChat.js`、`app/dashboard/page.js`、Office preview API。  
**参考核心：** AionUi `PreviewContext.tsx` 的 file_path identity 和 tabs/activeTabId。  
**测试重点：** 多文件去重、同名不同路径、会话切换、刷新恢复、watcher 并发。
