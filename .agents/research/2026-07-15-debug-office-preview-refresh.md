# Office 预览刷新后丢失调查报告

**日期：** 2026-07-15  
**问题：** 页面刷新或恢复历史任务后，Office 预览返回“预览不存在”  
**紧急度：** 🟡 High  
**状态：** Fixed

## 症状

实时生成 Office 文件时右侧预览正常；刷新页面或重新打开历史任务后，iframe 请求静态预览接口并收到 `{"error":"预览不存在"}`。

## 根因

**What：** 历史恢复把持久化的 `outputFile` 错误映射到只支持 `previewFile` 的旧静态 HTML 接口。  
**Where：** `app/dashboard/page.js` 的活跃任务恢复和 `loadHistoryTask`；`app/api/tasks/[id]/office-preview/proxy/[[...path]]/route.js` 缺少 watcher 自愈。  
**Why：** 实时链路保存的是 Office 文件路径和进程内 watch 端口，而刷新恢复只重建了 UI 状态，没有像 AionUi 的 OfficeWatchViewer 一样重新 start watcher。

## 修复

| 文件 | 修改 |
| --- | --- |
| `app/dashboard/page.js` | `outputFile` 恢复到 Office watch proxy，只有 `previewFile` 才使用静态预览接口。 |
| `app/api/tasks/[id]/office-preview/proxy/[[...path]]/route.js` | watcher 不存在时，从已鉴权任务的持久化 `outputFile` 自动重新启动。 |
| `app/globals.css` | 统一页面与组件滚动条的宽度、圆角、颜色和悬停状态。 |

## 验证假设

| 假设 | 结果 | 证据 |
| --- | --- | --- |
| 静态预览文件刷新后被删除 | Denied | Office 实时任务从未设置 `previewFile`，并非删除导致。 |
| React 刷新丢失临时 URL | Partially confirmed | UI 状态会丢失，但任务已持久化 `outputFile`，可据此恢复。 |
| OfficeWeb 历史恢复接口选择错误 | Confirmed | `outputFile || previewFile` 统一指向 `/preview`，该接口只读取 `previewFile`。 |
| AionCore 无法恢复预览 | Denied | AionUi 通过持久化 file path 在 Viewer 挂载时重新调用 watch start。 |

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Office 历史预览使用了错误接口 | 🟡 High | ⚪ Low | 🟡 High | 🟠 Excellent | 所有 Office 生成任务 | Small |
| 2 | watch 端口只存在进程内且代理不能自愈 | 🟡 High | 🟢 Medium | 🟡 High | 🟠 Excellent | 刷新及服务重启后的全部实时预览 | Small |
| 3 | 各滚动区域缺少统一视觉样式 | ⚪ Low | ⚪ Low | 🟢 Medium | 🟢 Good | 全站可滚动区域 | Trivial |

## 预防

预览持久状态只保存文件标识/路径，不保存临时端口；所有 Viewer 应在挂载时通过服务端幂等 start 获取或恢复临时预览服务。
