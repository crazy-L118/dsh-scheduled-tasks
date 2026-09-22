/**
 * Smoke test for dsh-scheduled-tasks — no live dsh host required.
 * Runs the cordis plugin apply() against a stub context, drives the HTTP
 * route handlers with fake req/res, and exercises the runner with a fake
 * agents registry. The task store is redirected to a scratch directory via
 * HOME/USERPROFILE BEFORE the plugin module is imported.
 *
 * Usage: node test/smoke.mjs
 */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";

// Redirect the plugin's per-machine store to a scratch dir first.
const scratch = await mkdtemp(join(tmpdir(), "dsh-tasks-test-"));
process.env.HOME = scratch;
process.env.USERPROFILE = scratch;

const plugin = (await import("../lib/index.js")).default;
const { runTask } = await import("../lib/runner.js");
const { lastDueOccurrence } = await import("../lib/index.js");

// ---- schedule math: backward-looking due check ---------------------------
const MIN = 60_000;
const now = new Date();
const todayAt = (h, mi, dayOffset = 0) => at(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, h, mi);
function at(y, mo, d, h, mi) { return new Date(y, mo, d, h, mi, 0, 0).getTime(); }

// once due in the past fires; once in the future does not.
const longAgo = new Date(now.getTime() - 24 * 60 * MIN).toISOString();
const onceTask = { type: "once", enabled: true, createdAt: longAgo, at: new Date(now.getTime() - MIN).toISOString() };
assert.equal(lastDueOccurrence(onceTask, now.getTime()), new Date(onceTask.at).getTime(), "past once is due");
assert.equal(lastDueOccurrence({ ...onceTask, at: new Date(now.getTime() + MIN).toISOString() }, now.getTime()), null, "future once not due");
assert.equal(lastDueOccurrence({ ...onceTask, lastRunAt: onceTask.at }, now.getTime()), null, "once does not refire after running");

// daily at a time already passed today is due; before that time is not; after running, not.
const createdYesterday = new Date(todayAt(0, 1) - 12 * 60 * MIN).toISOString();
const dailyPast = { type: "daily", enabled: true, time: "00:01", createdAt: createdYesterday };
assert.equal(lastDueOccurrence(dailyPast, now.getTime()), todayAt(0, 1), "daily past-time is due");
const dailyFuture = { type: "daily", enabled: true, time: "23:59" };
assert.equal(lastDueOccurrence(dailyFuture, now.getTime()), null, "daily future-time not due");
const dailyRan = { type: "daily", enabled: true, time: "00:01", createdAt: createdYesterday, lastRunAt: new Date(todayAt(0, 1)).toISOString() };
assert.equal(lastDueOccurrence(dailyRan, now.getTime()), null, "daily already ran today not due");

// weekly: matching weekday due, non-matching not.
const weekday = new Date(now).getDay();
const weeklyHit = { type: "weekly", enabled: true, time: "00:01", weekdays: [weekday], createdAt: createdYesterday };
assert.equal(lastDueOccurrence(weeklyHit, now.getTime()), todayAt(0, 1), "weekly matching weekday due");
const weeklyMiss = { type: "weekly", enabled: true, time: "00:01", weekdays: [(weekday + 1) % 7] };
assert.equal(lastDueOccurrence(weeklyMiss, now.getTime()), null, "weekly non-matching weekday not due");

// interval: anchored multiples, consumed after run.
const intervalTask = { type: "interval", enabled: true, intervalMinutes: 5, createdAt: new Date(now.getTime() - 11 * MIN).toISOString() };
const kExpected = Math.floor((now.getTime() - new Date(intervalTask.createdAt).getTime()) / (5 * MIN));
assert.equal(lastDueOccurrence(intervalTask, now.getTime()), new Date(intervalTask.createdAt).getTime() + kExpected * 5 * MIN, "interval latest multiple due");
assert.equal(lastDueOccurrence({ ...intervalTask, lastRunAt: new Date(now.getTime()).toISOString() }, now.getTime()), null, "interval consumed after running");

// disabled tasks never due.
assert.equal(lastDueOccurrence({ ...dailyPast, enabled: false }, now.getTime()), null, "disabled task not due");
console.log("ok: lastDueOccurrence schedule math (once/daily/weekly/interval)");

/** Minimal fake HTTP response. */
function makeRes() {
  return {
    code: 0,
    headers: null,
    body: "",
    writeHead(code, headers) { this.code = code; this.headers = headers; },
    end(body) { this.body = String(body ?? ""); }
  };
}

/** Minimal fake request with a JSON body. */
function makeReq(method, body) {
  const data = body === undefined ? "" : JSON.stringify(body);
  return {
    method,
    url: "/x",
    on(event, cb) {
      if (event === "data") setImmediate(() => cb(data));
      if (event === "end") setImmediate(() => cb());
    },
    destroy() {}
  };
}

