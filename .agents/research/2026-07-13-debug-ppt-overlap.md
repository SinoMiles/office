# PPT 内容重叠调查报告

**日期：** 2026-07-13  
**问题：** AionCore 生成的部分 PPT 存在标题重叠和文本溢出  
**紧急度：** 🟡 HIGH  
**状态：** 已定位，按要求暂不修改底层

## 症状与复现

- 检查文件：`storage/aioncore-data/conversations/2026/07/13/aionrs-temp-9c130a12/2026下半年AI赚钱项目.pptx`
- OfficeWeb 预览与下载后使用 PowerPoint 打开均出现重叠，排除网页 CSS、缩放和预览转换造成的显示偏差。
- 独立渲染全部 15 页后，可以稳定复现多页标题重叠。

## 根因

这不是 OfficeCLI 将单个对象错误渲染成两个对象，而是 AionCore Agent 向文件中实际写入了两个标题：

1. Agent 使用 `officecli add ... / --type slide --prop title="..."` 创建页面。该命令会创建原生标题占位框，例如第 10 页 `/slide[10]/shape[@id=2]`。
2. Agent 随后又使用 `officecli add ... '/slide[10]' --type shape --prop text="避坑指南 ｜ 谨慎进入的方向" ...` 在相同区域添加自定义标题框。
3. 两个对象坐标区域相交，因此网页预览和 PowerPoint 文件都显示双标题重叠。

Agent 本轮只调用了 `Skill(officecli)`，没有按照 OfficeCLI dispatcher 的规则执行 `officecli load_skill pptx`。完成前也只执行了 `view outline` 和 `ls`，没有执行 `view issues` 并将问题修复到 0。

## 验证证据

- `officecli validate` 返回通过，因为它检查的是 OOXML 结构合法性，不代表视觉布局正确。
- `officecli view ... issues --json` 检出 4 个问题，包括文字溢出以及第 12、13 页的遮挡。
- 第 10 页对象树直接显示原生标题 `shape[@id=2]` 与自定义标题 `shape[@id=100043]` 同时存在。
- 抽查另外三份年度述职 PPT，`view issues` 均为 0，说明 OfficeCLI 能生成无该问题的文件。
- 抽查另一份养老项目 PPT，检测到 52 个文字溢出问题，说明当前 Agent 未执行视觉 QA 的现象并非只发生一次。

## 结论

问题位于底层 AionCore Agent 的技能遵循和交付前 QA：Agent 没有加载 PPTX 专用技能，并重复创建标题对象，也没有根据 `view issues` 修正布局。OfficeWeb 只是展示底层生成的真实文件，不是重叠产生的位置。按照本次要求，暂不修改 AionCore、OfficeCLI 或 OfficeWeb。

## Issue Rating Table

| # | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort |
|---|---|---|---|---|---|---|---|
| 1 | Agent 同时创建原生标题和自定义标题 | 🟡 HIGH | 🟢 Medium | 🟡 High | 🟠 Excellent | 所有自动生成 PPT | Medium |
| 2 | Agent 未加载 `pptx` 专用技能 | 🟡 HIGH | 🟢 Medium | 🟡 High | 🟠 Excellent | 所有通用 PPT 任务 | Medium |
| 3 | 交付前未执行并清零 `view issues` | 🟡 HIGH | ⚪ Low | 🟡 High | 🟠 Excellent | 所有 Office 文件生成任务 | Small |
| 4 | `validate` 通过容易被误认为视觉质量合格 | 🟢 MEDIUM | ⚪ Low | 🟢 Medium | 🟢 Good | 所有 PPT QA 流程 | Small |

## 建议的底层后续方向

- 强制 OfficeCLI dispatcher 在 PPT 任务开始前加载 `pptx` 专用技能。
- PPTX 专用技能明确规定：使用 `slide.title` 与自定义标题二选一。
- 完成条件从“文件存在且 validate 通过”升级为“`view issues` 为 0，并完成逐页渲染检查”。
- AionCore 可在文件交付事件前增加 Office 质量门禁；发现严重 issue 时继续让 Agent 修复，而不是立即标记完成。
