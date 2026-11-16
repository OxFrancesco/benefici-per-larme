import * as Schema from "effect/Schema";

export const CATEGORIES = [
  "casa",
  "salute",
  "trasporti",
  "acquisti",
  "finanza",
  "formazione",
  "famiglia",
  "tempo-libero",
  "carriera",
  "altro",
] as const;

export const Category = Schema.Literals(CATEGORIES);
export type Category = typeof Category.Type;

export const BenefitDraft = Schema.Struct({
  title: Schema.String,
  summary: Schema.String,
  category: Category,
  provider: Schema.String,
  audience: Schema.String,
  value: Schema.optional(Schema.String),
  howToClaim: Schema.String,
  region: Schema.String,
  sourceUrl: Schema.String,
  sourceTitle: Schema.String,
  validUntil: Schema.optional(Schema.String),
});
export interface BenefitDraft extends Schema.Schema.Type<typeof BenefitDraft> {}

export interface Benefit {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: Category;
  readonly provider: string;
  readonly audience: string;
  readonly value: string | null;
  readonly howToClaim: string;
  readonly region: string;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly validUntil: string | null;
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
}

export type RunTrigger = "cron" | "manual";
export type RunStatus = "running" | "completed" | "failed";
export type RunEventKind = "search" | "read" | "saved" | "note";

export interface RunEvent {
  readonly id: number;
  readonly kind: RunEventKind;
  readonly detail: string;
  readonly at: number;
}

export interface Run {
  readonly id: string;
  readonly trigger: RunTrigger;
  readonly status: RunStatus;
  readonly summary: string | null;
  readonly startedAt: number;
  readonly finishedAt: number | null;
}