// ---- stub cordis context -------------------------------------------------
const routes = new Map();
const ctx = {
  effect(fn) { fn(); },
  get(name) { return name === "llm" ? ctx.llm : undefined; },
  llm: {
    listProviders: () => [{ id: "prov", name: "Provider" }],
    listModels: async (id) => id === "prov" ? [{ id: "mdl", name: "Model" }] : []
  },
  agentDefaultModel: { currentSelection: () => ({ provider: "prov", model: "mdl" }) },
  webServer: {
    register(def) {
      routes.set(`${def.kind}:${def.path}`, def.handler);
      return () => routes.delete(`${def.kind}:${def.path}`);
    }
  }
};

plugin.apply(ctx);
assert.equal(routes.size, 7, "expected 7 routes registered");
console.log("ok: apply() registered", routes.size, "routes");

/** Call a captured route handler. */
async function call(method, path, body, query) {
  const handler = routes.get(`prefix:${path}`);
  assert.ok(handler, `route missing: ${path}`);
  const req = makeReq(method, body);
  req.url = path + (query ? "?" + query : "");
  const res = makeRes();
  const url = new URL(`http://x${req.url}`);
  await handler(req, res, url);
  return { status: res.code, json: JSON.parse(res.body || "{}") };
}

// ---- route tests ---------------------------------------------------------
const saved = await call("POST", "/dsh-scheduled-tasks/save", {
  name: "smoke daily",
  prompt: "say hi",
  type: "daily",
  time: "23:59"
});
assert.equal(saved.status, 200, "save daily ok");
assert.ok(saved.json.task.id, "task id assigned");
assert.ok(saved.json.task.nextRun.includes("23:59"), "nextRun computed: " + saved.json.task.nextRun);
const taskId = saved.json.task.id;

const onceFuture = await call("POST", "/dsh-scheduled-tasks/save", {
  name: "smoke once",
  prompt: "hello once",
  type: "once",
  at: new Date(Date.now() + 3600_000).toISOString()
});
assert.equal(onceFuture.status, 200);
assert.ok(onceFuture.json.task.nextRun, "once nextRun set");

const badSave = await call("POST", "/dsh-scheduled-tasks/save", { name: "", prompt: "" });
assert.equal(badSave.status, 400, "invalid save rejected");

const badTime = await call("POST", "/dsh-scheduled-tasks/save", {
  name: "bad", prompt: "x", type: "daily", time: "99:99"
});
assert.equal(badTime.status, 400, "bad HH:MM rejected");

const listed = await call("GET", "/dsh-scheduled-tasks/list");
assert.equal(listed.json.tasks.length, 2, "two tasks listed");

const toggled = await call("POST", "/dsh-scheduled-tasks/toggle", { id: taskId });
assert.equal(toggled.json.task.enabled, false, "toggle disables");
const toggled2 = await call("POST", "/dsh-scheduled-tasks/toggle", { id: taskId });
assert.equal(toggled2.json.task.enabled, true, "toggle re-enables");

const locale = await call("GET", "/dsh-scheduled-tasks/locale");
assert.ok(locale.json.ok && ["zh", "en"].includes(locale.json.lang), "locale defaults: " + locale.json.lang);

const catalog = await call("GET", "/dsh-scheduled-tasks/models");
assert.ok(catalog.json.ok, "models route ok");
assert.equal(catalog.json.groups[0]?.id, "prov", "catalog lists provider");
assert.equal(catalog.json.groups[0]?.models[0]?.id, "mdl", "catalog lists model");
assert.deepEqual(catalog.json.default, { provider: "prov", model: "mdl" }, "catalog carries default selection");

// Per-task model override round-trips through save.
const withModel = await call("POST", "/dsh-scheduled-tasks/save", {
  name: "model override", prompt: "x", type: "daily", time: "00:01",
  modelProvider: "prov", modelModel: "mdl"
});
assert.equal(withModel.json.task.modelProvider, "prov", "model provider stored");
assert.equal(withModel.json.task.modelModel, "mdl", "model model stored");
const cleared = await call("POST", "/dsh-scheduled-tasks/save", {
  id: withModel.json.task.id, name: "model override", prompt: "x", type: "daily", time: "00:01",
  modelProvider: "", modelModel: ""
});
assert.equal(cleared.json.task.modelProvider, undefined, "model override clears");

// Per-task approval policy round-trips; invalid values are dropped.
const withApproval = await call("POST", "/dsh-scheduled-tasks/save", {
  name: "approval task", prompt: "x", type: "daily", time: "00:01", approval: "never"
});
assert.equal(withApproval.json.task.approval, "never", "approval stored");
const badApproval = await call("POST", "/dsh-scheduled-tasks/save", {
  name: "bad approval", prompt: "x", type: "daily", time: "00:01", approval: "yolo"
});
assert.equal(badApproval.json.task.approval ?? "", "", "invalid approval dropped");

