import { UserButton, useClerk } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import * as React from "react";
import { BenefitCard } from "../components/benefit-card.tsx";
import { BenefitDialog } from "../components/benefit-dialog.tsx";
import { Chat } from "../components/chat.tsx";
import { FilterSelect, type Option } from "../components/filter-select.tsx";
import { type Benefit, CATEGORIES, CORPS, type Corps, appliesTo } from "../domain.ts";
import { getDashboard, setBookmark } from "../functions.ts";
import { CATEGORY_LABELS, CORPS_LABELS, formatDateTime } from "../labels.ts";

export const Route = createFileRoute("/")({
  // `b` is the benefit a shared link points at.
  validateSearch: (search: Record<string, unknown>): { b?: string } =>
    typeof search.b === "string" ? { b: search.b } : {},
  loader: () => getDashboard(),
  component: Catalogue,
});

const ALL = "tutti";
const CORPS_KEY = "benefit-radar:reparto";

const SORTS = [
  { value: "recenti", label: "Più recenti" },
  { value: "regione", label: "Per regione" },
  { value: "nome", label: "Per nome" },
  { value: "ente", label: "Per ente" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const CORPS_OPTIONS: Option[] = [
  { value: ALL, label: "Ogni reparto" },
  ...CORPS.filter((id) => id !== "tutti").map((id) => ({ value: id, label: CORPS_LABELS[id] })),
];

const byText = (pick: (benefit: Benefit) => string) => (a: Benefit, b: Benefit) =>
  pick(a).localeCompare(pick(b), "it");
// "Nazionale" applies everywhere, so it leads when sorting by region.
const regionRank = (benefit: Benefit) => (benefit.region.toLowerCase() === "nazionale" ? "" : benefit.region);

const COMPARE: Record<Sort, (a: Benefit, b: Benefit) => number> = {
  recenti: (a, b) => b.firstSeenAt - a.firstSeenAt,
  regione: (a, b) => byText(regionRank)(a, b) || byText((benefit) => benefit.title)(a, b),
  nome: byText((benefit) => benefit.title),
  ente: byText((benefit) => benefit.provider),
};

function Catalogue() {
  const { benefits, bookmarks, updatedAt, signedIn, admin, questions, remaining } = Route.useLoaderData();
  const clerk = useClerk();
  const signIn = () => clerk.openSignIn();
  const [view, setView] = React.useState("catalogo");
  const [query, setQuery] = React.useState("");
  const [corps, setCorps] = React.useState(ALL);
  const [category, setCategory] = React.useState(ALL);
  const [region, setRegion] = React.useState(ALL);
  const [sort, setSort] = React.useState<Sort>("recenti");
  const [saved, setSaved] = React.useState(() => new Set(bookmarks));
  const shared = Route.useSearch().b;
  const [selected, setSelected] = React.useState<Benefit | null>(
    () => benefits.find((benefit) => benefit.id === shared) ?? null,
  );

  // The reparto is a personal setting, kept on this device so the catalogue opens on it next time.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(CORPS_KEY);
    if (stored !== null && CORPS_OPTIONS.some((option) => option.value === stored)) setCorps(stored);
  }, []);
  const chooseCorps = (value: string) => {
    setCorps(value);
    window.localStorage.setItem(CORPS_KEY, value);
  };

  const filtered = query !== "" || corps !== ALL || category !== ALL || region !== ALL;
  const clearFilters = () => {
    setQuery("");
    chooseCorps(ALL);
    setCategory(ALL);
    setRegion(ALL);
  };

  const save = (benefit: Benefit, next: boolean) => {
    if (!signedIn) return signIn();
    setSaved((current) => {
      const updated = new Set(current);
      if (next) updated.add(benefit.id);
      else updated.delete(benefit.id);
      return updated;
    });
    void setBookmark({ data: { benefitId: benefit.id, saved: next } });
  };

  const categoryOptions: Option[] = [
    { value: ALL, label: "Ogni categoria" },
    ...CATEGORIES.filter((id) => benefits.some((benefit) => benefit.category === id)).map((id) => ({
      value: id,
      label: CATEGORY_LABELS[id],
    })),
  ];
  const regionOptions: Option[] = [
    { value: ALL, label: "Ogni regione" },
    ...[...new Set(benefits.map((benefit) => benefit.region))]
      .sort((a, b) => a.localeCompare(b, "it"))
      .map((name) => ({ value: name, label: name })),
  ];

  const needle = query.trim().toLowerCase();
  const visible = benefits
    .filter(
      (benefit) =>
        (view === "catalogo" || saved.has(benefit.id)) &&
        (corps === ALL || appliesTo(benefit.corps, corps as Corps)) &&
        (category === ALL || benefit.category === category) &&
        (region === ALL || benefit.region === region) &&
        (needle === "" ||
          `${benefit.title} ${benefit.provider} ${benefit.summary} ${benefit.region}`.toLowerCase().includes(needle)),
    )
    .sort(COMPARE[sort]);

  // Sorting by region also groups by it, so each region reads as its own list.
  const groups: { name: string | null; items: Benefit[] }[] =
    sort === "regione"
      ? [...new Set(visible.map((benefit) => benefit.region))].map((name) => ({
          name,
          items: visible.filter((benefit) => benefit.region === name),
        }))
      : [{ name: null, items: visible }];

  const empty =
    view === "salvati" && !signedIn
      ? "Accedi per salvare i benefit e ritrovarli qui."
      : view === "salvati" && saved.size === 0
        ? "Non hai ancora salvato nulla. Tocca il segnalibro su un benefit per ritrovarlo qui."
      : benefits.length === 0
        ? "Il catalogo è ancora vuoto. La prima ricerca settimanale lo riempie."
        : "Nessun benefit corrisponde a questi filtri.";

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-5 px-4 pt-4 pb-24 sm:px-6 sm:pt-5 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Benefit Radar</h1>
        <div className="order-last w-full sm:order-none sm:w-auto">
          <SegmentedControl
            aria-label="Vista"
            value={view}
            onValueChange={(value) => setView(value ?? "catalogo")}
            className="flex w-full sm:inline-flex sm:w-auto"
          >
            <SegmentedControlIndicator />
            <SegmentedControlItem value="catalogo">Catalogo</SegmentedControlItem>
            <SegmentedControlItem value="salvati">Salvati</SegmentedControlItem>
          </SegmentedControl>
        </div>
        <div className="flex items-center gap-4">
          {admin && (
            <Link to="/admin" className="text-sm">
              Admin
            </Link>
          )}
          {signedIn ? <UserButton /> : <Button onClick={signIn}>Accedi</Button>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
        <Input
          type="search"
          aria-label="Cerca nel catalogo"
          placeholder="Cerca per nome, ente o città"
          value={query}
          onValueChange={setQuery}
          className="col-span-2 text-base lg:col-span-1 lg:text-sm"
        />
        <FilterSelect label="Il mio reparto" value={corps} options={CORPS_OPTIONS} onChange={chooseCorps} />
        <FilterSelect label="Categoria" value={category} options={categoryOptions} onChange={setCategory} />
        <FilterSelect label="Regione" value={region} options={regionOptions} onChange={setRegion} />
        <FilterSelect label="Ordina per" value={sort} options={SORTS} onChange={(value) => setSort(value as Sort)} />
        {filtered && (
          <Button onClick={clearFilters} className="col-span-2 h-10 lg:col-span-5 lg:justify-self-start">
            Azzera filtri
          </Button>
        )}
      </div>

      <main className="flex flex-col gap-8">
        {visible.length === 0 ? (
          <div className="flex flex-col items-start gap-4 border border-border p-6 sm:p-8">
            <p className="text-muted-foreground">{empty}</p>
            {view === "salvati" && !signedIn ? (
              <Button data-variant="solid" onClick={signIn}>
                Accedi
              </Button>
            ) : (
              filtered && <Button onClick={clearFilters}>Azzera filtri</Button>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.name ?? "all"} className="flex flex-col gap-3">
              {group.name !== null && <h2 className="text-lg font-bold">{group.name}</h2>}
              <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {group.items.map((benefit) => (
                  <li key={benefit.id}>
                    <BenefitCard benefit={benefit} saved={saved.has(benefit.id)} onOpen={setSelected} onSave={save} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      {updatedAt !== null && (
        <p className="font-mono text-xs text-muted-foreground">Catalogo aggiornato il {formatDateTime(updatedAt)}</p>
      )}

      <BenefitDialog
        benefit={selected}
        saved={selected !== null && saved.has(selected.id)}
        onClose={() => setSelected(null)}
        onSave={save}
      />
      <Chat signedIn={signedIn} onSignIn={signIn} questions={questions} remaining={remaining} />
    </div>
  );
}
