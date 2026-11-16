import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { Button } from "@ui-sdk/react/button";
import {
  Timeline,
  TimelineConnector,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@ui-sdk/react/timeline";
import * as React from "react";
import { FilterSelect } from "../components/filter-select.tsx";
import type { Run } from "../domain.ts";
import { getAdmin, startRun } from "../functions.ts";
import { CATEGORY_LABELS, CORPS_LABELS, EVENT_LABELS, formatDateTime, formatTime } from "../labels.ts";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { run?: string } =>
    typeof search.run === "string" ? { run: search.run } : {},
  loaderDeps: ({ search }) => ({ run: search.run }),
  loader: ({ deps }) => getAdmin({ data: { runId: deps.run } }),
  component: Admin,
});

const STATUS: Record<Run["status"], string> = {
  running: "in corso",
  completed: "conclusa",
  failed: "interrotta",
};
const POLL_MS = 4000;
const HIGHLIGHT = new Set(["saved", "retired"]);

function Admin() {
  const { runs, run, detail } = Route.useLoaderData();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const running = runs[0]?.status === "running";

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void router.invalidate(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  const start = async () => {
    await startRun();
    await navigate({ search: {} });
    await router.invalidate();
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ricerche settimanali</h1>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm">
            Catalogo
          </Link>
          <Button data-variant="solid" disabled={running} focusableWhenDisabled onClick={start}>
            {running ? "Ricerca in corso" : "Avvia ricerca ora"}
          </Button>
        </div>
      </header>

      {run === null || detail === null ? (
        <p className="border border-border p-6 text-muted-foreground">
          Nessuna ricerca ancora. La prima parte lunedì alle 06:00, oppure avviala ora.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="sm:max-w-sm">
              <FilterSelect
                label="Ricerca"
                value={run.id}
                options={runs.map((item) => ({
                  value: item.id,
                  label: `${formatDateTime(item.startedAt)}, ${STATUS[item.status]}`,
                }))}
                onChange={(id) => void navigate({ search: { run: id } })}
              />
            </div>
            {run.summary !== null && <p className="max-w-3xl leading-relaxed">{run.summary}</p>}
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
            <div className="flex min-w-0 flex-col gap-8">
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">Aggiunti</h2>
                {detail.added.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun benefit nuovo in questa ricerca.</p>
                ) : (
                  <ul className="flex flex-col">
                    {detail.added.map((benefit) => (
                      <li key={benefit.id} className="flex flex-col gap-1 border-b border-border py-3 first:border-t">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                          <span className="font-bold">{benefit.title}</span>
                          {benefit.value !== null && <span className="font-mono text-sm text-primary">{benefit.value}</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{benefit.summary}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                          <span className="text-foreground">{benefit.provider}</span>
                          <span>{CATEGORY_LABELS[benefit.category]}</span>
                          <span>{benefit.region}</span>
                          <span>{benefit.corps.map((id) => CORPS_LABELS[id]).join(", ")}</span>
                          <a href={benefit.sourceUrl} target="_blank" rel="noreferrer">
                            Fonte
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">Rimossi</h2>
                {detail.ended.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun benefit rimosso in questa ricerca.</p>
                ) : (
                  <ul className="flex flex-col">
                    {detail.ended.map((benefit) => (
                      <li key={benefit.id} className="flex flex-col gap-1 border-b border-border py-3 first:border-t">
                        <span className="font-bold">{benefit.title}</span>
                        <p className="text-sm text-muted-foreground">{benefit.reason}</p>
                        <span className="font-mono text-xs text-muted-foreground">{benefit.provider}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Attività</h2>
              {detail.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">L'agente non ha ancora fatto nulla.</p>
              ) : (
                <Timeline aria-label="Attività della ricerca" className="flex flex-col lg:max-h-[70dvh] lg:overflow-y-auto">
                  {[...detail.events].reverse().map((event) => (
                    <TimelineItem
                      key={event.id}
                      className="relative grid grid-cols-[0.75rem_1fr] gap-x-3 pb-4 last:pb-0 focus-visible:outline-1 focus-visible:outline-primary"
                    >
                      <TimelineMarker
                        className={`mt-1.5 size-2 justify-self-center ${HIGHLIGHT.has(event.kind) ? "bg-primary" : "bg-muted-foreground"}`}
                      />
                      <TimelineConnector className="absolute top-4 bottom-0 left-[0.3125rem] w-px bg-border" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <TimelineTitle
                          className={`text-sm leading-snug break-words ${HIGHLIGHT.has(event.kind) ? "font-bold text-primary" : ""}`}
                        >
                          <span className="text-muted-foreground">{EVENT_LABELS[event.kind]}</span> {event.detail}
                        </TimelineTitle>
                        <TimelineTime
                          dateTime={new Date(event.at).toISOString()}
                          className="font-mono text-xs text-muted-foreground"
                        >
                          {formatTime(event.at)}
                        </TimelineTime>
                      </div>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
