/**
 * dsh-scheduled-tasks — host (cordis plugin) half.
 *
 * Registers JSON routes under /dsh-scheduled-tasks/* and runs a lightweight
 * in-process scheduler. When a task is due, it hands the task's prompt to the
 * runner in ./runner.js, which starts the work inside the running dsh host.
 *
 * Task store: ~/.dsh/scheduled-tasks.json (per machine, no secrets).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { runTask, isRunnerBusy } from "./runner.js";

const name = "dsh-scheduled-tasks";
const inject = ["webServer", "agents", "sessions"];

/** Local task store (created on first use). */
const STORE_PATH = resolve(homedir(), ".dsh", "scheduled-tasks.json");
/** dsh settings file, used to read the UI language (locale.preference). */
const DSH_SETTINGS_PATH = resolve(homedir(), ".dsh", "settings.yaml");

/** How many recent run records to keep per task. */
const HISTORY_LIMIT = 20;
/** Scheduler tick cadence, milliseconds. */
const TICK_MS = 15000;
/** Cap on how far past its due time a missed run still fires (catch-up window). */
const CATCHUP_MS = 6 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ store */

async function readStore() {
  try {
    const data = JSON.parse(await readFile(STORE_PATH, "utf8"));
    if (data && Array.isArray(data.tasks)) return data;
  } catch { /* first run or corrupt file -> fresh store */ }
  return { tasks: [] };
}

