/**
 * dsh-scheduled-tasks — task runner.
 *
 * Mirrors the built-in headless one-shot driver (@deepseek-ai/dsh-headless):
 * create a fresh agent/session via the "agents" registry, hand it the task
 * prompt as a plugin-sourced user message, wait for the run to finish, and
 * collect the last assistant text as the run summary.
 *
 * No private @deepseek-ai packages are hard dependencies: the user-message
 * factory is imported from "@deepseek-ai/dsh-llm" when resolvable and falls
 * back to a hand-built equivalent (createUserMessage is just a frozen plain
 * object with a random id — verified against the shipped bundle).
 */
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

/** Plugin identity stamped into delivered messages. */
const PLUGIN_ID = "dsh-scheduled-tasks";

/** Single-flight guard: one scheduled run at a time. */
let busy = false;

export function isRunnerBusy() {
  return busy;
}

/** Debug sink: append one line to ~/.dsh/scheduled-tasks.debug.log. */
export function debugLog(line) {
  try {
    appendFileSync(resolve(homedir(), ".dsh", "scheduled-tasks.debug.log"),
      `[${new Date().toISOString()}] ${line}\n`, "utf8");
  } catch { /* diagnostics must never break the run */ }
}

/**
 * Build a user message without a hard dependency on @deepseek-ai/dsh-llm.
 *
 * The source kind MUST be "user" (same as the built-in headless one-shot
 * driver): the execution-authority checks reject non-human sources, so a
 * "plugin"-sourced task message leaves the turn unable to run tools (no
 * shell, no mail) — it can only produce a text reply.
 */
async function buildUserMessage(text) {
  try {
    const mod = await import("@deepseek-ai/dsh-llm");
    if (mod && typeof mod.createUserMessage === "function") {
      return mod.createUserMessage({
        content: [{ type: "text", text }],
        source: { kind: "user" }
      });
    }
  } catch { /* not resolvable from this plugin -> fallback below */ }
  return Object.freeze({
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text }],
    source: { kind: "user" }
  });
}

/**
 * Pull the trailing assistant text out of the session event log.
 *
 * The canonical accessors are `session.seq` + `session.eventAt(i)` (exactly
 * what @deepseek-ai/dsh-headless uses). The older snapshotEvents()/events
 * guesses are kept only as defensive fallbacks.
 */
function lastAssistantText(session) {
  try {
    if (typeof session?.seq === "number" && typeof session?.eventAt === "function") {
      for (let seq = Number(session.seq) - 1; seq >= 0; seq--) {
        const event = session.eventAt(seq);
        const message = event?.type === "assistant/message"
          ? event?.data?.message
          : (event?.data?.message ?? event?.message);
        if (message?.role !== "assistant") continue;
        const blocks = Array.isArray(message.content) ? message.content : [];
        const text = blocks.filter((b) => b?.type === "text").map((b) => b.text ?? "").join("\n").trim();
        if (text) return text;
      }
      return undefined;
    }
    // Legacy fallbacks (older builds): snapshotEvents() / events array.
    const events = typeof session?.snapshotEvents === "function"
      ? session.snapshotEvents()
      : (Array.isArray(session?.events) ? session.events : []);
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      // Session log shape: { type: "assistant/message", data: { message } }.
      const message = event?.type === "assistant/message"
        ? event?.data?.message
        : (event?.data?.message ?? event?.message);
      if (message?.role !== "assistant") continue;
      const blocks = Array.isArray(message.content) ? message.content : [];
      const text = blocks.filter((b) => b?.type === "text").map((b) => b.text ?? "").join("\n").trim();
      if (text) return text;
    }
  } catch { /* projection differences -> no summary */ }
  return undefined;
}

/**
 * Best-effort resolve of the host's default model selection.
 * Mirrors @deepseek-ai/dsh-headless: ctx.get("agentDefaultModel").currentSelection().
 */
async function currentModelSelection(ctx) {
  try {
    const svc = (ctx.get ? ctx.get("agentDefaultModel") : undefined) ?? ctx.agentDefaultModel;
    const selection = typeof svc?.currentSelection === "function" ? svc.currentSelection() : undefined;
    if (selection?.provider && selection?.model) return selection;
  } catch { /* optional service */ }
  return undefined;
}

/**
 * Inline equivalent of @deepseek-ai/dsh-agent's installModelSelection: wires
 * the selected provider/model into system-prompt variables ({{model}} etc.)
 * and overrides each LLM request. Deliberately NOT importing the real export:
 * the official function returns a bare dispose function, while the agent loop
 * expects setup() to return undefined or an object with .commit() — a bare
 * function makes the loop throw "…?.commit is not a function". Our shim
 * returns undefined, which is the safe branch of that contract.
 */
function installModelSelectionShim(agentCtx, selection) {
  agentCtx.on("system-prompt/assemble", async (_assembly, _context, next) => {
    const selected = selection.current;
    const assembled = await next();
    selection.assembled = selected;
    if (selected === void 0) return assembled;
    return {
      ...assembled,
      variables: {
        ...assembled.variables,
        provider: selected.provider,
        model: selected.model
      }
    };
  });
  agentCtx.on("agent/request", async (_payload, next) => {
    const resolved = await next();
    const selected = selection.assembled;
    if (selected === void 0) return resolved;
    const { reasoningEffort: _inheritedEffort, ...withoutInheritedEffort } = resolved;
    return {
      ...withoutInheritedEffort,
      provider: selected.provider,
      model: selected.model,
      ...(selected.reasoningEffort === void 0 ? {} : { reasoningEffort: selected.reasoningEffort })
    };
  });
}

