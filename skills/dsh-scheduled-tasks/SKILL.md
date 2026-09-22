# dsh-scheduled-tasks 管理技能

当用户提到「定时任务」「计划任务」「scheduled tasks」或要求查看/创建/修改/删除定时任务时，使用本技能。

## 插件是什么

`dsh-scheduled-tasks` 是 dsh web 侧边栏的定时任务插件：到点把用户设置的自然语言提示词交给正在运行的 dsh 自动执行（新开会话跑完）。入口在侧边栏「新会话」和「工作区」之间。

## 数据与接口

- 任务存储：`~/.dsh/scheduled-tasks.json`（`{ "tasks": [...] }`）。
- 宿主端路由（dsh web 运行时，同源可 fetch）：
  - `GET  /dsh-scheduled-tasks/list` — 全部任务（含 nextRun、history）
  - `POST /dsh-scheduled-tasks/save` — 创建/更新，body：`{ id?, name, prompt, type: "once"|"daily"|"weekly"|"interval", at?(ISO), time?("HH:MM"), weekdays?([0-6],0=周日), intervalMinutes?(>=5), enabled? }`
  - `POST /dsh-scheduled-tasks/delete` — body：`{ id }`
  - `POST /dsh-scheduled-tasks/toggle` — body：`{ id }` 启用/停用
  - `POST /dsh-scheduled-tasks/run` — body：`{ id }` 立即运行
  - `GET  /dsh-scheduled-tasks/locale` — `{ lang: "zh"|"en" }`

## AI 可以怎么做

1. 用户口头描述任务时，帮用户构造 save 请求（可直接编辑 `~/.dsh/scheduled-tasks.json` 后提示重启，或建议用户在侧边栏面板里操作）。
2. 排查「任务没跑」时按序检查：任务 `enabled` 是否为 true → `lastStatus`/`history` 里的错误 → dsh 当时是否在运行 → 报错反推原因。
3. 任务类型语义：`once` 到点跑一次后自动停用；`daily`/`weekly` 按 `time`（本地时间）；`interval` 按 `intervalMinutes`（最小 5，锚定创建时刻）；错过超过 6 小时的任务标记 `skipped` 不补跑。
4. 执行结果：到点后 dsh 会**新开一个会话**执行 prompt；历史记录里保存了最后的 assistant 摘要（`history[].summary`）。

## 注意

- 不要把用户提示词以外的内容写进 `prompt`；prompt 是到点后发给 dsh 的完整任务描述。
- 密钥类信息不应放入任务。
