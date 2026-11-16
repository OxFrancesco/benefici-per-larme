import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import type { AdvisorRpc, ScoutRpc } from "./src/agent/rpc.ts";
import Backend from "./src/backend/api.ts";

/**
 * The research agent: a plain Worker whose `Scout` Durable Object runs Pi Durable.
 * It has no public URL. Cron starts a research run every Monday at 05:00 UTC, and the website sends it questions.
 */
export const Agent = Cloudflare.Worker("Agent", {
  main: "./src/agent/index.ts",
  workersDev: false,
  crons: ["0 5 * * 1"],
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    BACKEND: Backend,
    SCOUT: Cloudflare.DurableObject<ScoutRpc>("Scout", { className: "Scout" }),
    ADVISOR: Cloudflare.DurableObject<AdvisorRpc>("Advisor", { className: "Advisor" }),
    OPENROUTER_API_KEY: Config.Redacted("OPENROUTER_API_KEY"),
    CONTEXT_DEV_API_KEY: Config.Redacted("CONTEXT_DEV_API_KEY"),
    CLERK_SECRET_KEY: Config.Redacted("BENEFIT_RADAR_CLERK_SECRET_KEY"),
  },
});

export type AgentEnv = Cloudflare.InferEnv<typeof Agent>;

export class Website extends Cloudflare.Website.Vite<Website>()("Website", {
  domain: "esercitoitaliano.buddytools.org",
  // The zone has a `*.buddytools.org/*` route owned by another project. This narrower one wins for our hostname.
  routes: [{ pattern: "esercitoitaliano.buddytools.org/*", zoneName: "buddytools.org" }],
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    BACKEND: Backend,
    AGENT: Agent,
    CLERK_SECRET_KEY: Config.Redacted("BENEFIT_RADAR_CLERK_SECRET_KEY"),
    CLERK_PUBLISHABLE_KEY: Config.String("VITE_CLERK_PUBLISHABLE_KEY"),
  },
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
