import * as Cloudflare from "@alchemy.run/cloudflare";
import * as SQL from "@alchemy.run/cloudflare/D1/SQL";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import {
  type Benefit,
  BenefitDraft,
  type Category,
  type Run,
  type RunEvent,
  type RunEventKind,
  type RunStatus,
  type RunTrigger,
} from "../domain.ts";
import { Database } from "./database.ts";

interface BenefitRow {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: Category;
  readonly provider: string;
  readonly audience: string;
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
  readonly trigger: RunTrigger;
  readonly status: RunStatus;
  readonly summary: string | null;
  readonly started_at: number;
  readonly finished_at: number | null;
}

const toBenefit = (row: BenefitRow): Benefit => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  category: row.category,
  provider: row.provider,
  audience: row.audience,
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
  trigger: row.trigger,
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

/** A run still marked running after this long was lost, so a new one may start. */
const STALE_RUN_MS = 30 * 60 * 1000;

/** The website is public, so a manual trigger cannot start runs back to back. */
const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;

export default class Backend extends Cloudflare.Worker<Backend>()(
  "Backend",
  { main: import.meta.url, workersDev: false },
  Effect.gen(function* () {
    const d1 = yield* Cloudflare.D1.QueryDatabase(Database);
    const sql = yield* SQL.D1(d1);

    return {
      listBenefits: Effect.fn("Backend.listBenefits")(function* () {
        const rows = yield* sql<BenefitRow>`SELECT * FROM benefits ORDER BY first_seen_at DESC`;
        return rows.map(toBenefit);
      }),

      saveBenefit: Effect.fn("Backend.saveBenefit")(function* (runId: string, input: unknown) {
        const draft = yield* Schema.decodeUnknownEffect(BenefitDraft)(input);
        const id = slug(`${draft.provider} ${draft.title}`);
        const now = Date.now();
        const [existing] = yield* sql<{ id: string }>`SELECT id FROM benefits WHERE id = ${id}`;
        yield* sql`
          INSERT INTO benefits (
            id, title, summary, category, provider, audience, value, how_to_claim, region,
            source_url, source_title, valid_until, first_seen_at, last_seen_at, run_id
          ) VALUES (
            ${id}, ${draft.title}, ${draft.summary}, ${draft.category}, ${draft.provider},
            ${draft.audience}, ${draft.value ?? null}, ${draft.howToClaim}, ${draft.region},
            ${draft.sourceUrl}, ${draft.sourceTitle}, ${draft.validUntil ?? null}, ${now}, ${now}, ${runId}
          )
          ON CONFLICT (id) DO UPDATE SET
            title = excluded.title, summary = excluded.summary, category = excluded.category,
            audience = excluded.audience, value = excluded.value, how_to_claim = excluded.how_to_claim,
            region = excluded.region, source_url = excluded.source_url, source_title = excluded.source_title,
            valid_until = excluded.valid_until, last_seen_at = excluded.last_seen_at
        `;
        return { id, created: existing === undefined };
      }),

      /** Opens a run, or returns the one already running so two triggers never overlap. */
      startRun: Effect.fn("Backend.startRun")(function* (trigger: RunTrigger) {
        const now = Date.now();
        const [active] = yield* sql<RunRow>`
          SELECT * FROM runs WHERE status = 'running' AND started_at > ${now - STALE_RUN_MS}
          ORDER BY started_at DESC LIMIT 1
        `;
        if (active !== undefined) return { run: toRun(active), created: false };
        const [last] = yield* sql<RunRow>`SELECT * FROM runs ORDER BY started_at DESC LIMIT 1`;
        if (trigger === "manual" && last !== undefined && last.started_at > now - MANUAL_COOLDOWN_MS) {
          return { run: toRun(last), created: false };
        }
        yield* sql`
          UPDATE runs SET status = 'failed', finished_at = ${now}, summary = 'Interrotta'
          WHERE status = 'running'
        `;
        const id = crypto.randomUUID();
        yield* sql`
          INSERT INTO runs (id, trigger, status, started_at) VALUES (${id}, ${trigger}, 'running', ${now})
        `;
        const run: Run = { id, trigger, status: "running", summary: null, startedAt: now, finishedAt: null };
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

      listRunEvents: Effect.fn("Backend.listRunEvents")(function* (runId: string) {
        return yield* sql<RunEvent>`
          SELECT id, kind, detail, at FROM run_events WHERE run_id = ${runId} ORDER BY id
        `;
      }),

      fetch: Effect.succeed(HttpServerResponse.text("Not found", { status: 404 })),
    };
  }).pipe(Effect.provide(Cloudflare.D1.QueryDatabaseBinding)),
) {}
