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

/**
 * Who a benefit applies to. `tutti` is every armed force. A specialty belongs to a force through `SPECIALTY_OF`,
 * so someone in the Alpini also sees what is open to the whole Esercito.
 */
export const CORPS = [
  "tutti",
  "esercito",
  "marina",
  "aeronautica",
  "carabinieri",
  "alpini",
  "bersaglieri",
  "paracadutisti",
  "lagunari",
  "granatieri",
  "genio",
  "san-marco",
] as const;

export const Corps = Schema.Literals(CORPS);
export type Corps = typeof Corps.Type;

export const SPECIALTY_OF: Partial<Record<Corps, Corps>> = {
  alpini: "esercito",
  bersaglieri: "esercito",
  paracadutisti: "esercito",
  lagunari: "esercito",
  granatieri: "esercito",
  genio: "esercito",
  "san-marco": "marina",
};

/** True when a benefit open to `open` is available to someone serving in `mine`. */
export const appliesTo = (open: readonly Corps[], mine: Corps) =>
  open.includes("tutti") || open.includes(mine) || (SPECIALTY_OF[mine] !== undefined && open.includes(SPECIALTY_OF[mine]));

export const BenefitDraft = Schema.Struct({
  title: Schema.String,
  summary: Schema.String,
  category: Category,
  provider: Schema.String,
  audience: Schema.String,
  corps: Schema.Array(Corps),
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
  readonly corps: readonly Corps[];
  readonly value: string | null;
  readonly howToClaim: string;
  readonly region: string;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly validUntil: string | null;
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
}

export type RunStatus = "running" | "completed" | "failed";
export type RunEventKind = "search" | "read" | "saved" | "checked" | "retired";

export interface RunEvent {
  readonly id: number;
  readonly kind: RunEventKind;
  readonly detail: string;
  readonly at: number;
}

/** A benefit the weekly check took out of the catalogue. */
export interface EndedBenefit {
  readonly id: string;
  readonly title: string;
  readonly provider: string;
  readonly reason: string;
}

export interface RunDetail {
  readonly events: readonly RunEvent[];
  readonly added: readonly Benefit[];
  readonly ended: readonly EndedBenefit[];
}

export interface Run {
  readonly id: string;
  readonly status: RunStatus;
  readonly summary: string | null;
  readonly startedAt: number;
  readonly finishedAt: number | null;
}

/** Questions a signed-in user may ask the agent each calendar month. */
export const MONTHLY_QUESTIONS = 30;

export interface Question {
  readonly id: number;
  readonly question: string;
  readonly answer: string | null;
  readonly at: number;
}