async function writeStore(store) {
  await mkdir(resolve(STORE_PATH, ".."), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

/* ------------------------------------------------------- schedule math */

function pad2(n) { return String(n).padStart(2, "0"); }

/**
 * Compute the next due timestamp (ms) for a task, strictly after `from`.
 * Types: once (ISO string in `at`), daily (HH:MM), weekly (weekdays 0-6 +
 * HH:MM), interval (intervalMinutes, anchored on createdAt).
 */
function nextRunAt(task, from = Date.now()) {
  const now = new Date(from);
  if (task.type === "once") {
    const t = new Date(task.at).getTime();
    return Number.isFinite(t) && t > from ? t : null;
  }
  if (task.type === "interval") {
    const step = Math.max(5, Number(task.intervalMinutes) || 60) * 60000;
    const anchor = new Date(task.createdAt).getTime() || from;
    if (!Number.isFinite(anchor)) return from + step;
    const k = Math.floor((from - anchor) / step) + 1;
    return anchor + k * step;
  }
  const [hh, mm] = String(task.time || "09:00").split(":").map((v) => Number.parseInt(v, 10));
  const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 9;
  const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  for (let day = 0; day < 8; day++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute, 0, 0);
    if (d.getTime() <= from) continue;
    if (task.type === "weekly") {
      const weekdays = Array.isArray(task.weekdays) ? task.weekdays.map(Number) : [];
      if (!weekdays.includes(d.getDay())) continue;
    }
    return d.getTime();
  }
  return null;
}

/** Human-readable next-run time (locale-aware at the client; host stays ISO-ish). */
function describeNext(task) {
  const t = task.enabled === false ? null : nextRunAt(task);
  if (t === null) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Latest occurrence that is due at `now` and has not run yet, or null.
 * Unlike nextRunAt (strictly future), this looks BACKWARD: a daily task at
 * 09:00 stays due from 09:00 until it fires, then again the next morning.
 */
function lastDueOccurrence(task, now = Date.now()) {
  if (task.enabled === false) return null;
  const lastRun = task.lastRunAt ? new Date(task.lastRunAt).getTime() : -Infinity;
  const created = new Date(task.createdAt).getTime();
  // No createdAt (hand-edited store) -> never backfire before "now".
  const notBefore = Number.isFinite(created) ? Math.max(created, lastRun) : (Number.isFinite(lastRun) ? lastRun : now);
  if (task.type === "once") {
    const t = new Date(task.at).getTime();
    if (!Number.isFinite(t) || t > now || notBefore >= t) return null;
    return t;
  }
  if (task.type === "interval") {
    const step = Math.max(5, Number(task.intervalMinutes) || 60) * 60000;
    const anchor = new Date(task.createdAt).getTime();
    if (!Number.isFinite(anchor)) return null;
    const k = Math.floor((now - anchor) / step);
    if (k < 1) return null;
    const occ = anchor + k * step;
    if (occ > now || notBefore >= occ) return null;
    return occ;
  }
  const [hh, mm] = String(task.time || "09:00").split(":").map((v) => Number.parseInt(v, 10));
  const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 9;
  const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  const today = new Date(now);
  for (let back = 0; back < 8; back++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, hour, minute, 0, 0);
    if (d.getTime() > now) continue;
    if (task.type === "weekly") {
      const weekdays = Array.isArray(task.weekdays) ? task.weekdays.map(Number) : [];
      if (!weekdays.includes(d.getDay())) continue;
    }
    const t = d.getTime();
    if (notBefore >= t) return null; // ran already, or predates the task itself
    return t;
  }
  return null;
}

/** Normalize an incoming task payload; throws on invalid input. */
function normalizeTask(input, existing) {
  const task = existing ? { ...existing } : {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  };
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("name required");
  const prompt = String(input.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt required");
  task.name = name.slice(0, 200);
  task.prompt = prompt.slice(0, 20000);
  const type = String(input.type ?? "once");
  if (!["once", "daily", "weekly", "interval"].includes(type)) throw new Error(`bad type: ${type}`);
  task.type = type;
  if (type === "once") {
    const at = new Date(input.at).getTime();
    if (!Number.isFinite(at)) throw new Error("bad at");
    task.at = new Date(at).toISOString();
    delete task.time; delete task.weekdays; delete task.intervalMinutes;
  } else if (type === "interval") {
    const m = Number(input.intervalMinutes);
    if (!Number.isFinite(m) || m < 5) throw new Error("intervalMinutes must be >= 5");
    task.intervalMinutes = Math.round(m);
    delete task.time; delete task.weekdays; delete task.at;
  } else {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(input.time ?? ""));
    if (!m) throw new Error("time must be HH:MM");
    task.time = `${pad2(Number(m[1]))}:${m[2]}`;
    if (type === "weekly") {
      const wd = Array.isArray(input.weekdays) ? input.weekdays.map(Number).filter((n) => n >= 0 && n <= 6) : [];
      if (!wd.length) throw new Error("weekdays required for weekly");
      task.weekdays = [...new Set(wd)].sort();
    } else {
      delete task.weekdays;
    }
    delete task.at; delete task.intervalMinutes;
  }
  if (input.enabled !== undefined) task.enabled = Boolean(input.enabled);
  else if (!existing) task.enabled = true;
  // Optional per-task model override (both fields together, or none).
  const mp = String(input.modelProvider ?? "").trim();
  const mm = String(input.modelModel ?? "").trim();
  if (mp && mm) {
    task.modelProvider = mp.slice(0, 100);
    task.modelModel = mm.slice(0, 200);
  } else {
    delete task.modelProvider;
    delete task.modelModel;
  }
  // Optional per-task approval policy: "" = follow dsh default, else "ask"|"never".
  const approval = String(input.approval ?? "");
  if (approval === "ask" || approval === "never") task.approval = approval;
  else delete task.approval;
  return task;
}

/** Public view of a task (everything the UI needs; no secrets involved). */
function taskToView(task) {
  return {
    id: task.id,
    name: task.name,
    prompt: task.prompt,
    type: task.type,
    at: task.at,
    time: task.time,
    weekdays: task.weekdays,
    intervalMinutes: task.intervalMinutes,
    modelProvider: task.modelProvider,
    modelModel: task.modelModel,
    approval: task.approval ?? "",
    enabled: task.enabled !== false,
    createdAt: task.createdAt,
    lastRunAt: task.lastRunAt,
    nextRun: describeNext(task),
    lastStatus: task.lastStatus,
    lastError: task.lastError,
    running: task.running === true,
    history: Array.isArray(task.history) ? task.history : []
  };
}

function pushHistory(task, entry) {
  const list = Array.isArray(task.history) ? task.history : [];
  list.unshift({ at: new Date().toISOString(), ...entry });
  task.history = list.slice(0, HISTORY_LIMIT);
}

/* ------------------------------------------------------------- locale */

/** Read the dsh UI language from settings.yaml (locale.preference); default zh. */
async function readDshLang() {
  try {
    const text = await readFile(DSH_SETTINGS_PATH, "utf8");
    const match = text.match(/^locale:\s*\r?\n(\s+preference:\s*(\S+))/m);
    if (match) {
      const value = match[2].replace(/^["']|["']$/g, "").toLowerCase();
      if (value === "en" || value === "zh") return value;
    }
  } catch { /* missing settings -> default */ }
  return "zh";
}

/* ------------------------------------------------------------ routes */

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolveBody) => {
    let data = "";
    req.on("data", (c) => {
      data += String(c);
      if (data.length > 2e6) req.destroy();
    });
    req.on("end", () => {
      try { resolveBody(JSON.parse(data || "{}")); }
      catch { resolveBody({}); }
    });
  });
}

