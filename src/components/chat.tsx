import { createAgent } from "@ui-sdk/react/agent";
import { Button } from "@ui-sdk/react/button";
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import { Textarea } from "@ui-sdk/react/textarea";
import * as React from "react";
import type { CatalogueView } from "../agent/rpc.ts";
import type { Question } from "../domain.ts";
import { askAgent } from "../functions.ts";
import { ChatIcon, CloseIcon, SendIcon } from "./icons.tsx";

const SUGGESTIONS = [
  "Ho sconti sui treni?",
  "Cosa c'è per chi compra casa?",
  "Sono negli Alpini, cosa mi spetta?",
];

const FAILURES = {
  quota: "Hai usato le 30 domande di questo mese. Tornano il primo del mese prossimo.",
  failed: "Non sono riuscito a rispondere. Riprova tra poco, la domanda non è stata contata.",
} as const;

let bridge: ReturnType<typeof createAgent> | undefined;

/**
 * Moves the catalogue to what the answer talks about, through ui-sdk's agent bridge, which finds each control by
 * its name. Filters the answer does not mention go back to "all", so an older filter cannot hide the results.
 * The reparto stays: it says who the person is, not what they searched for.
 */
async function showInCatalogue(view: CatalogueView) {
  bridge ??= createAgent();
  const steps = [
    { ref: "Vista", action: "setValue", args: ["catalogo"] },
    { ref: "Cerca nel catalogo", action: "setValue", args: [view.search ?? ""] },
    { ref: "Categoria", action: "setValue", args: [view.category ?? "tutti"] },
    { ref: "Regione", action: "setValue", args: ["tutti"] },
    ...(view.region === undefined ? [] : [{ ref: "Regione", action: "setValue", args: [view.region] }]),
    ...(view.sort === undefined ? [] : [{ ref: "Ordina per", action: "setValue", args: [view.sort] }]),
  ];
  // One step per call: a region the catalogue does not list must not stop the other filters.
  for (const step of steps) await bridge.act({ steps: [step] });
}

interface Message {
  readonly id: string;
  readonly from: "user" | "agent";
  readonly text: string;
}

const toMessages = (questions: readonly Question[]): Message[] =>
  questions.flatMap((item) => [
    { id: `q${item.id}`, from: "user" as const, text: item.question },
    { id: `a${item.id}`, from: "agent" as const, text: item.answer ?? "" },
  ]);

export function Chat({
  signedIn,
  onSignIn,
  questions,
  remaining,
}: {
  signedIn: boolean;
  onSignIn: () => void;
  questions: readonly Question[];
  remaining: number;
}) {
  const [messages, setMessages] = React.useState(() => toMessages(questions));
  const [left, setLeft] = React.useState(remaining);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (question === "" || pending) return;
    const stamp = Date.now();
    setDraft("");
    setPending(true);
    setMessages((current) => [...current, { id: `u${stamp}`, from: "user", text: question }]);
    const result = await askAgent({ data: { question } }).catch(() => ({ ok: false, reason: "failed" }) as const);
    setPending(false);
    setMessages((current) => [
      ...current,
      { id: `r${stamp}`, from: "agent", text: result.ok ? (result.answer ?? "") : FAILURES[result.reason] },
    ]);
    if (result.ok) {
      setLeft(result.remaining);
      if (result.view !== undefined) void showInCatalogue(result.view);
    } else if (result.reason === "quota") {
      setLeft(0);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        data-variant="solid"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 h-12 gap-2 px-4 text-base font-bold sm:right-6 sm:bottom-6"
      >
        <ChatIcon />
        Chiedi
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        className="flex h-[min(36rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-1.5rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border py-2 pr-2 pl-4">
          <PopoverTitle className="text-base font-bold">Chiedi all'agente</PopoverTitle>
          <PopoverClose aria-label="Chiudi" className="size-10 border-0">
            <CloseIcon />
          </PopoverClose>
        </div>

        {signedIn ? (
          <>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-start gap-2">
              <p className="pb-1 text-sm text-muted-foreground">
                Risponde dal catalogo e, se serve, cerca sul web.
              </p>
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion} onClick={() => ask(suggestion)} className="h-auto py-2 text-left whitespace-normal">
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
          {messages.map((message) => (
            <p
              key={message.id}
              className={
                message.from === "user"
                  ? "max-w-[85%] self-end border border-primary px-3 py-2 text-sm whitespace-pre-wrap"
                  : "max-w-[92%] self-start text-sm leading-relaxed whitespace-pre-wrap"
              }
            >
              {message.text}
            </p>
          ))}
          {pending && <p className="animate-pulse self-start text-sm text-muted-foreground">Sto cercando</p>}
          <div ref={end} />
        </div>

        <form
          className="flex flex-col gap-2 border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="La tua domanda"
              placeholder="Scrivi una domanda"
              autoResize
              rows={1}
              maxLength={500}
              disabled={left === 0}
              value={draft}
              onValueChange={setDraft}
              submitShortcut="enter"
              className="max-h-32 min-h-10 flex-1 text-base"
            />
            <Button
              type="submit"
              data-variant="solid"
              aria-label="Invia"
              disabled={pending || left === 0 || draft.trim() === ""}
              className="size-10"
            >
              <SendIcon />
            </Button>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {left === 1 ? "1 domanda rimasta questo mese" : `${left} domande rimaste questo mese`}
          </p>
        </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-4 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              L'agente risponde dal catalogo e, se serve, cerca sul web. Accedi per avere 30 domande al mese.
            </p>
            <Button data-variant="solid" onClick={onSignIn}>
              Accedi
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