/**
 * Resolve a sane sandbox workspace directory for the run. The dsh process cwd
 * is wherever the binary was launched (often a binaries/temp directory) and
 * breaks the shell sandbox ("workspace and temp path collide"). Prefer the
 * first registered GUI workspace path, then the user's home directory.
 */
async function resolveWorkspaceCwd(ctx) {
  try {
    const registry = (ctx.get ? ctx.get("workspaceRegistry") : undefined) ?? ctx.workspaceRegistry;
    if (registry && typeof registry.list === "function") {
      for (const entity of registry.list()) {
        const path = entity?.record?.path ?? entity?.path;
        if (typeof path === "string" && path.length > 0) return path;
      }
    }
  } catch { /* optional service */ }
  return homedir();
}

/**
 * Attach the host's default agent preset (tools, MCP connections, skills…) to
 * the create options — same as the GUI's session controller: resolve() the
 * default preset, stamp meta.agentPreset, and mount() it in setup. Without
 * this, a freshly created agent only gets bare tools (e.g. web search) and
 * skills like mail are missing.
 */
function setupWithDefaultPreset(ctx, createOptions, setupSoFar) {
  return async (agentCtx) => {
    if (setupSoFar) await setupSoFar(agentCtx);
    try {
      const presets = (ctx.get ? ctx.get("agentPresets") : undefined) ?? ctx.agentPresets;
      if (presets && typeof presets.resolve === "function" && typeof presets.mount === "function") {
        const resolved = await presets.resolve(undefined);
        if (resolved?.id) {
          createOptions.meta.agentPreset = resolved.id;
          await presets.mount(agentCtx, resolved.id);
        }
      }
    } catch { /* preset mount must never block the run */ }
  };
}

/**
 * Run one scheduled task to completion inside the running dsh host.
 * @param {import("@deepseek-ai/cordis").Context} ctx - plugin context with "agents"/"sessions".
 * @param {{name:string, prompt:string}} task
 * @returns {Promise<{ok:boolean, error?:string, summary?:string, sessionId?:string}>}
 */
export async function runTask(ctx, task) {
  if (busy) return { ok: false, error: "runner busy" };
  const agents = ctx.agents;
  if (!agents || typeof agents.create !== "function") {
    return { ok: false, error: 'agents service unavailable (plugin must inject ["agents", "sessions"])' };
  }
  busy = true;
  try {
    const createOptions = {
      sessionId: `session-${randomUUID()}`,
      meta: { cwd: await resolveWorkspaceCwd(ctx) }
    };
    // Reuse the host's default provider/model selection AND install it into
    // the agent context — same as the built-in headless one-shot driver.
    // A per-task model override (set in the panel) wins over the default.
    let selection = await currentModelSelection(ctx);
    if (task.modelProvider && task.modelModel) {
      selection = {
        ...(selection ?? {}),
        provider: task.modelProvider,
        model: task.modelModel
      };
    }
    if (selection) {
      createOptions.agentOptions = { provider: selection.provider, model: selection.model };
      // Setup MUST return undefined (or a {commit()} object) — see shim docs.
      createOptions.setup = (agentCtx) => {
        installModelSelectionShim(agentCtx, { current: selection, assembled: void 0 });
      };
    }
    // Mount the default agent preset so the run has the same toolbox
    // (mail, shell, skills…) as a GUI-created session.
    createOptions.setup = setupWithDefaultPreset(ctx, createOptions, createOptions.setup);

    const { agent } = await agents.create(createOptions);
    if (!agent) return { ok: false, error: "agents.create returned no agent" };
    const session = agent.session;
    debugLog(`run start: session=${createOptions.sessionId} seq=${session?.seq} hasEventAt=${typeof session?.eventAt} preset=${session?.header?.agentPreset ?? createOptions.meta.agentPreset ?? "?"}`);
    if (typeof agent.whenIdle === "function") await agent.whenIdle();

    // Per-task approval policy override (same durable event the permission
    // preset switch writes). "never" keeps unattended runs from stalling on
    // approval prompts nobody can answer.
    if ((task.approval === "ask" || task.approval === "never") && agent.session?.append) {
      try { agent.session.append("approval/policy", { policy: task.approval }); }
      catch { /* policy override is best effort */ }
    }

    agent.followup(await buildUserMessage(task.prompt));
    debugLog(`followup delivered: seq=${session?.seq}`);
    // Wait for the followup turn to actually finish. `whenIdle()` alone can
    // win the race against the freshly scheduled turn (the turn is dispatched
    // asynchronously), which marked the run "ok" with an empty summary while
    // the real work continued unobserved in the background. Poll until the
    // session log shows an assistant reply, or until the timeout expires.
    const FOLLOWUP_TIMEOUT_MS = 15 * 60 * 1000;
    const followupDeadline = Date.now() + FOLLOWUP_TIMEOUT_MS;
    let polls = 0;
    while (true) {
      if (typeof agent.whenIdle === "function") await agent.whenIdle();
      polls++;
      const text = lastAssistantText(session);
      if (text) { debugLog(`turn done after ${polls} polls: seq=${session?.seq} summary=${text.length} chars`); break; }
      if (Date.now() > followupDeadline) { debugLog(`turn TIMEOUT after ${polls} polls: seq=${session?.seq}`); break; }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    }

    // Persist the session log when the persistence service is mounted.
    try {
      if (ctx.sessions && typeof ctx.sessions.flush === "function" && agent.session) {
        await ctx.sessions.flush(agent.session);
      }
    } catch { /* best effort */ }

    const summary = lastAssistantText(agent.session);
    const sessionId = agent.session?.id ?? createOptions.sessionId;
    return { ok: true, summary, sessionId };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  } finally {
    busy = false;
  }
}
