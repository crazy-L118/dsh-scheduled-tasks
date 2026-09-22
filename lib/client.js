window.__ModuleLoader__.load({
  id: "dsh-scheduled-tasks",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    /** Host route base (same origin). */
    const BASE = "/dsh-scheduled-tasks";

    /** Supported UI languages. */
    const I18N = {
      zh: {
        entryLabel: "定时任务",
        entryAriaLabel: "定时任务（到点自动让 dsh 执行你设置的任务）",
        title: "定时任务",
        subtitle: "到点自动把任务交给 dsh 执行",
        add: "+ 新建任务",
        noTasks: "还没有定时任务，点「+ 新建任务」创建一个吧。",
        name: "任务名称",
        namePlaceholder: "例如：每天早上整理工作区",
        prompt: "任务内容（发给 dsh 的提示词）",
        promptPlaceholder: "例如：检查工作区里未完成的 todo，把进度整理成一条消息发给我。",
        type: "重复方式",
        typeOnce: "单次（指定时间）",
        typeDaily: "每天",
        typeWeekly: "每周",
        typeInterval: "固定间隔",
        at: "执行时间",
        time: "执行时间",
        weekdays: "星期",
        intervalMinutes: "间隔（分钟，最小 5）",
        week: ["日", "一", "二", "三", "四", "五", "六"],
        nextRun: "下次执行",
        lastRun: "上次执行",
        lastStatus: "状态",
        status_ok: "成功",
        status_failed: "失败",
        status_skipped: "已跳过",
        status_running: "执行中…",
        status_never: "还没跑过",
        enabled: "启用",
        disabled: "已停用",
        runNow: "立即运行",
        edit: "编辑",
        remove: "删除",
        save: "保存",
        cancel: "取消",
        close: "关闭",
        confirmRemove: "确定删除这个定时任务？",
        saveFailed: "保存失败：{0}",
        runStarted: "已开始执行，结果请到 dsh 会话里看哦",
        runBusy: "有任务正在执行，稍后再试",
        history: "最近记录",
        noHistory: "还没有执行记录",
        days: "天",
        error: "错误",
        runnerBusyNote: "一个任务正在执行中…",
        execNote: "任务到点后会在 dsh 里自动执行；执行结果请到对应会话查看。dsh 需要保持运行。",
        datetimeLocal: "选择日期和时间",
        model: "执行模型",
        modelDefault: "跟随 dsh 默认",
        modelBadge: "模型",
        approval: "审批策略",
        approvalDefault: "跟随 dsh 默认",
        approvalAsk: "ask · 危险操作先询问",
        approvalNever: "never · 自动允许（无人值守推荐）",
        approvalBadge: "权限"
      },
      en: {
        entryLabel: "Scheduled Tasks",
        entryAriaLabel: "Scheduled Tasks (dsh runs your task at the set time)",
        title: "Scheduled Tasks",
        subtitle: "Hand a prompt to dsh automatically at the set time",
        add: "+ New task",
        noTasks: "No scheduled tasks yet. Click '+ New task' to create one.",
        name: "Task name",
        namePlaceholder: "e.g. Tidy up the workspace every morning",
        prompt: "Task prompt (sent to dsh)",
        promptPlaceholder: "e.g. Check unfinished todos in the workspace and send me a progress summary.",
        type: "Repeat",
        typeOnce: "Once (specific time)",
        typeDaily: "Daily",
        typeWeekly: "Weekly",
        typeInterval: "Fixed interval",
        at: "Run at",
        time: "Run at",
        weekdays: "Weekdays",
        intervalMinutes: "Interval (minutes, min 5)",
        week: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        nextRun: "Next run",
        lastRun: "Last run",
        lastStatus: "Status",
        status_ok: "Success",
        status_failed: "Failed",
        status_skipped: "Skipped",
        status_running: "Running…",
        status_never: "Never ran",
        enabled: "Enabled",
        disabled: "Disabled",
        runNow: "Run now",
        edit: "Edit",
        remove: "Delete",
        save: "Save",
        cancel: "Cancel",
        close: "Close",
        confirmRemove: "Delete this scheduled task?",
        saveFailed: "Save failed: {0}",
        runStarted: "Started. Check the dsh session for the result.",
        runBusy: "A task is already running, try again later",
        history: "Recent runs",
        noHistory: "No runs yet",
        days: "days",
        error: "Error",
        runnerBusyNote: "A task is running…",
        execNote: "Tasks run automatically inside dsh at the set time; check the session for results. Keep dsh running.",
        datetimeLocal: "Pick date and time",
        model: "Model",
        modelDefault: "Follow dsh default",
        modelBadge: "Model",
        approval: "Approval policy",
        approvalDefault: "Follow dsh default",
        approvalAsk: "ask · ask before risky operations",
        approvalNever: "never · auto-approve (recommended for unattended)",
        approvalBadge: "Approval"
      }
    };

    let currentLang = "zh";
    function t(key, ...args) {
      const dict = I18N[currentLang] || I18N.zh;
      let text = dict[key];
      if (text === void 0) text = I18N.zh[key] ?? key;
      if (args.length && typeof text === "string") {
        text = text.replace(/\{(\d+)\}/g, (_, n) => String(args[Number(n)] ?? ""));
      }
      return text;
    }

    /** Inline icon (calendar/clock, matches the shell's 16px nav look). */
    const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3M8 9v2.5l1.8 1"/></svg>';

    /* --------------------------------------------------------- styles */

    function ensureStyle() {
      const tagId = "dsh-scheduled-tasks-css";
      if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
      const css = [
        ".dshTaskEntry{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:8px;align-items:center;gap:10px;padding:9px 12px;display:flex;transition:background .14s}",
        ".dshTaskEntry:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))}",
        ".dshTaskIcon{color:var(--dsw-alias-label-secondary,#9aa4b2);flex:none;display:flex}",
        ".dshTaskLabel{color:var(--dsw-alias-label-primary,#e6e9ef);font-size:14px;font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".dshTaskCount{color:var(--dsw-alias-label-tertiary,#7b8494);font-size:12px;font-variant-numeric:tabular-nums;flex:none}",
        ".dshTaskOverlay{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:13px}",
        ".dshTaskPanel{width:min(680px,calc(100vw - 32px));max-height:min(80vh,720px);overflow-y:auto;box-sizing:border-box;background:#1b1f27;border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.55);padding:18px 20px;color:#e6e9ef;line-height:1.5}",
        ".dshTaskPanel h3{margin:0;font-size:16px;font-weight:600}",
        ".dshTaskPanelSub{margin:2px 0 0;font-size:12px;color:#7b8494}",
        ".dshTaskHead{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}",
        ".dshTaskHeadBtns{margin-left:auto;display:flex;gap:8px;flex:none}",
        ".dshTaskBtn{appearance:none;cursor:pointer;background:#2d333b;color:#e6e9ef;border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:5px 12px;font:inherit;font-size:12px;white-space:nowrap}",
        ".dshTaskBtn:hover{background:#363d47}",
        ".dshTaskBtn[data-variant=primary]{background:#2563eb;border-color:#2563eb}",
        ".dshTaskBtn[data-variant=primary]:hover{background:#1d4ed8}",
        ".dshTaskBtn[data-variant=danger]{color:#f85149}",
        ".dshTaskBtn:disabled{cursor:not-allowed;opacity:.5}",
        ".dshTaskClose{appearance:none;cursor:pointer;background:transparent;border:0;color:#7b8494;font-size:20px;line-height:1;padding:2px 6px;border-radius:6px}",
        ".dshTaskClose:hover{color:#f85149;background:rgba(248,81,73,.1)}",
        ".dshTaskEmpty{padding:28px 0;text-align:center;color:#7b8494;font-size:13px}",
        ".dshTaskItem{border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;margin-bottom:10px}",
        ".dshTaskItemHead{display:flex;align-items:center;gap:8px}",
        ".dshTaskItemName{font-size:14px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".dshTaskBadge{font-size:11px;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,.08);color:#9aa4b2;white-space:nowrap;flex:none}",
        ".dshTaskBadge[data-state=ok]{background:rgba(35,197,94,.12);color:#3fb950}",
        ".dshTaskBadge[data-state=failed]{background:rgba(248,81,73,.12);color:#f85149}",
        ".dshTaskBadge[data-state=running]{background:rgba(210,153,34,.15);color:#d29922}",
        ".dshTaskBadge[data-state=off]{background:transparent;color:#5b626a;border:1px solid rgba(255,255,255,.1)}",
        ".dshTaskMeta{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:6px;font-size:12px;color:#9aa4b2}",
        ".dshTaskMeta b{color:#c9d1d9;font-weight:500;font-variant-numeric:tabular-nums}",
        ".dshTaskPrompt{margin-top:6px;font-size:12px;color:#7b8494;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".dshTaskItemBtns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}",
        ".dshTaskForm{border-top:1px solid rgba(255,255,255,.08);margin-top:6px;padding-top:14px;display:flex;flex-direction:column;gap:10px}",
        ".dshTaskField{display:flex;flex-direction:column;gap:4px}",
        ".dshTaskField>label{font-size:11px;color:#9aa4b2}",
        ".dshTaskInput,.dshTaskTextarea,.dshTaskSelect{background:#0f1216;border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#e6e9ef;font:inherit;font-size:13px;padding:7px 9px;width:100%;box-sizing:border-box}",
        ".dshTaskTextarea{min-height:88px;resize:vertical}",
        ".dshTaskInput:focus,.dshTaskTextarea:focus,.dshTaskSelect:focus{outline:none;border-color:#58a6ff}",
        ".dshTaskRow{display:flex;gap:10px;flex-wrap:wrap}",
        ".dshTaskRow .dshTaskField{flex:1;min-width:140px}",
        ".dshTaskWeek{display:flex;gap:4px;flex-wrap:wrap}",
        ".dshTaskWeekBtn{appearance:none;cursor:pointer;background:#0f1216;border:1px solid rgba(255,255,255,.14);color:#9aa4b2;border-radius:6px;padding:4px 9px;font:inherit;font-size:12px}",
        ".dshTaskWeekBtn[data-on=true]{background:#2563eb;border-color:#2563eb;color:#fff}",
        ".dshTaskFormBtns{display:flex;gap:8px;justify-content:flex-end}",
        ".dshTaskHint{font-size:11px;color:#5b626a;line-height:1.5;margin-top:8px}",
        ".dshTaskHist{margin-top:6px;font-size:11px;color:#7b8494;display:flex;flex-direction:column;gap:2px}",
        ".dshTaskToast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10001;background:#1b1f27;color:#e6e9ef;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:9px 16px;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5)}",
        ".dshTaskToast[data-state=err]{border-color:rgba(248,81,73,.4);color:#f85149}"
      ].join("");
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-scheduled-tasks";
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /* ------------------------------------------------------- helpers */

    function escapeHtml(s) {
      return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    /** Format an ISO timestamp (UTC) in the browser's local time: "YYYY-MM-DD HH:MM". */
    function fmtLocal(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso ?? "");
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    /** Short local time for history lines: "MM-DD HH:MM". */
    function fmtLocalShort(iso) {
      return fmtLocal(iso).slice(5, 16);
    }

    async function api(path, options) {
      try {
        const res = await fetch(BASE + path, { headers: { Accept: "application/json", ...(options?.body ? { "content-type": "application/json" } : {}) }, ...options });
        return await res.json();
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    /** Authoritative language: host reads ~/.dsh/settings.yaml locale.preference. */
    async function pollDshLang() {
      try {
        const env = await api("/locale");
        if (env && env.ok && (env.lang === "en" || env.lang === "zh")) {
          if (env.lang !== currentLang) {
            currentLang = env.lang;
            refreshEntryMeta();
            if (panelRef !== null) renderPanel();
          }
        }
      } catch { /* keep current */ }
    }

    function toast(message, isError) {
      document.querySelectorAll(".dshTaskToast").forEach((el) => el.remove());
      const el = document.createElement("div");
      el.className = "dshTaskToast";
      if (isError) el.dataset.state = "err";
      el.textContent = message;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }

    /** Type badge label, localized. */
    function typeLabel(task) {
      if (task.type === "once") {
        return t("typeOnce") + " " + fmtLocal(task.at);
      }
      if (task.type === "daily") return t("typeDaily") + " " + (task.time || "");
      if (task.type === "weekly") {
        const week = I18N[currentLang].week;
        const days = (task.weekdays || []).map((d) => week[d] ?? d).join("/");
        return t("typeWeekly") + " " + days + " " + (task.time || "");
      }
      if (task.type === "interval") return t("typeInterval") + " " + task.intervalMinutes + "min";
      return task.type;
    }

    function statusOf(task) {
      if (task.running) return "running";
      if (task.enabled === false) return "off";
      if (!task.lastStatus) return "never";
      return task.lastStatus;
    }

    /* ------------------------------------------------- sidebar entry */

    let taskCount = 0;

    /** Cached model catalog for the per-task model dropdown. */
    let modelCatalog = null;

    async function fetchModelCatalog() {
      if (modelCatalog !== null) return modelCatalog;
      const env = await api("/models");
      if (env && env.ok) {
        modelCatalog = { groups: Array.isArray(env.groups) ? env.groups : [], default: env.default };
      } else {
        modelCatalog = { groups: [], default: undefined };
      }
      return modelCatalog;
    }

    function sidebarRoot() {
      const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
      if (column === null) return void 0;
      return column.querySelector('[class*="logoRow"]')?.parentElement ?? column.firstElementChild;
    }

    /** The New Session button: nested in the logo row on current shells. */
    function newSessionButton(root) {
      const nested = root.querySelector("button[class*=\"newSession\"]");
      if (nested !== null) return nested;
      for (const child of root.children) if (child.tagName === "BUTTON") return child;
    }

    function createEntry() {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.dataset.dshTaskEntry = "";
      entry.className = "dshTaskEntry";
      entry.setAttribute("aria-label", t("entryAriaLabel"));
      entry.addEventListener("click", () => { openPanel(); });
      entry.innerHTML =
        '<span class="dshTaskIcon">' + ICON + "</span>" +
        '<span class="dshTaskLabel">' + escapeHtml(t("entryLabel")) + "</span>" +
        '<span class="dshTaskCount"></span>';
      return entry;
    }

    /** Insert the entry between the New Session row and the Workspace list. */
    function placeEntry() {
      const root = sidebarRoot();
      if (root === void 0 || root === null) return false;
      let entry = root.querySelector("[data-dsh-task-entry]");
      const button = newSessionButton(root);
      if (button === void 0) return false;
      if (entry === null) {
        entry = createEntry();
        const row = button.closest('[class*="logoRow"]');
        const base = row !== null && row.parentElement === root ? row : button;
        const anchor = base.nextElementSibling ?? null;
        root.insertBefore(entry, anchor);
      } else if (entry.parentElement !== root) {
        entry.remove();
        root.appendChild(entry);
      }
      refreshEntryMeta();
      return true;
    }

    function refreshEntryMeta() {
      const entry = document.querySelector("[data-dsh-task-entry]");
      if (!entry) return;
      const label = entry.querySelector(".dshTaskLabel");
      if (label) label.textContent = t("entryLabel");
      entry.setAttribute("aria-label", t("entryAriaLabel"));
      const count = entry.querySelector(".dshTaskCount");
      if (count) count.textContent = taskCount > 0 ? String(taskCount) : "";
    }

    /* ------------------------------------------------------- panel UI */

    let panelRef = null;
    let tasks = [];
    /** When non-null, the add/edit form is open with this draft. */
    let formState = null;

    async function openPanel() {
      if (panelRef !== null) return;
      const overlay = document.createElement("div");
      overlay.className = "dshTaskOverlay";
      overlay.dataset.dshTaskPanel = "";
      overlay.addEventListener("click", (e) => { if (e.target === overlay) closePanel(); });
      document.body.appendChild(overlay);
      panelRef = overlay;
      renderPanel();
      await refreshTasks();
    }

    function closePanel() {
      if (panelRef !== null) { panelRef.remove(); panelRef = null; }
      formState = null;
    }

    async function refreshTasks() {
      const env = await api("/list");
      if (env && env.ok && Array.isArray(env.tasks)) {
        tasks = env.tasks;
        taskCount = tasks.filter((x) => x.enabled !== false).length;
        refreshEntryMeta();
        if (panelRef !== null) renderPanel();
      }
    }

    function renderPanel() {
      const overlay = panelRef;
      if (overlay === null) return;
      overlay.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "dshTaskPanel";

      // Header.
      const head = document.createElement("div");
      head.className = "dshTaskHead";
      head.innerHTML =
        "<div><h3>" + escapeHtml(t("title")) + "</h3>" +
        '<p class="dshTaskPanelSub">' + escapeHtml(t("subtitle")) + "</p></div>";
      const headBtns = document.createElement("div");
      headBtns.className = "dshTaskHeadBtns";
      const addBtn = document.createElement("button");
      addBtn.className = "dshTaskBtn";
      addBtn.dataset.variant = "primary";
      addBtn.textContent = t("add");
      addBtn.addEventListener("click", () => { formState = emptyDraft(); renderPanel(); });
      const closeBtn = document.createElement("button");
      closeBtn.className = "dshTaskClose";
      closeBtn.setAttribute("aria-label", t("close"));
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", closePanel);
      headBtns.appendChild(addBtn);
      headBtns.appendChild(closeBtn);
      head.appendChild(headBtns);
      panel.appendChild(head);

      // Add/edit form.
      if (formState !== null) panel.appendChild(buildForm());

      // Task list.
      if (tasks.length === 0 && formState === null) {
        const empty = document.createElement("div");
        empty.className = "dshTaskEmpty";
        empty.textContent = t("noTasks");
        panel.appendChild(empty);
      }
      for (const task of tasks) panel.appendChild(buildTaskItem(task));

      const hint = document.createElement("p");
      hint.className = "dshTaskHint";
      hint.textContent = t("execNote");
      panel.appendChild(hint);

      overlay.appendChild(panel);
    }

    function emptyDraft() {
      return {
        id: null, name: "", prompt: "", type: "once",
        at: toLocalInputValue(Date.now() + 30 * 60000),
        time: "09:00", weekdays: [1, 2, 3, 4, 5], intervalMinutes: 60,
        modelProvider: "", modelModel: "",
        approval: "",
        enabled: true
      };
    }

    /** datetime-local needs "YYYY-MM-DDTHH:MM" in local time. */
    function toLocalInputValue(ms) {
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function buildForm() {
      const draft = formState;
      const form = document.createElement("div");
      form.className = "dshTaskForm";

      const nameField = document.createElement("div");
      nameField.className = "dshTaskField";
      nameField.innerHTML = "<label>" + escapeHtml(t("name")) + "</label>";
      const nameInput = document.createElement("input");
      nameInput.className = "dshTaskInput";
      nameInput.placeholder = t("namePlaceholder");
      nameInput.value = draft.name;
      nameInput.addEventListener("input", () => { draft.name = nameInput.value; });
      nameField.appendChild(nameInput);
      form.appendChild(nameField);

      const promptField = document.createElement("div");
      promptField.className = "dshTaskField";
      promptField.innerHTML = "<label>" + escapeHtml(t("prompt")) + "</label>";
      const promptInput = document.createElement("textarea");
      promptInput.className = "dshTaskTextarea";
      promptInput.placeholder = t("promptPlaceholder");
      promptInput.value = draft.prompt;
      promptInput.addEventListener("input", () => { draft.prompt = promptInput.value; });
      promptField.appendChild(promptInput);
      form.appendChild(promptField);

      // Type select.
      const row = document.createElement("div");
      row.className = "dshTaskRow";
      const typeField = document.createElement("div");
      typeField.className = "dshTaskField";
      typeField.innerHTML = "<label>" + escapeHtml(t("type")) + "</label>";
      const typeSelect = document.createElement("select");
      typeSelect.className = "dshTaskSelect";
      for (const [value, key] of [["once", "typeOnce"], ["daily", "typeDaily"], ["weekly", "typeWeekly"], ["interval", "typeInterval"]]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = t(key);
        if (draft.type === value) opt.selected = true;
        typeSelect.appendChild(opt);
      }
      typeSelect.addEventListener("change", () => { draft.type = typeSelect.value; renderPanel(); });
      typeField.appendChild(typeSelect);
      row.appendChild(typeField);

      // Schedule value per type.
      if (draft.type === "once") {
        row.appendChild(timeField("datetime-local", t("at"), draft.at, (v) => { draft.at = v; }));
      } else if (draft.type === "interval") {
        row.appendChild(timeField("number", t("intervalMinutes"), draft.intervalMinutes, (v) => { draft.intervalMinutes = Number(v); }, { min: 5, step: 1 }));
      } else {
        row.appendChild(timeField("time", t("time"), draft.time, (v) => { draft.time = v; }));
      }
      form.appendChild(row);

      // Weekday picker for weekly.
      if (draft.type === "weekly") {
        const weekField = document.createElement("div");
        weekField.className = "dshTaskField";
        weekField.innerHTML = "<label>" + escapeHtml(t("weekdays")) + "</label>";
        const weekRow = document.createElement("div");
        weekRow.className = "dshTaskWeek";
        const week = I18N[currentLang].week;
        for (let d = 0; d < 7; d++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "dshTaskWeekBtn";
          btn.textContent = week[d];
          btn.dataset.on = draft.weekdays.includes(d) ? "true" : "false";
          btn.addEventListener("click", () => {
            const idx = draft.weekdays.indexOf(d);
            if (idx >= 0) draft.weekdays.splice(idx, 1);
            else draft.weekdays.push(d);
            btn.dataset.on = draft.weekdays.includes(d) ? "true" : "false";
          });
          weekRow.appendChild(btn);
        }
        weekField.appendChild(weekRow);
        form.appendChild(weekField);
      }

      // Model select (per-task override; "" = follow dsh default).
      const modelField = document.createElement("div");
      modelField.className = "dshTaskField";
      modelField.innerHTML = "<label>" + escapeHtml(t("model")) + "</label>";
      const modelSelect = document.createElement("select");
      modelSelect.className = "dshTaskSelect";
      const currentValue = draft.modelProvider && draft.modelModel ? draft.modelProvider + "/" + draft.modelModel : "";
      const defOpt = document.createElement("option");
      defOpt.value = "";
      const defName = modelCatalog?.default ? t("modelDefault") + "（" + modelCatalog.default.provider + "/" + modelCatalog.default.model + "）" : t("modelDefault");
      defOpt.textContent = defName;
      if (!currentValue) defOpt.selected = true;
      modelSelect.appendChild(defOpt);
      for (const group of (modelCatalog?.groups ?? [])) {
        const og = document.createElement("optgroup");
        og.label = group.name;
        for (const m of group.models) {
          const opt = document.createElement("option");
          opt.value = group.id + "/" + m.id;
          opt.textContent = m.name;
          if (currentValue === group.id + "/" + m.id) opt.selected = true;
          og.appendChild(opt);
        }
        modelSelect.appendChild(og);
      }
      modelSelect.addEventListener("change", () => {
        const v = modelSelect.value;
        const idx = v.indexOf("/");
        if (v && idx > 0) {
          draft.modelProvider = v.slice(0, idx);
          draft.modelModel = v.slice(idx + 1);
        } else {
          draft.modelProvider = "";
          draft.modelModel = "";
        }
      });
      modelField.appendChild(modelSelect);
      form.appendChild(modelField);
      if (modelCatalog === null || modelCatalog.groups.length === 0) {
        // Catalog still loading (or unavailable): fetch then refresh the select.
        fetchModelCatalog().then((cat) => {
          if (cat.groups.length > 0 && panelRef !== null && formState !== null) renderPanel();
        });
      }

      // Approval policy select (per-task override; "" = follow dsh default).
      const approvalField = document.createElement("div");
      approvalField.className = "dshTaskField";
      approvalField.innerHTML = "<label>" + escapeHtml(t("approval")) + "</label>";
      const approvalSelect = document.createElement("select");
      approvalSelect.className = "dshTaskSelect";
      for (const [value, key] of [["", "approvalDefault"], ["ask", "approvalAsk"], ["never", "approvalNever"]]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = t(key);
        if ((draft.approval || "") === value) opt.selected = true;
        approvalSelect.appendChild(opt);
      }
      approvalSelect.addEventListener("change", () => { draft.approval = approvalSelect.value; });
      approvalField.appendChild(approvalSelect);
      form.appendChild(approvalField);

      const btns = document.createElement("div");
      btns.className = "dshTaskFormBtns";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "dshTaskBtn";
      cancelBtn.textContent = t("cancel");
      cancelBtn.addEventListener("click", () => { formState = null; renderPanel(); });
      const saveBtn = document.createElement("button");
      saveBtn.className = "dshTaskBtn";
      saveBtn.dataset.variant = "primary";
      saveBtn.textContent = t("save");
      saveBtn.addEventListener("click", () => onSaveDraft(draft));
      btns.appendChild(cancelBtn);
      btns.appendChild(saveBtn);
      form.appendChild(btns);
      return form;
    }

    function timeField(inputType, labelText, value, onInput, attrs) {
      const field = document.createElement("div");
      field.className = "dshTaskField";
      field.innerHTML = "<label>" + escapeHtml(labelText) + "</label>";
      const input = document.createElement("input");
      input.className = "dshTaskInput";
      input.type = inputType;
      if (attrs) for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, String(v));
      input.value = value ?? "";
      input.addEventListener("input", () => onInput(input.value));
      field.appendChild(input);
      return field;
    }

    async function onSaveDraft(draft) {
      const payload = { ...draft };
      if (payload.type === "once" && payload.at && payload.at.length === 16) {
        // datetime-local has no timezone; convert local -> ISO with offset.
        const ts = new Date(payload.at).getTime();
        if (!Number.isFinite(ts)) { toast(t("saveFailed", "bad time"), true); return; }
        payload.at = new Date(ts).toISOString();
      }
      const env = await api("/save", { method: "POST", body: JSON.stringify(payload) });
      if (env && env.ok) {
        formState = null;
        toast(t("save"));
        await refreshTasks();
      } else {
        toast(t("saveFailed", env?.error ?? "?"), true);
      }
    }

    function buildTaskItem(task) {
      const item = document.createElement("div");
      item.className = "dshTaskItem";
      const st = statusOf(task);
      // "已停用" is its own state — never masks the real last status text.
      const stText = st === "off" ? t("disabled") : t("status_" + (st === "never" ? "never" : st));
      const stState = st === "off" ? "off" : st === "ok" ? "ok" : st === "failed" ? "failed" : st === "running" ? "running" : "";
      const head = document.createElement("div");
      head.className = "dshTaskItemHead";
      head.innerHTML =
        '<span class="dshTaskItemName">' + escapeHtml(task.name) + "</span>" +
        '<span class="dshTaskBadge">' + escapeHtml(typeLabel(task)) + "</span>" +
        '<span class="dshTaskBadge" data-state="' + stState + '">' + escapeHtml(stText) + "</span>";
      item.appendChild(head);

      const meta = document.createElement("div");
      meta.className = "dshTaskMeta";
      const nextBits = [];
      if (task.enabled !== false && task.nextRun) nextBits.push(t("nextRun") + ": <b>" + escapeHtml(task.nextRun) + "</b>");
      if (task.lastRunAt) {
        nextBits.push(t("lastRun") + ": <b>" + escapeHtml(fmtLocal(task.lastRunAt)) + "</b>");
      }
      if (task.modelProvider && task.modelModel) {
        nextBits.push(t("modelBadge") + ": <b>" + escapeHtml(task.modelProvider + "/" + task.modelModel) + "</b>");
      }
      if (task.approval) {
        nextBits.push(t("approvalBadge") + ": <b>" + escapeHtml(task.approval) + "</b>");
      }
      meta.innerHTML = nextBits.join("<span>·</span>") || "&nbsp;";
      item.appendChild(meta);

      const promptLine = document.createElement("div");
      promptLine.className = "dshTaskPrompt";
      promptLine.textContent = task.prompt;
      promptLine.title = task.prompt;
      item.appendChild(promptLine);

      // Recent runs.
      if (Array.isArray(task.history) && task.history.length) {
        const hist = document.createElement("div");
        hist.className = "dshTaskHist";
        const line = task.history.slice(0, 3).map((h) => {
          const at = fmtLocalShort(h.at);
          const label = h.status === "ok" ? t("status_ok") : h.status === "skipped" ? t("status_skipped") : t("status_failed");
          const bits = [at + " · " + label];
          if (h.error) bits.push(t("error") + ": " + String(h.error).slice(0, 80));
          if (h.summary) bits.push(String(h.summary).replace(/\s+/g, " ").slice(0, 100));
          return escapeHtml(bits.join(" · "));
        }).join("<br>");
        hist.innerHTML = "<span>" + escapeHtml(t("history")) + ":</span>" + line;
        item.appendChild(hist);
      }

      const btns = document.createElement("div");
      btns.className = "dshTaskItemBtns";
      const runBtn = taskButton(t("runNow"), async (btn) => {
        btn.disabled = true;
        const env = await api("/run", { method: "POST", body: JSON.stringify({ id: task.id }) });
        if (env && env.ok) toast(t("runStarted"));
        else toast(t("runBusy"), true);
        btn.disabled = false;
        await refreshTasks();
      });
      const toggleBtn = taskButton(task.enabled !== false ? t("enabled") : t("disabled"), async () => {
        await api("/toggle", { method: "POST", body: JSON.stringify({ id: task.id }) });
        await refreshTasks();
      });
      const editBtn = taskButton(t("edit"), () => {
        formState = {
          id: task.id, name: task.name, prompt: task.prompt, type: task.type,
          at: task.at ? toLocalInputValue(new Date(task.at).getTime()) : toLocalInputValue(Date.now() + 30 * 60000),
          time: task.time || "09:00",
          weekdays: Array.isArray(task.weekdays) ? [...task.weekdays] : [1, 2, 3, 4, 5],
          intervalMinutes: task.intervalMinutes || 60,
          modelProvider: task.modelProvider || "",
          modelModel: task.modelModel || "",
          approval: task.approval || "",
          enabled: task.enabled !== false
        };
        renderPanel();
      });
      const delBtn = taskButton(t("remove"), async () => {
        if (!window.confirm(t("confirmRemove"))) return;
        await api("/delete", { method: "POST", body: JSON.stringify({ id: task.id }) });
        await refreshTasks();
      });
      delBtn.dataset.variant = "danger";
      btns.appendChild(runBtn);
      btns.appendChild(toggleBtn);
      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      item.appendChild(btns);
      return item;
    }

    function taskButton(label, onClick) {
      const btn = document.createElement("button");
      btn.className = "dshTaskBtn";
      btn.textContent = label;
      btn.addEventListener("click", () => onClick(btn));
      return btn;
    }

    /* -------------------------------------------------------- startup */

    function tryMount(retries) {
      if (placeEntry()) return;
      if (retries <= 0) return;
      setTimeout(() => tryMount(retries - 1), 600);
    }

    // cordis plugin contract: the client module must expose apply(ctx).
    function apply(ctx) {
      if (typeof document === "undefined") return;
      ensureStyle();
      pollDshLang();
      setInterval(pollDshLang, 8000);
      const start = () => tryMount(40);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
      else start();
      // dsh re-renders the sidebar (route switches, skins); keep the entry in place.
      new MutationObserver(() => {
        const root = sidebarRoot();
        if (root && !root.querySelector("[data-dsh-task-entry]")) placeEntry();
      }).observe(document.body, { childList: true, subtree: true });
      // Periodic refresh so next-run times stay current while the panel is open.
      setInterval(() => { if (panelRef !== null) refreshTasks(); }, 30000);
    }

    module.exports = { openPanel, refreshTasks, apply };
    return module.exports;
  }
});