/** Build the route handler for one method+path pair. */
function route(ctx, { method, path, handler }) {
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path,
    handler: async (req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (req.method !== method || url.pathname !== path) {
        json(res, 404, { ok: false, error: "not found" });
        return;
      }
      try { await handler(req, res, url); }
      catch (error) { json(res, 500, { ok: false, error: String(error?.message ?? error) }); }
    }
  }), `${name}: ${method} ${path}`);
}

/* ---------------------------------------------------------- scheduler */

let timer = null;

function startScheduler(ctx) {
  if (timer !== null) return;
  timer = setInterval(() => { tick(ctx).catch(() => {}); }, TICK_MS);
  if (typeof timer.unref === "function") { /* keep referenced: we WANT to hold the process */ }
  tick(ctx).catch(() => {});
}

async function tick(ctx) {
  const store = await readStore();
  let changed = false;
  const now = Date.now();
  for (const task of store.tasks) {
    if (task.enabled === false || task.running === true) continue;
    const due = lastDueOccurrence(task, now);
    if (due === null) continue;
    if (now - due > CATCHUP_MS) {
      // Missed long ago (machine was off): skip ahead instead of firing stale work.
      task.lastRunAt = new Date(due).toISOString(); // consume the occurrence so it won't re-due
      task.lastStatus = "skipped";
      task.lastError = "missed";
      pushHistory(task, { status: "skipped", note: "missed while offline" });
      changed = true;
      continue;
    }
    // Fire.
    task.running = true;
    task.lastRunAt = new Date().toISOString();
    changed = true;
    const firedTask = task;
    // Run asynchronously; the tick returns immediately.
    void (async () => {
      try {
        const result = await runTask(ctx, firedTask);
        firedTask.lastStatus = result.ok ? "ok" : "failed";
        firedTask.lastError = result.ok ? undefined : String(result.error ?? "unknown");
        pushHistory(firedTask, {
          status: firedTask.lastStatus,
          error: firedTask.lastError,
          summary: result.ok ? (result.summary ?? "") : undefined
        });
      } catch (error) {
        firedTask.lastStatus = "failed";
        firedTask.lastError = String(error?.message ?? error);
        pushHistory(firedTask, { status: "failed", error: firedTask.lastError });
      } finally {
        firedTask.running = false;
        if (firedTask.type === "once") firedTask.enabled = false;
        try {
          const fresh = await readStore();
          const idx = fresh.tasks.findIndex((t) => t.id === firedTask.id);
          if (idx >= 0) { fresh.tasks[idx] = firedTask; await writeStore(fresh); }
        } catch { /* best effort persistence */ }
      }
    })();
  }
  if (changed) await writeStore(store);
}

/* -------------------------------------------------------------- apply */

