# dsh-scheduled-tasks

[English](README_EN.md) | 简体中文

一个 [DeepSeek Harness（dsh）](https://deepseek.com) Web 侧边栏的**定时任务插件**：把你想让 dsh 做的事情写成一条任务，设置好时间，到点它会自动把任务交给正在运行的 dsh 执行。

## 功能

- **定时执行**：支持四种重复方式——单次（指定时间）、每天、每周（选星期 + 时间）、固定间隔（最小 5 分钟）。
- **侧边栏入口**：入口按钮位于侧边栏「新会话」按钮和「工作区」列表之间，点击打开任务管理面板。
- **任务管理**：新建 / 编辑 / 删除 / 启用停用 / 立即运行，每个任务保留最近 20 次执行记录。
- **中英文界面**：自动跟随 dsh 语言设置（`~/.dsh/settings.yaml` 的 `locale.preference`）——dsh 是中文界面插件就是中文，英文界面就是英文。
- **本地存储**：任务保存在 `~/.dsh/scheduled-tasks.json`，不上传任何数据，不含任何密钥。
- **错峰补跑**：dsh 关闭期间错过的任务不会在重启后立刻陈旧补跑（超过 6 小时的错过直接跳过并记录）。

## 安装

前置条件：已安装 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) 与 pnpm。

发布到 npm 后（推荐）：

```sh
dsh plugin --profile web add dsh-scheduled-tasks
```

或从 GitHub 安装：

```sh
dsh plugin --profile web add github:<你的用户名>/dsh-scheduled-tasks
```

安装后**重启 `dsh web`**，侧边栏即可看到「定时任务」入口。

## 使用

1. 点击侧边栏「定时任务」→「+ 新建任务」。
2. 填写任务名称和任务内容（一段自然语言提示词，到点后会作为新任务交给 dsh 执行）。
3. 选择重复方式和时间，保存。
4. 到点后插件会把任务交给正在运行的 dsh；执行结果请在 dsh 会话中查看。

> 注意：定时任务依赖 dsh 保持运行。dsh 未运行时任务不会执行。

## 卸载

```sh
dsh plugin --profile web rm dsh-scheduled-tasks
```

## 工作原理

- 宿主端（cordis 插件）注册 `/dsh-scheduled-tasks/*` JSON 路由，并运行一个轻量进程内调度器（15 秒一跳）。
- 客户端通过 `window.__ModuleLoader__` 注入侧边栏按钮与管理面板。
- 任务触发后由 `lib/runner.js` 把提示词交给正在运行的 dsh（详见源码注释）。

## 开发

```sh
npm test   # 冒烟测试：桩环境下跑通全部路由与 runner，无需真实 dsh 宿主
```

## 许可

MIT
