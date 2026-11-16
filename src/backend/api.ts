import * as Cloudflare from "@alchemy.run/cloudflare";
import * as SQL from "@alchemy.run/cloudflare/D1/SQL";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import {
  type Benefit,
  BenefitDraft,
  type Category,
  CORPS,
  type Corps,
  type EndedBenefit,
  LEGACY_UNITS,
  MONTHLY_QUESTIONS,
  type Question,
  type Run,
  type RunDetail,
  type RunEvent,
  type RunEventKind,
  type RunStatus,
} from "../domain.ts";
import { Database } from "./database.ts";

interface BenefitRow {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: Category;
  readonly provider: string;
  readonly audience: string;
  readonly corps: string;
  readonly value: string | null;
  readonly how_to_claim: string;
  readonly region: string;
  readonly source_url: string;
  readonly source_title: string;
  readonly valid_until: string | null;
  readonly first_seen_at: number;
  readonly last_seen_at: number;
}

interface RunRow {
  readonly id: string;
  readonly status: RunStatus;
  readonly summary: string | null;
  readonly started_at: number;
  readonly finished_at: number | null;
}

const parseCorps = (stored: string): Corps[] => {
  const known: readonly string[] = CORPS;
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) return [];
  const forces = parsed.flatMap((id): Corps[] =>
    typeof id !== "string" ? [] : known.includes(id) ? [id as Corps] : id in LEGACY_UNITS ? [LEGACY_UNITS[id]] : [],
  );
  return [...new Set(forces)];
};

const toBenefit = (row: BenefitRow): Benefit => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  category: row.category,
  provider: row.provider,
  audience: row.audience,
  corps: parseCorps(row.corps),
  value: row.value,
  howToClaim: row.how_to_claim,
  region: row.region,
  sourceUrl: row.source_url,
  sourceTitle: row.source_title,
  validUntil: row.valid_until,
  firstSeenAt: row.first_seen_at,
  lastSeenAt: row.last_seen_at,
});

const toRun = (row: RunRow): Run => ({
  id: row.id,
  status: row.status,
  summary: row.summary,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
});

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const monthStart = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
};

/** A run still marked running after this long was lost, so a new one may start. */
const STALE_RUN_MS = 30 * 60 * 1000;

