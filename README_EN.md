# dsh-scheduled-tasks

English | [简体中文](README.md)

A **scheduled-task plugin** for the [DeepSeek Harness (dsh)](https://deepseek.com) web sidebar: write what you want dsh to do as a task, set a time, and at the due time the plugin hands the task to the running dsh automatically.

## Features

- **Scheduling**: four repeat modes — once (specific time), daily, weekly (pick weekdays + time), and fixed interval (minimum 5 minutes).
- **Sidebar entry**: the entry button sits between the "New Session" button and the "Workspace" list in the sidebar; clicking it opens the task manager panel.
- **Task management**: create / edit / delete / enable / disable / run now, with the last 20 run records kept per task.
- **Bilingual UI (zh/en)**: follows the dsh language setting (`locale.preference` in `~/.dsh/settings.yaml`) — Chinese dsh gets a Chinese UI, English dsh gets English.
- **Local storage**: tasks are stored in `~/.dsh/scheduled-tasks.json`. Nothing is uploaded; no secrets involved.
- **Missed-run handling**: tasks missed while dsh was closed are not stale-fired on restart (a miss older than 6 hours is skipped and recorded).

## Install

Prerequisites: [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) and pnpm installed.

Install from npm:

```sh
dsh plugin --profile web add dsh-scheduled-tasks
```

**Restart `dsh web`** after installing; the "Scheduled Tasks" entry appears in the sidebar.

## Usage

1. Click "Scheduled Tasks" in the sidebar → "+ New task".
2. Fill in the task name and the task prompt (natural language; it is handed to dsh to execute at the due time).
3. Pick a repeat mode and time, then save.
4. When due, the plugin hands the task to the running dsh; check the dsh session for results.

> Note: scheduled tasks require dsh to be running. Tasks do not fire while dsh is closed.

## Uninstall

```sh
dsh plugin --profile web rm dsh-scheduled-tasks
```

## How it works

- The host half (a cordis plugin) registers `/dsh-scheduled-tasks/*` JSON routes and runs a lightweight in-process scheduler (15s tick).
- The client half injects the sidebar button and the manager panel via `window.__ModuleLoader__`.
- When a task fires, `lib/runner.js` hands the prompt to the running dsh (see source comments for details).

## Development

```sh
npm test   # smoke tests: exercises every route and the runner against stubs, no live dsh host needed
```

## License

MIT
