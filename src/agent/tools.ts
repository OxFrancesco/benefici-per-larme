import { defineTool } from "@earendil-works/pi-durable";
import { obj, oneOf, opt, str } from "@earendil-works/pi-schema";
import type { RpcAsync } from "@alchemy.run/cloudflare/Bridge";
import type { Rpc } from "alchemy/Rpc";
import type Backend from "../backend/api.ts";
import { CATEGORIES } from "../domain.ts";
import { readPage, search } from "./context-dev.ts";

/** A page longer than this is cut so one read cannot fill the model's context. */
const MAX_PAGE_CHARACTERS = 14_000;

export interface ToolDeps {
  readonly backend: RpcAsync<Rpc.Shape<Backend>>;
  readonly contextDevKey: string;
  readonly runId: () => string;
}

const text = (value: string) => ({ output: [{ type: "text" as const, text: value }] });

export function createScoutTools({ backend, contextDevKey, runId }: ToolDeps) {
  const webSearch = defineTool({
    name: "web_search",
    description:
      "Search the Italian web. Returns titles, URLs and snippets. Supports operators such as site: and quoted phrases.",
    parameters: obj({ query: str({ minLength: 1, maxLength: 300 }) }),
    replay: "safe",
    execute: async (args) => {
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
    description: "List the benefits already on the dashboard, so you look for new ones and refresh stale ones.",
    parameters: obj({}),
    replay: "safe",
    execute: async () => {
      const benefits = await backend.listBenefits();
      return text(
        JSON.stringify(
          benefits.map(({ id, title, provider, category, sourceUrl }) => ({ id, title, provider, category, sourceUrl })),
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
      value: opt(str({ description: "The concrete amount when stated, e.g. '30%' or '€500 l'anno'" })),
      howToClaim: str({ description: "The steps to get it" }),
      region: str({ description: "'Nazionale' or the region or city it applies to" }),
      sourceUrl: str({ description: "The page you read that confirms it" }),
      sourceTitle: str(),
      validUntil: opt(str({ description: "Expiry as YYYY-MM-DD when the page states one" })),
    }),
    replay: "safe",
    execute: async (args) => {
      const saved = await backend.saveBenefit(runId(), args);
      await backend.logEvent(runId(), "saved", args.title);
      return text(saved.created ? `Saved as new: ${saved.id}` : `Updated existing: ${saved.id}`);
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

  return [webSearch, readPageTool, listSavedBenefits, saveBenefit, finishRun];
}
