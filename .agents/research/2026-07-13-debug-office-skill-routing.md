# Office 文件生成技能路由故障报告

## 结论

OfficeWeb 在会话配置中排除了 AionUi 默认自动注入的 OfficeCLI 总入口 `officecli`。随后尝试通过单轮 `inject_skills` 临时补回技能，但 AionCore 当前的临时技能发现链路并不完整，模型实际没有获得 OfficeCLI 指引，因此退回 `python-pptx`，并把 Python 脚本作为聊天正文输出。

## 证据

- 会话 `3f6959f3` 的运行记录明确写出没有直接创建 PPT 的工具，并随后调用 `ExecCommand` 检查 `python-pptx`。
- AionCore 已安装 `officecli-pptx`，其说明要求所有 PPT/PPTX、幻灯片和演示文稿任务使用该技能。
- AionUi 将 `officecli` 定义为 builtin auto-inject skill，正常会话无需前端判断用户意图或手工选择文件格式。
- `officecli` 自身是 dispatcher：它要求 Agent 在需要专业格式能力时通过 `load_skill` 加载相应专用技能。
- AionUi 自带的调研文档说明，单轮 `inject_skills` 尚未完整进入 workspace skill links 和 `allowed_skill_names`，不能作为可靠的主要路径。
- OfficeWeb 的会话级策略显式设置了 `exclude_auto_inject_skills: ['officecli']`，切断了上述默认链路。

## 修复

- 删除前端关键词识别与文件格式分支，不再由 OfficeWeb 猜测用户意图。
- 恢复 AionUi 默认的 OfficeCLI 自动注入和技能内部发现机制。
- 保留纯文字请求直接回答、明确文件请求才创建文件的 Agent 策略。
- 明确禁止用 Python 库或粘贴代码替代真实 Office 文件工作流。
- 增加格式路由回归测试。

## Issue Rating Table

| 问题 | 严重度 | 置信度 | 状态 |
| --- | --- | --- | --- |
| OfficeWeb 排除了默认 OfficeCLI 自动技能 | P1 | 高 | 已修复 |
| 单轮临时技能注入被当作主要技能发现路径 | P1 | 高 | 已移除 |
| 模型可用 Python 代码冒充文件生成结果 | P1 | 高 | 已增加硬性策略约束 |
| 不同文件格式缺少独立路由测试 | P2 | 高 | 已补充测试 |