console.log("ok: save/list/toggle/locale/models routes behave");

// ---- runner test with fake agents registry -------------------------------
let delivered = null;
let idleCalls = 0;
const appendedEvents = [];
const fakeAgent = {
  session: {
    id: "session-fake",
    append(type, data) { appendedEvents.push({ type, data }); },
    snapshotEvents() {
      return [
        { type: "user/message", data: { message: { role: "user", content: [{ type: "text", text: "x" }] } } },
        { type: "assistant/message", data: { message: { role: "assistant", content: [{ type: "text", text: "run complete" }] } } }
      ];
    },
    events: [
      { data: { message: { role: "user", content: [{ type: "text", text: "x" }] } } },
      { data: { message: { role: "assistant", content: [{ type: "text", text: "run complete" }] } } }
    ]
  },
  whenIdle: async () => { idleCalls++; },
  followup: (msg) => { delivered = msg; }
};
let lastCreateOptions = null;
const runnerCtx = {
  agents: {
    create: async (options) => {
      lastCreateOptions = options;
      assert.ok(String(options.sessionId).startsWith("session-"), "sessionId generated");
      assert.equal(options.meta?.cwd, "D:/fake-workspace", "workspace cwd resolved from registry");
      assert.equal(typeof options.setup, "function", "setup wired");
      // The loop contract: setup must return undefined (or {commit()}), never a bare function.
      const setupReturn = await options.setup({ on() {} });
      assert.equal(setupReturn, undefined, "setup returns undefined (safe for ?.commit())");
      assert.equal(options.meta.agentPreset, "preset-default", "default preset stamped into meta");
      assert.ok(mountedPresets.includes("preset-default"), "preset mounted into agent ctx");
      return { agent: fakeAgent };
    }
  },
  agentDefaultModel: { currentSelection: () => ({ provider: "prov", model: "mdl" }) },
  agentPresets: {
    resolve: async () => ({ id: "preset-default" }),
    mount: async (_agentCtx, id) => { mountedPresets.push(id); }
  },
  workspaceRegistry: { list: () => [{ record: { path: "D:/fake-workspace" } }] },
  sessions: { flush: async () => {} }
};
const mountedPresets = [];
const result = await runTask(runnerCtx, { name: "t", prompt: "do the thing" });
assert.equal(result.ok, true, "runner ok");
assert.deepEqual(lastCreateOptions.agentOptions, { provider: "prov", model: "mdl" }, "default selection used");
assert.ok(delivered && delivered.role === "user", "user message delivered");
assert.equal(delivered.content[0].text, "do the thing");
assert.equal(delivered.source.kind, "user", "human-equivalent source stamped (authority checks pass)");
assert.equal(result.summary, "run complete", "assistant summary extracted");

// Per-task approval policy is stamped into the session log before the run.
appendedEvents.length = 0;
delivered = null;
idleCalls = 0;
const approvalResult = await runTask(runnerCtx, { name: "t3", prompt: "x", approval: "never" });
assert.equal(approvalResult.ok, true, "approval run ok");
assert.ok(appendedEvents.some((e) => e.type === "approval/policy" && e.data.policy === "never"), "approval/policy event appended");

// No override -> no approval/policy event.
appendedEvents.length = 0;
await runTask(runnerCtx, { name: "t4", prompt: "x" });
assert.ok(!appendedEvents.some((e) => e.type === "approval/policy"), "no approval event without override");

// Per-task model override wins over the default.
delivered = null;
idleCalls = 0;
const overrideResult = await runTask(runnerCtx, { name: "t2", prompt: "x", modelProvider: "other", modelModel: "big" });
assert.equal(overrideResult.ok, true, "override run ok");
assert.deepEqual(lastCreateOptions.agentOptions, { provider: "other", model: "big" }, "task model overrides default");
assert.equal(idleCalls, 2, "whenIdle awaited before and after (override run)");
assert.ok(delivered && delivered.content[0].text === "x", "override prompt delivered");

const noAgents = await runTask({}, { name: "t", prompt: "x" });
assert.equal(noAgents.ok, false, "runner fails cleanly without agents service");
console.log("ok: runner delivers followup, awaits idle, extracts summary");

// ---- store persistence & delete ------------------------------------------
const listed2 = await call("GET", "/dsh-scheduled-tasks/list");
assert.equal(listed2.json.tasks.length, 5, "tasks persist across calls");

const del = await call("POST", "/dsh-scheduled-tasks/delete", { id: taskId });
assert.equal(del.status, 200, "delete ok");
const listed3 = await call("GET", "/dsh-scheduled-tasks/list");
assert.equal(listed3.json.tasks.length, 4, "delete removed the task");
console.log("ok: delete route behaves, store consistent");

console.log("\nALL SMOKE TESTS PASSED");
process.exit(0);
