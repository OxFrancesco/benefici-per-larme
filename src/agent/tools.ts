import { defineTool } from "@earendil-works/pi-durable";
import { arr, obj, oneOf, opt, str } from "@earendil-works/pi-schema";
import type { RpcAsync } from "@alchemy.run/cloudflare/Bridge";
import type { Rpc } from "alchemy/Rpc";
import type Backend from "../backend/api.ts";
import { CATEGORIES, CORPS } from "../domain.ts";
import { readPage, search } from "./context-dev.ts";

/** A page longer than this is cut so one read cannot fill the model's context. */
const MAX_PAGE_CHARACTERS = 14_000;

export interface ToolDeps {
  readonly backend: RpcAsync<Rpc.Shape<Backend>>;
  readonly contextDevKey: string;
  readonly runId: () => string;
  /** Counts one use against the run's budget. False once the budget for that kind is spent. */
  readonly spend: (kind: "search" | "read") => Promise<boolean>;
}

const OVER_BUDGET = "This run's budget for this tool is used up. Save what you have verified, then call finish_run.";

const text = (value: string) => ({ output: [{ type: "text" as const, text: value }] });

export function createScoutTools({ backend, contextDevKey, runId, spend }: ToolDeps) {
  const webSearch = defineTool({
    name: "web_search",
    description:
      "Search the Italian web. Returns titles, URLs and snippets. Supports operators such as site: and quoted phrases.",
    parameters: obj({ query: str({ minLength: 1, maxLength: 300 }) }),
    replay: "safe",
    execute: async (args) => {
      if (!(await spend("search"))) return text(OVER_BUDGET);
      const results = await search(contextDevKey, args.query);
      await backend.logEvent(runId(), "search", args.query);
      return text(JSON.stringify(results));
    },
  });

  const readPageTool = defineTool({
    name: "read_page",
    description: "Read a web page or PDF as Markdown. Use it on promising search results before saving a benefit.",
    parameters: obj({ url: str({ description: "Absolute https URL" }) }),
    replay: "safe",
    execute: async (args) => {
      if (!(await spend("read"))) return text(OVER_BUDGET);
      const page = await readPage(contextDevKey, args.url);
      await backend.logEvent(runId(), "read", page.title);
      const cut = page.markdown.length > MAX_PAGE_CHARACTERS;
      return text(
        `# ${page.title}\n\n${page.markdown.slice(0, MAX_PAGE_CHARACTERS)}${cut ? "\n\n[page cut here]" : ""}`,
      );
    },
  });

  const listSavedBenefits = defineTool({
    name: "list_saved_benefits",
    description:
      "List the benefits in the catalogue with their source page and end date. Use it to re-check each one, and to avoid saving duplicates.",
    parameters: obj({}),
    replay: "safe",
    execute: async () => {
      const benefits = await backend.listBenefits();
      return text(
        JSON.stringify(
          benefits.map(({ id, title, provider, category, corps, sourceUrl, validUntil }) => ({
            id,
            title,
            provider,
            category,
            corps,
            sourceUrl,
            validUntil,
          })),
        ),
      );
    },
  });

  const saveBenefit = defineTool({
    name: "save_benefit",
    description:
      "Save one benefit to the dashboard. Only save what a page you read confirms. Saving the same provider and title again updates the entry. All text fields in Italian.",
    parameters: obj({
      title: str({ description: "Short name of the benefit, e.g. 'Sconto 30% sui treni Frecce'" }),
      summary: str({ description: "Two or three plain sentences on what the soldier gets" }),
      category: oneOf([...CATEGORIES]),
      provider: str({ description: "Who grants it, e.g. 'Trenitalia' or 'Ministero della Difesa'" }),
      audience: str({ description: "Who is eligible, e.g. 'Personale Esercito in servizio e familiari'" }),
      corps: arr(oneOf([...CORPS]), {
        minItems: 1,
        description:
          "Every armed force the page says it covers. Use ['tutti'] when it is open to all Forze Armate or all Difesa personnel. An Esercito agreement covers every unit in it, so use 'esercito' for the Alpini, Lagunari and the rest",
      }),
      value: opt(
        str({
          maxLength: 16,
          description: "The headline number only, at most 16 characters, e.g. '20%' or '€500 l'anno'. Omit it when there is no single number; put details in summary",
        }),
      ),
      howToClaim: str({ description: "The steps to get it" }),
      region: str({ description: "'Nazionale' or the region or city it applies to" }),
      sourceUrl: str({ description: "The page you read that confirms it" }),
      sourceTitle: str(),
      validUntil: opt(str({ description: "Expiry as YYYY-MM-DD when the page states one" })),
    }),
    replay: "safe",
    execute: async (args) => {
      // Models sometimes send null or "" for a field they have nothing for.
      const draft = Object.fromEntries(Object.entries(args).filter(([, value]) => value != null && value !== ""));
      const saved = await backend.saveBenefit(runId(), draft);
      await backend.logEvent(runId(), "saved", args.title);
      return text(saved.created ? `Saved as new: ${saved.id}` : `Updated existing: ${saved.id}`);
    },
  });

  const checkBenefit = defineTool({
    name: "check_benefit",
    description:
      "Report the result of re-checking one catalogue benefit. Use status 'ended' only when its source says it is over, expired, withdrawn or replaced, or when the source page is gone and a search finds no current trace of it. An ended benefit leaves the catalogue.",
    parameters: obj({
      id: str({ description: "The benefit id from list_saved_benefits" }),
      status: oneOf(["active", "ended"]),
      reason: opt(str({ description: "For 'ended': one Italian sentence on why, e.g. 'Convenzione scaduta il 31 dicembre 2026'" })),
    }),
    replay: "safe",
    execute: async (args) => {
      const ended = args.status === "ended";
      const title = await backend.checkBenefit(runId(), args.id, ended, args.reason ?? "Non più disponibile");
      if (title === undefined) return text(`No active benefit has the id ${args.id}.`);
      await backend.logEvent(runId(), ended ? "retired" : "checked", title);
      return text(ended ? `Removed from the catalogue: ${title}` : `Confirmed: ${title}`);
    },
  });

  const finishRun = defineTool({
    name: "finish_run",
    description: "Close this research run. Call it once, last, when you have saved everything you verified.",
    parameters: obj({
      summary: str({ description: "One or two Italian sentences on what this run found" }),
    }),
    replay: "safe",
    execute: async (args) => {
      await backend.finishRun(runId(), "completed", args.summary);
      return { ...text("Run closed."), control: { terminate: true } };
    },
  });

  return [webSearch, readPageTool, listSavedBenefits, saveBenefit, checkBenefit, finishRun];
}
