import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { SubmissionId } from "@earendil-works/pi-durable";
import type { AgentEnv } from "../../alchemy.run.ts";
import { MODEL, PiObject } from "./pi-object.ts";
import type { ScoutRpc } from "./rpc.ts";
import { PREAMBLE, runPrompt } from "./prompt.ts";
import { createScoutTools } from "./tools.ts";

const BUDGET = { search: 25, read: 45 } as const;

interface ScoutState {
  readonly runId: string;
  readonly submissionId: SubmissionId;
}

/** One research run. Each run gets its own instance, named by the run ID, so its transcript starts empty. */
export class Scout extends PiObject implements ScoutRpc {
  #state: ScoutState | undefined;

  constructor(ctx: DurableObjectState, env: AgentEnv) {
    super(ctx, env);
    this.open(async () => {
      this.#state = await this.ctx.storage.get<ScoutState>("state");
      return {
        name: "scout",
        preamble: PREAMBLE,
        tools: createScoutTools({
          backend: this.backend,
          contextDevKey: this.env.CONTEXT_DEV_API_KEY,
          runId: () => {
            if (this.#state === undefined) throw new Error("No run is attached to this agent");
            return this.#state.runId;
          },
          spend: async (kind) => {
            const spent = ((await this.ctx.storage.get<number>(`spent:${kind}`)) ?? 0) + 1;
            await this.ctx.storage.put(`spent:${kind}`, spent);
            return spent <= BUDGET[kind];
          },
        }),
      };
    });
  }

  /** Starts the run this instance is named after. Calling it again for the same run does nothing new. */
  async start(runId: string): Promise<void> {
    if (this.#state !== undefined) return;
    await this.arm({ ...this.harness.wake(), active: true });
    const root = await this.harness.root(BACKGROUND_CONTEXT, {
      agent: { model: MODEL, thinkingLevel: "max", maxTurns: 120 },
    });
    const submission = await root.submit(
      { type: "input", content: runPrompt(new Date().toISOString().slice(0, 10)), requestId: runId },
      BACKGROUND_CONTEXT,
    );
    this.#state = { runId, submissionId: submission.id };
    await this.ctx.storage.put("state", this.#state);
  }

  /** The model normally closes the run with `finish_run`. This covers a run that ended without calling it. */
  protected override async afterResume(): Promise<void> {
    if (this.#state === undefined) return;
    const submission = await this.harness.submission(this.#state.submissionId, BACKGROUND_CONTEXT);
    const record = await submission?.status(BACKGROUND_CONTEXT);
    if (record === undefined || (record.status !== "done" && record.status !== "unanswered")) return;
    await this.backend.finishRun(
      this.#state.runId,
      record.status === "done" ? "completed" : "failed",
      record.status === "done" ? "Ricerca conclusa." : "La ricerca si è interrotta prima di finire.",
    );
  }
}
