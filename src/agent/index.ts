import { toRpcAsync } from "@alchemy.run/cloudflare/Bridge";
import type { AgentEnv } from "../../alchemy.run.ts";
import type Backend from "../backend/api.ts";
import type { RunTrigger } from "../domain.ts";

export { Scout } from "./scout.ts";

async function startRun(env: AgentEnv, trigger: RunTrigger) {
  const { run, created } = await toRpcAsync<Backend>(env.BACKEND).startRun(trigger);
  if (created) await env.SCOUT.getByName(run.id).start(run.id);
  return run;
}

export default {
  // Reached only through the website's service binding; the Worker has no public URL.
  async fetch(request: Request, env: AgentEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/runs") {
      return Response.json(await startRun(env, "manual"), { status: 202 });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: AgentEnv): Promise<void> {
    await startRun(env, "cron");
  },
} satisfies ExportedHandler<AgentEnv>;
