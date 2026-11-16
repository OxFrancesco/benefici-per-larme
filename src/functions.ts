import { toRpcAsync } from "@alchemy.run/cloudflare/Bridge";
import { createServerFn } from "@tanstack/react-start";
import type Backend from "./backend/api.ts";
import type { Run } from "./domain.ts";
import { env } from "./env.ts";

const backend = () => toRpcAsync<Backend>(env.BACKEND);

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const [benefits, runs] = await Promise.all([backend().listBenefits(), backend().listRuns()]);
  const latest = runs[0];
  const events = latest === undefined ? [] : await backend().listRunEvents(latest.id);
  return { benefits, runs, events };
});

export const startRun = createServerFn({ method: "POST" }).handler(async (): Promise<Run> => {
  const response = await env.AGENT.fetch("https://agent/runs", { method: "POST" });
  if (!response.ok) throw new Error("The agent could not start a run");
  return response.json();
});
