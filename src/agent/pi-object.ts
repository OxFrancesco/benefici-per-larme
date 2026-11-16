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
  type ToolRegistration,
  type Wake,
} from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import type { AgentEnv } from "../../alchemy.run.ts";
import type Backend from "../backend/api.ts";

export const MODEL = { provider: "openrouter", modelId: "meta/muse-ember" } as const;

/** While work can run, the alarm stays this far ahead, so an evicted instance is woken to resume it. */
const HEARTBEAT_MS = 60_000;

export interface AgentDefinition {
  readonly name: string;
  readonly preamble: string;
  readonly tools: ToolRegistration[];
}

/** A Durable Object that hosts one Pi Durable harness on its own SQLite storage. */
export abstract class PiObject extends DurableObject<AgentEnv> {
  protected harness!: Harness;
  protected readonly backend = toRpcAsync<Backend>(this.env.BACKEND);

  /** Subclasses call this last in their constructor, once their own fields exist. */
  protected open(definition: () => AgentDefinition | Promise<AgentDefinition>): void {
    void this.ctx.blockConcurrencyWhile(async () => {
      // A fallback before anything can throw: an object whose open or recovery fails is started again.
      const fallback = Date.now() + HEARTBEAT_MS;
      const current = await this.ctx.storage.getAlarm();
      if (current === null || current > fallback) await this.ctx.storage.setAlarm(fallback);

      // pi-ai's OpenRouter provider reads its key from the process environment.
      process.env.OPENROUTER_API_KEY = this.env.OPENROUTER_API_KEY;
      const models = createModels();
      models.setProvider(openrouterProvider());

      const { name, preamble, tools } = await definition();
      const registry = createRegistry();
      registry.install(
        defineExtension({ name, tools, sections: [section("preamble", () => preamble, { tag: false })] }),
      );

      this.harness = await Harness.open(
        await openDurableObjectSqliteStorage(this.ctx.storage),
        {
          models,
          registry,
          settings: { retry: { enabled: true, maxRetries: 5, baseDelayMs: 1000 } },
          onReport: ({ error, ...report }) =>
            console.error(JSON.stringify({ message: "Harness report", ...report, error: String(error) })),
          onWake: (wake) => void this.arm(wake).catch(() => this.ctx.abort("Alarm write failed")),
        },
        BACKGROUND_CONTEXT,
      );
      void this.harness.closed.then((end) => {
        if (end.kind === "failed") this.ctx.abort("Harness failed");
      });

      await this.arm(this.harness.wake());
      this.harness.resume();
    });
  }

  override async alarm(): Promise<void> {
    await this.arm({ ...this.harness.wake(), active: true });
    this.harness.resume();
    await this.afterResume();
    await this.arm(this.harness.wake());
  }

  protected async afterResume(): Promise<void> {}

  /** Call with `active: true` before anything that can start work, so a lost instance is woken again. */
  protected async arm(wake: Wake): Promise<void> {
    const heartbeat = wake.active ? Date.now() + HEARTBEAT_MS : undefined;
    const at = heartbeat === undefined || wake.at === undefined ? (heartbeat ?? wake.at) : Math.min(heartbeat, wake.at);
    if (at === undefined) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }
}