export function apply(ctx) {
  const BASE = "/dsh-scheduled-tasks";

  route(ctx, {
    method: "GET", path: `${BASE}/locale`,
    handler: async (req, res) => json(res, 200, { ok: true, lang: await readDshLang() })
  });

  route(ctx, {
    method: "GET", path: `${BASE}/list`,
    handler: async (req, res) => {
      const store = await readStore();
      json(res, 200, { ok: true, tasks: store.tasks.map(taskToView), runnerBusy: isRunnerBusy() });
    }
  });

  route(ctx, {
    method: "GET", path: `${BASE}/models`,
    handler: async (req, res) => {
      // Mirror the GUI's model catalog via the live LLM registry (same seam
      // as dsh-api-session-controller's buildModelCatalog), simplified for
      // a flat dropdown: { groups: [{id,name,models:[{id,name}]}], default }.
      try {
        const llm = (ctx.get ? ctx.get("llm") : undefined) ?? ctx.llm;
        if (!llm || typeof llm.listProviders !== "function") {
          json(res, 200, { ok: true, groups: [], default: undefined });
          return;
        }
        let defaultSelection;
        try {
          const svc = (ctx.get ? ctx.get("agentDefaultModel") : undefined) ?? ctx.agentDefaultModel;
          defaultSelection = typeof svc?.currentSelection === "function" ? svc.currentSelection() : undefined;
        } catch { defaultSelection = undefined; }
        const providers = llm.listProviders();
        const groups = (await Promise.all(providers.map(async (provider) => {
          try {
            const models = await llm.listModels(provider.id);
            return {
              id: provider.id,
              name: provider.name ?? provider.id,
              models: models.map((m) => ({ id: m.id, name: m.name ?? m.id }))
            };
          } catch {
            return null; // provider listing failed -> skip it
          }
        }))).filter((g) => g && g.models.length > 0);
        json(res, 200, { ok: true, groups, default: defaultSelection });
      } catch (error) {
        json(res, 500, { ok: false, error: String(error?.message ?? error) });
      }
    }
  });

  route(ctx, {
    method: "POST", path: `${BASE}/save`,
    handler: async (req, res) => {
      const body = await readBody(req);
      const store = await readStore();
      const existing = body.id ? store.tasks.find((t) => t.id === body.id) : undefined;
      if (body.id && !existing) { json(res, 404, { ok: false, error: "task not found" }); return; }
      let task;
      try { task = normalizeTask(body, existing); }
      catch (error) { json(res, 400, { ok: false, error: String(error?.message ?? error) }); return; }
      // Recompute schedule anchoring when needed.
      if (!existing) task.nextRunAt = nextRunAt(task);
      if (existing) store.tasks[store.tasks.indexOf(existing)] = task;
      else store.tasks.push(task);
      await writeStore(store);
      json(res, 200, { ok: true, task: taskToView(task) });
    }
  });

  route(ctx, {
    method: "POST", path: `${BASE}/delete`,
    handler: async (req, res) => {
      const body = await readBody(req);
      const store = await readStore();
      const before = store.tasks.length;
      store.tasks = store.tasks.filter((t) => t.id !== body.id);
      if (store.tasks.length === before) { json(res, 404, { ok: false, error: "task not found" }); return; }
      await writeStore(store);
      json(res, 200, { ok: true });
    }
  });

  route(ctx, {
    method: "POST", path: `${BASE}/toggle`,
    handler: async (req, res) => {
      const body = await readBody(req);
      const store = await readStore();
      const task = store.tasks.find((t) => t.id === body.id);
      if (!task) { json(res, 404, { ok: false, error: "task not found" }); return; }
      task.enabled = !(task.enabled !== false);
      await writeStore(store);
      json(res, 200, { ok: true, task: taskToView(task) });
    }
  });

  route(ctx, {
    method: "POST", path: `${BASE}/run`,
    handler: async (req, res) => {
      const body = await readBody(req);
      const store = await readStore();
      const task = store.tasks.find((t) => t.id === body.id);
      if (!task) { json(res, 404, { ok: false, error: "task not found" }); return; }
      if (task.running === true || isRunnerBusy()) { json(res, 409, { ok: false, error: "busy" }); return; }
      task.running = true;
      task.lastRunAt = new Date().toISOString();
      await writeStore(store);
      json(res, 200, { ok: true, started: true });
      void (async () => {
        try {
          const result = await runTask(ctx, task);
          task.lastStatus = result.ok ? "ok" : "failed";
          task.lastError = result.ok ? undefined : String(result.error ?? "unknown");
          pushHistory(task, {
            status: task.lastStatus,
            error: task.lastError,
            manual: true,
            summary: result.ok ? (result.summary ?? "") : undefined
          });
        } catch (error) {
          task.lastStatus = "failed";
          task.lastError = String(error?.message ?? error);
          pushHistory(task, { status: "failed", error: task.lastError, manual: true });
        } finally {
          task.running = false;
          if (task.type === "once") task.enabled = false;
          try {
            const fresh = await readStore();
            const idx = fresh.tasks.findIndex((t) => t.id === task.id);
            if (idx >= 0) { fresh.tasks[idx] = task; await writeStore(fresh); }
          } catch { /* best effort */ }
        }
      })();
    }
  });

  startScheduler(ctx);
}

export { lastDueOccurrence };

export default { name, inject, apply };
