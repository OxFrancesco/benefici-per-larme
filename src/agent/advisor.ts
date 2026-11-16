import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { AssistantEntry, defineTool } from "@earendil-works/pi-durable";
import { arr, obj, str } from "@earendil-works/pi-schema";
import type { AgentEnv } from "../../alchemy.run.ts";
import { readPage, search } from "./context-dev.ts";
import { MODEL, PiObject } from "./pi-object.ts";
import type { AdvisorReply, AdvisorRpc, CatalogueView } from "./rpc.ts";

const PREAMBLE = `You help the personnel of the Italian armed forces and their families with the benefits, discounts and agreements they are entitled to. You work inside Benefici per l'Arme, a catalogue of benefits a research agent has already verified.

How to answer:
1. Call list_benefits first, every time. The catalogue is your main source.
2. When the catalogue covers the question, answer from it and call show_in_catalogue so the person sees the matching benefits on screen.
3. When it does not, research the web: web_search, then read_page on the best results. You have 4 searches and 4 page reads per question. Say clearly which parts come from the web and are not in the catalogue yet, and name the source site.
4. Never invent amounts, dates or eligibility. If you could not confirm something, say so.

Answer in Italian, in plain text without Markdown, in at most 130 words. Name each benefit by its title, say what the person gets and how to claim it. When the person says which force or specialty they serve in, leave out benefits whose corps list does not cover them. Decline questions that are not about benefits for military personnel.`;

const BUDGET = { search: 4, read: 4 } as const;
const MAX_PAGE_CHARACTERS = 10_000;
const text = (value: string) => ({ output: [{ type: "text" as const, text: value }] });

/** One per signed-in user, named by their user ID, so each person keeps their own conversation. */
export class Advisor extends PiObject implements AdvisorRpc {
  #spent = { search: 0, read: 0 };
  #view: CatalogueView | undefined;

  constructor(ctx: DurableObjectState, env: AgentEnv) {
    super(ctx, env);
    this.open(() => ({ name: "advisor", preamble: PREAMBLE, tools: this.#tools() }));
  }

  #spend(kind: keyof typeof BUDGET): boolean {
    this.#spent[kind] += 1;
    return this.#spent[kind] <= BUDGET[kind];
  }

  #tools() {
    const key = this.env.CONTEXT_DEV_API_KEY;
    return [
      defineTool({
        name: "list_benefits",
        description: "Return every benefit in the catalogue with its full details.",
        parameters: obj({}),
        replay: "safe",
        execute: async () => text(JSON.stringify(await this.backend.listBenefits())),
      }),
      defineTool({
        name: "show_in_catalogue",
        description:
          "Show the person exactly the catalogue benefits your answer names, on their screen. Pass the id of each one, as returned by list_benefits.",
        parameters: obj({ benefitIds: arr(str(), { minItems: 1 }) }),
        replay: "safe",
        execute: async (args) => {
          this.#view = args;
          return text("The catalogue on screen now shows those benefits.");
        },
      }),
      defineTool({
        name: "web_search",
        description: "Search the Italian web. Use it only when the catalogue does not answer the question.",
        parameters: obj({ query: str({ minLength: 1, maxLength: 300 }) }),
        replay: "safe",
        execute: async (args) =>
          this.#spend("search")
            ? text(JSON.stringify(await search(key, args.query)))
            : text("No searches left for this question. Answer with what you have."),
      }),
      defineTool({
        name: "read_page",
        description: "Read a web page or PDF as Markdown.",
        parameters: obj({ url: str({ description: "Absolute https URL" }) }),
        replay: "safe",
        execute: async (args) => {
          if (!this.#spend("read")) return text("No page reads left for this question. Answer with what you have.");
          const page = await readPage(key, args.url);
          return text(`# ${page.title}\n\n${page.markdown.slice(0, MAX_PAGE_CHARACTERS)}`);
        },
      }),
    ];
  }

  async ask(question: string): Promise<AdvisorReply> {
    this.#spent = { search: 0, read: 0 };
    this.#view = undefined;
    await this.arm({ ...this.harness.wake(), active: true });
    const root = await this.harness.root(BACKGROUND_CONTEXT, {
      agent: { model: MODEL, thinkingLevel: "medium", maxTurns: 12 },
    });
    const submission = await root.submit({ type: "input", content: question }, BACKGROUND_CONTEXT);
    const settled = await submission.wait(BACKGROUND_CONTEXT);
    if (settled.status !== "done" || settled.type !== "input") throw new Error("The question was not answered");
    const entry = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), BACKGROUND_CONTEXT);
    const message = entry?.model?.[0];
    const answer =
      message?.role === "assistant"
        ? message.content
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("")
            .trim()
        : "";
    if (answer === "") throw new Error("The answer was empty");
    return { answer, ...(this.#view === undefined ? {} : { view: this.#view }) };
  }
}
