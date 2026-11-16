import { toRpcAsync } from "@alchemy.run/cloudflare/Bridge";
import { auth } from "@clerk/tanstack-react-start/server";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "./admin.ts";
import type { CatalogueView } from "./agent/rpc.ts";
import type Backend from "./backend/api.ts";
import type { Question, Run } from "./domain.ts";
import { env } from "./env.ts";

const backend = () => toRpcAsync<Backend>(env.BACKEND);

async function requireSession() {
  const session = await auth();
  if (!session.isAuthenticated) throw redirect({ href: "/sign-in" });
  return session;
}

async function requireAdmin() {
  const session = await requireSession();
  // Everyone else gets the same answer as for a page that does not exist.
  if (!(await isAdmin(env.CLERK_SECRET_KEY, session.userId))) throw notFound();
  return session;
}

/** The agent Worker checks the session token itself, so it never trusts the website blindly. */
async function callAgent(path: string, token: string | null, body?: unknown): Promise<Response> {
  return env.AGENT.fetch(`https://agent${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

/** The catalogue is public. Bookmarks, questions and the admin link are added for a signed-in person. */
export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const session = await auth();
  const [benefits, runs] = await Promise.all([backend().listBenefits(), backend().listRuns()]);
  const updatedAt = runs.find((run) => run.status === "completed")?.finishedAt ?? null;
  if (!session.isAuthenticated) {
    return { benefits, updatedAt, signedIn: false, admin: false, bookmarks: [], questions: [], remaining: 0 };
  }
  const [asked, bookmarks, admin] = await Promise.all([
    backend().listQuestions(session.userId),
    backend().listBookmarks(session.userId),
    isAdmin(env.CLERK_SECRET_KEY, session.userId),
  ]);
  return {
    benefits,
    updatedAt,
    signedIn: true,
    admin,
    bookmarks,
    questions: asked.questions,
    remaining: asked.remaining,
  };
});

export const setBookmark = createServerFn({ method: "POST" })
  .validator((input: { benefitId: string; saved: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    await backend().setBookmark(session.userId, data.benefitId, data.saved);
  });

export type AskResult =
  | ({ ok: true; remaining: number; view?: CatalogueView } & Question)
  | { ok: false; reason: "quota" | "failed" };

export const askAgent = createServerFn({ method: "POST" })
  .validator((input: { question: string }) => input)
  .handler(async ({ data }): Promise<AskResult> => {
    const session = await requireSession();
    const response = await callAgent("/questions", await session.getToken(), { question: data.question });
    if (response.status === 429) return { ok: false, reason: "quota" };
    if (!response.ok) return { ok: false, reason: "failed" };
    return { ok: true, ...(await response.json<Question & { remaining: number; view?: CatalogueView }>()) };
  });

export const getAdmin = createServerFn({ method: "GET" })
  .validator((input: { runId?: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const runs = await backend().listRuns();
    const run = runs.find((candidate) => candidate.id === data.runId) ?? runs[0];
    const detail = run === undefined ? null : await backend().runDetail(run.id);
    return { runs, run: run ?? null, detail };
  });

export const startRun = createServerFn({ method: "POST" }).handler(async (): Promise<Run> => {
  const session = await requireAdmin();
  const response = await callAgent("/runs", await session.getToken());
  if (!response.ok) throw new Error("The agent could not start a run");
  return response.json();
});
