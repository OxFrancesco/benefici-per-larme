import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import type { Scout } from "./src/agent/scout.ts";
import Backend from "./src/backend/api.ts";

/**
 * The research agent: a plain Worker whose `Scout` Durable Object runs Pi Durable.
 * It has no public URL. Cron starts a run every 6 hours and the website starts one on demand.
 */
export const Agent = Cloudflare.Worker("Agent", {
  main: "./src/agent/index.ts",
  workersDev: false,
  crons: ["0 */6 * * *"],
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    BACKEND: Backend,
    SCOUT: Cloudflare.DurableObject<Scout>("Scout", { className: "Scout" }),
    OPENROUTER_API_KEY: Config.Redacted("OPENROUTER_API_KEY"),
    CONTEXT_DEV_API_KEY: Config.Redacted("CONTEXT_DEV_API_KEY"),
  },
});

export type AgentEnv = Cloudflare.InferEnv<typeof Agent>;

export class Website extends Cloudflare.Website.Vite<Website>()("Website", {
  compatibility: { flags: ["nodejs_compat"] },
  env: { BACKEND: Backend, AGENT: Agent },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "BenefitRadar",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    yield* Backend;
    yield* Agent;
    const website = yield* Website;
    return { url: website.url.as<string>() };
  }),
);
