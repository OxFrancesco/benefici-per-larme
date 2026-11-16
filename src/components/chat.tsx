import { createAgent } from "@ui-sdk/react/agent";
import { Button } from "@ui-sdk/react/button";
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import { Textarea } from "@ui-sdk/react/textarea";
import * as React from "react";
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
 * Clears the catalogue's filters through ui-sdk's agent bridge, which finds each control by its name, so an older
 * filter cannot hide the benefits an answer points at.
 */
async function clearCatalogueFilters() {
  bridge ??= createAgent();
  await bridge.act({
    steps: [
      { ref: "Cerca nel catalogo", action: "setValue", args: [""] },
      { ref: "Categoria", action: "setValue", args: ["tutti"] },
      { ref: "Regione", action: "setValue", args: ["tutti"] },
    ],
  });
}

interface Message {
  readonly id: string;
  readonly from: "user" | "agent";
  readonly text: string;
  /** True when this answer narrowed the catalogue to the benefits it names. */
  readonly shows?: boolean;
}

const toMessages = (questions: readonly Question[]): Message[] =>
  questions.flatMap((item) => [
    { id: `q${item.id}`, from: "user" as const, text: item.question },
    { id: `a${item.id}`, from: "agent" as const, text: item.answer ?? "" },
  ]);

/** The conversation. It lives above the panel, so the phone page and the desktop popover show the same one. */
export function useChat(
  questions: readonly Question[],
  remaining: number,
  onShow: (benefitIds: readonly string[]) => void,
) {
  const [messages, setMessages] = React.useState(() => toMessages(questions));
  const [left, setLeft] = React.useState(remaining);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const ask = async (text: string) => {
    const question = text.trim();
    if (question === "" || pending) return;
    const stamp = Date.now();
    setDraft("");
    setPending(true);
    setMessages((current) => [...current, { id: `u${stamp}`, from: "user", text: question }]);
    const result = await askAgent({ data: { question } }).catch(() => ({ ok: false, reason: "failed" }) as const);
    setPending(false);
    const shows = result.ok && result.view !== undefined;
    setMessages((current) => [
      ...current,
      { id: `r${stamp}`, from: "agent", text: result.ok ? (result.answer ?? "") : FAILURES[result.reason], shows },
    ]);
    if (result.ok) {
      setLeft(result.remaining);
      if (result.view !== undefined) {
        await clearCatalogueFilters();
        onShow(result.view.benefitIds);
      }
    } else if (result.reason === "quota") {
      setLeft(0);
    }
  };

  return { messages, left, draft, setDraft, pending, ask };
}

export function ChatPanel({
  chat,
  signedIn,
  onSignIn,
  onOpenCatalogue,
}: {
  chat: ReturnType<typeof useChat>;
  signedIn: boolean;
  onSignIn: () => void;
  /** On a phone the chat is its own page, so an answer that narrowed the catalogue links to it. */
  onOpenCatalogue?: () => void;
}) {
  const { messages, left, draft, setDraft, pending, ask } = chat;
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  if (!signedIn) {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          L'agente risponde dal catalogo e, se serve, cerca sul web. Accedi per avere 30 domande al mese.
        </p>
        <Button data-variant="solid" onClick={onSignIn}>
          Accedi
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            <p className="pb-1 text-sm text-muted-foreground">Risponde dal catalogo e, se serve, cerca sul web.</p>
            {SUGGESTIONS.map((suggestion) => (
              <Button key={suggestion} onClick={() => ask(suggestion)} className="h-auto py-2 text-left whitespace-normal">
                {suggestion}
              </Button>
            ))}
          </div>
        )}
        {messages.map((message) =>
          message.from === "user" ? (
            <p key={message.id} className="max-w-[85%] self-end border border-primary px-3 py-2 text-sm whitespace-pre-wrap">
              {message.text}
            </p>
          ) : (
            <div key={message.id} className="flex max-w-[92%] flex-col items-start gap-2 self-start">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
              {message.shows && onOpenCatalogue !== undefined && (
                <Button onClick={onOpenCatalogue}>Vedi nel catalogo</Button>
              )}
            </div>
          ),
        )}
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
  );
}

/** The chat on a wide screen: a button bottom right that opens the panel beside the catalogue. */
export function ChatPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        data-variant="solid"
        className="fixed right-6 bottom-6 z-40 hidden h-12 gap-2 px-4 text-base font-bold md:inline-flex"
      >
        <ChatIcon />
        Chiedi
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        className="flex h-[min(36rem,calc(100dvh-7rem))] w-[26rem] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border py-2 pr-2 pl-4">
          <PopoverTitle className="text-base font-bold">Chiedi all'agente</PopoverTitle>
          <PopoverClose aria-label="Chiudi" className="size-10 border-0">
            <CloseIcon />
          </PopoverClose>
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}
