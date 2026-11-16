import { toRpcAsync } from "@alchemy.run/cloudflare/Bridge";
import { verifyToken } from "@clerk/backend";
import type { AgentEnv } from "../../alchemy.run.ts";
import { isAdmin } from "../admin.ts";
import type Backend from "../backend/api.ts";
import { advisorStub, scoutStub } from "./rpc.ts";

export { Advisor } from "./advisor.ts";
export { Scout } from "./scout.ts";

const MAX_QUESTION_CHARACTERS = 500;

/** The signed-in user's ID, or undefined when the request carries no valid Clerk session token. */
async function userOf(request: Request, env: AgentEnv): Promise<string | undefined> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return undefined;
  try {
    return (await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })).sub;
  } catch {
    return undefined;
  }
}

async function answer(env: AgentEnv, userId: string, question: string): Promise<Response> {
  const backend = toRpcAsync<Backend>(env.BACKEND);
  const { id, remaining } = await backend.openQuestion(userId, question);
  if (id === undefined) return Response.json({ error: "quota" }, { status: 429 });
  try {
    const reply = await advisorStub(env.ADVISOR, userId).ask(question);
    await backend.answerQuestion(id, reply.answer);
    return Response.json({ id, question, answer: reply.answer, at: Date.now(), remaining, view: reply.view });
  } catch (error) {
    console.error(JSON.stringify({ message: "Question failed", error: String(error) }));
    await backend.dropQuestion(id);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}

async function startRun(env: AgentEnv) {
  const { run, created } = await toRpcAsync<Backend>(env.BACKEND).startRun();
  if (created) await scoutStub(env.SCOUT, run.id).start(run.id);
  return run;
}

export default {
  // Reached only through the website's service binding, and only with a valid Clerk session token.
  async fetch(request: Request, env: AgentEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || (pathname !== "/questions" && pathname !== "/runs")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const userId = await userOf(request, env);
    if (userId === undefined) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (pathname === "/runs") {
      if (!(await isAdmin(env.CLERK_SECRET_KEY, userId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await startRun(env), { status: 202 });
    }
    const { question } = await request.json<{ question?: unknown }>();
    if (typeof question !== "string" || question.trim() === "" || question.length > MAX_QUESTION_CHARACTERS) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    return answer(env, userId, question.trim());
  },

  // The weekly research run. Only the admin can also start one by hand.
  async scheduled(_controller: ScheduledController, env: AgentEnv): Promise<void> {
    await startRun(env);
  },
} satisfies ExportedHandler<AgentEnv>;
