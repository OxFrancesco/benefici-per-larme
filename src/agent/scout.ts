import { DurableObject } from "cloudflare:workers";
import { toRpcAsync } from "@alchemy.run/cloudflare/Bridge";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import {
  createRegistry,
  defineExtension,
  Harness,
  section,
  type SubmissionId,
  type Wake,
} from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { AgentEnv } from "../../alchemy.run.ts";
import type Backend from "../backend/api.ts";
import { PREAMBLE, runPrompt } from "./prompt.ts";
import { createScoutTools } from "./tools.ts";

const MODEL = { provider: "openrouter", modelId: "meta/muse-ember" } as const;

/** While work can run, the alarm stays this far ahead, so an evicted instance is woken to resume it. */
const HEARTBEAT_MS = 60_000;

interface ScoutState {
  readonly runId: string;
  readonly submissionId: SubmissionId;
}

/** One research run. Each run gets its own instance, named by the run ID, so its transcript starts empty. */
export class Scout extends DurableObject<AgentEnv> {
  #harness!: Harness;
  #state: ScoutState | undefined;
  readonly #backend = toRpcAsync<Backend>(this.env.BACKEND);

  constructor(ctx: DurableObjectState, env: AgentEnv) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => this.#initialize());
  }

  async #initialize(): Promise<void> {
    // A fallback before anything can throw: an object whose open or recovery fails is started again.
    const fallback = Date.now() + HEARTBEAT_MS;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > fallback) await this.ctx.storage.setAlarm(fallback);

    this.#state = await this.ctx.storage.get<ScoutState>("state");
    // pi-ai's OpenRouter provider reads its key from the process environment.
    process.env.OPENROUTER_API_KEY = this.env.OPENROUTER_API_KEY;

    const models = createModels();
    models.setProvider(openrouterProvider());
    const tools = createScoutTools({
      backend: this.#backend,
      contextDevKey: this.env.CONTEXT_DEV_API_KEY,
      runId: () => {
        if (this.#state === undefined) throw new Error("No run is attached to this agent");
        return this.#state.runId;
      },
    });
    const registry = createRegistry();
    registry.install(
      defineExtension({
        name: "scout",
        tools,
        sections: [section("preamble", () => PREAMBLE, { tag: false })],
      }),
    );

    this.#harness = await Harness.open(
      await openDurableObjectSqliteStorage(this.ctx.storage),
      {
        models,
        registry,
        settings: { retry: { enabled: true, maxRetries: 5, baseDelayMs: 1000 } },
        onReport: ({ error, ...report }) =>
          console.error(JSON.stringify({ message: "Harness report", ...report, error: String(error) })),
        onWake: (wake) => void this.#arm(wake).catch(() => this.ctx.abort("Alarm write failed")),
      },
      BACKGROUND_CONTEXT,
    );
    void this.#harness.closed.then((end) => {
      if (end.kind === "failed") this.ctx.abort("Harness failed");
    });

    await this.#arm(this.#harness.wake());
    this.#harness.resume();
  }

  /** Starts the run this instance is named after. Calling it again for the same run does nothing new. */
  async start(runId: string): Promise<void> {
    if (this.#state !== undefined) return;
    await this.#arm({ ...this.#harness.wake(), active: true });
    const root = await this.#harness.root(BACKGROUND_CONTEXT, {
      agent: { model: MODEL, thinkingLevel: "max", maxTurns: 80 },
    });
    const submission = await root.submit(
      { type: "input", content: runPrompt(new Date().toISOString().slice(0, 10)), requestId: runId },
      BACKGROUND_CONTEXT,
    );
    this.#state = { runId, submissionId: submission.id };
    await this.ctx.storage.put("state", this.#state);
  }

  override async alarm(): Promise<void> {
    await this.#arm({ ...this.#harness.wake(), active: true });
    this.#harness.resume();
    await this.#closeRunIfSettled();
    await this.#arm(this.#harness.wake());
  }

  /** The model normally closes the run with `finish_run`. This covers a run that ended without calling it. */
  async #closeRunIfSettled(): Promise<void> {
    if (this.#state === undefined) return;
    const submission = await this.#harness.submission(this.#state.submissionId, BACKGROUND_CONTEXT);
    const record = await submission?.status(BACKGROUND_CONTEXT);
    if (record === undefined || (record.status !== "done" && record.status !== "unanswered")) return;
    await this.#backend.finishRun(
      this.#state.runId,
      record.status === "done" ? "completed" : "failed",
      record.status === "done" ? "Ricerca conclusa." : "La ricerca si è interrotta prima di finire.",
    );
  }

  async #arm(wake: Wake): Promise<void> {
    const heartbeat = wake.active ? Date.now() + HEARTBEAT_MS : undefined;
    const at = heartbeat === undefined || wake.at === undefined ? (heartbeat ?? wake.at) : Math.min(heartbeat, wake.at);
    if (at === undefined) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }
}