export default class Backend extends Cloudflare.Worker<Backend>()(
  "Backend",
  { main: import.meta.url, workersDev: false },
  Effect.gen(function* () {
    const d1 = yield* Cloudflare.D1.QueryDatabase(Database);
    const sql = yield* SQL.D1(d1);

    return {
      listBenefits: Effect.fn("Backend.listBenefits")(function* () {
        const rows = yield* sql<BenefitRow>`
          SELECT * FROM benefits WHERE ended_at IS NULL ORDER BY first_seen_at DESC
        `;
        return rows.map(toBenefit);
      }),

      saveBenefit: Effect.fn("Backend.saveBenefit")(function* (runId: string, input: unknown) {
        const draft = yield* Schema.decodeUnknownEffect(BenefitDraft)(input);
        const id = slug(`${draft.provider} ${draft.title}`);
        const now = Date.now();
        const [existing] = yield* sql<{ id: string }>`SELECT id FROM benefits WHERE id = ${id}`;
        yield* sql`
          INSERT INTO benefits (
            id, title, summary, category, provider, audience, corps, value, how_to_claim, region,
            source_url, source_title, valid_until, first_seen_at, last_seen_at, run_id
          ) VALUES (
            ${id}, ${draft.title}, ${draft.summary}, ${draft.category}, ${draft.provider},
            ${draft.audience}, ${JSON.stringify(draft.corps)}, ${draft.value ?? null}, ${draft.howToClaim}, ${draft.region},
            ${draft.sourceUrl}, ${draft.sourceTitle}, ${draft.validUntil ?? null}, ${now}, ${now}, ${runId}
          )
          ON CONFLICT (id) DO UPDATE SET
            title = excluded.title, summary = excluded.summary, category = excluded.category,
            audience = excluded.audience, corps = excluded.corps, value = excluded.value, how_to_claim = excluded.how_to_claim,
            region = excluded.region, source_url = excluded.source_url, source_title = excluded.source_title,
            valid_until = excluded.valid_until, last_seen_at = excluded.last_seen_at,
            checked_at = excluded.last_seen_at, ended_at = NULL, ended_reason = NULL, ended_run_id = NULL
        `;
        return { id, created: existing === undefined };
      }),

      /** Opens a run, or returns the one already running so two triggers never overlap. */
      startRun: Effect.fn("Backend.startRun")(function* () {
        const now = Date.now();
        const [active] = yield* sql<RunRow>`
          SELECT * FROM runs WHERE status = 'running' AND started_at > ${now - STALE_RUN_MS}
          ORDER BY started_at DESC LIMIT 1
        `;
        if (active !== undefined) return { run: toRun(active), created: false };
        yield* sql`
          UPDATE runs SET status = 'failed', finished_at = ${now}, summary = 'Interrotta'
          WHERE status = 'running'
        `;
        const id = crypto.randomUUID();
        yield* sql`
          INSERT INTO runs (id, trigger, status, started_at) VALUES (${id}, 'cron', 'running', ${now})
        `;
        // A benefit whose stated end date has passed leaves the catalogue without waiting for the agent.
        const today = new Date(now).toISOString().slice(0, 10);
        yield* sql`
          UPDATE benefits SET ended_at = ${now}, ended_reason = 'Scaduto il ' || valid_until, ended_run_id = ${id}
          WHERE ended_at IS NULL AND valid_until IS NOT NULL AND valid_until < ${today}
        `;
        const run: Run = { id, status: "running", summary: null, startedAt: now, finishedAt: null };
        return { run, created: true };
      }),

      finishRun: Effect.fn("Backend.finishRun")(function* (
        runId: string,
        status: Exclude<RunStatus, "running">,
        summary: string,
      ) {
        yield* sql`
          UPDATE runs SET status = ${status}, summary = ${summary}, finished_at = ${Date.now()}
          WHERE id = ${runId} AND status = 'running'
        `;
      }),

      /** The weekly check: the agent re-read a benefit's source and reports whether it still holds. */
      checkBenefit: Effect.fn("Backend.checkBenefit")(function* (
        runId: string,
        benefitId: string,
        ended: boolean,
        reason: string,
      ) {
        const now = Date.now();
        const rows = ended
          ? yield* sql<{ title: string }>`
              UPDATE benefits SET ended_at = ${now}, ended_reason = ${reason}, ended_run_id = ${runId}, checked_at = ${now}
              WHERE id = ${benefitId} AND ended_at IS NULL RETURNING title
            `
          : yield* sql<{ title: string }>`
              UPDATE benefits SET checked_at = ${now}, last_seen_at = ${now}
              WHERE id = ${benefitId} AND ended_at IS NULL RETURNING title
            `;
        return rows[0]?.title;
      }),

      listBookmarks: Effect.fn("Backend.listBookmarks")(function* (userId: string) {
        const rows = yield* sql<{ benefit_id: string }>`
          SELECT benefit_id FROM bookmarks WHERE user_id = ${userId} ORDER BY at DESC
        `;
        return rows.map((row) => row.benefit_id);
      }),

      setBookmark: Effect.fn("Backend.setBookmark")(function* (userId: string, benefitId: string, saved: boolean) {
        if (saved) {
          yield* sql`
            INSERT INTO bookmarks (user_id, benefit_id, at) VALUES (${userId}, ${benefitId}, ${Date.now()})
            ON CONFLICT (user_id, benefit_id) DO NOTHING
          `;
        } else {
          yield* sql`DELETE FROM bookmarks WHERE user_id = ${userId} AND benefit_id = ${benefitId}`;
        }
      }),

      runDetail: Effect.fn("Backend.runDetail")(function* (runId: string) {
        const events = yield* sql<RunEvent>`
          SELECT id, kind, detail, at FROM run_events WHERE run_id = ${runId} ORDER BY id
        `;
        const added = yield* sql<BenefitRow>`
          SELECT * FROM benefits WHERE run_id = ${runId} ORDER BY first_seen_at
        `;
        const ended = yield* sql<EndedBenefit>`
          SELECT id, title, provider, ended_reason AS reason FROM benefits
          WHERE ended_run_id = ${runId} ORDER BY ended_at
        `;
        const detail: RunDetail = { events, added: added.map(toBenefit), ended };
        return detail;
      }),

      logEvent: Effect.fn("Backend.logEvent")(function* (
        runId: string,
        kind: RunEventKind,
        detail: string,
      ) {
        yield* sql`
          INSERT INTO run_events (run_id, kind, detail, at)
          VALUES (${runId}, ${kind}, ${detail.slice(0, 500)}, ${Date.now()})
        `;
      }),

      listRuns: Effect.fn("Backend.listRuns")(function* () {
        const rows = yield* sql<RunRow>`SELECT * FROM runs ORDER BY started_at DESC LIMIT 20`;
        return rows.map(toRun);
      }),

      /** Records a question against the user's monthly allowance. `id` is absent once the allowance is spent. */
      openQuestion: Effect.fn("Backend.openQuestion")(function* (userId: string, question: string) {
        const [used] = yield* sql<{ n: number }>`
          SELECT count(*) AS n FROM questions WHERE user_id = ${userId} AND at >= ${monthStart()}
        `;
        const asked = used?.n ?? 0;
        if (asked >= MONTHLY_QUESTIONS) return { remaining: 0 };
        const [row] = yield* sql<{ id: number }>`
          INSERT INTO questions (user_id, question, at) VALUES (${userId}, ${question}, ${Date.now()})
          RETURNING id
        `;
        return { id: row?.id, remaining: MONTHLY_QUESTIONS - asked - 1 };
      }),

      answerQuestion: Effect.fn("Backend.answerQuestion")(function* (id: number, answer: string) {
        yield* sql`UPDATE questions SET answer = ${answer} WHERE id = ${id}`;
      }),

      /** Gives the question back when the agent could not answer it. */
      dropQuestion: Effect.fn("Backend.dropQuestion")(function* (id: number) {
        yield* sql`DELETE FROM questions WHERE id = ${id} AND answer IS NULL`;
      }),

      listQuestions: Effect.fn("Backend.listQuestions")(function* (userId: string) {
        const [used] = yield* sql<{ n: number }>`
          SELECT count(*) AS n FROM questions WHERE user_id = ${userId} AND at >= ${monthStart()}
        `;
        const recent = yield* sql<Question>`
          SELECT id, question, answer, at FROM questions
          WHERE user_id = ${userId} AND answer IS NOT NULL ORDER BY id DESC LIMIT 30
        `;
        return { questions: [...recent].reverse(), remaining: Math.max(0, MONTHLY_QUESTIONS - (used?.n ?? 0)) };
      }),

      fetch: Effect.succeed(HttpServerResponse.text("Not found", { status: 404 })),
    };
  }).pipe(Effect.provide(Cloudflare.D1.QueryDatabaseBinding)),
) {}
