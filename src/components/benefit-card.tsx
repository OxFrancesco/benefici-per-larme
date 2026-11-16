import type { Benefit } from "../domain.ts";
import { CATEGORY_LABELS, CORPS_LABELS } from "../labels.ts";
import { BookmarkToggle } from "./bookmark-toggle.tsx";
import { ShareButton } from "./share-button.tsx";

export function BenefitCard({
  benefit,
  saved,
  onOpen,
  onSave,
}: {
  benefit: Benefit;
  saved: boolean;
  onOpen: (benefit: Benefit) => void;
  onSave: (benefit: Benefit, saved: boolean) => void;
}) {
  return (
    <article className="group relative flex h-full flex-col gap-3 border border-border p-5 transition-colors duration-150 focus-within:border-primary hover:border-primary">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg leading-snug font-bold text-balance">
          {/* The button stretches over the whole card, so the card is one tap target with one name. */}
          <button
            type="button"
            onClick={() => onOpen(benefit)}
            className="cursor-pointer text-left outline-none after:absolute after:inset-0"
          >
            {benefit.title}
          </button>
        </h3>
        <div className="relative z-10 -mt-2 -mr-2 flex shrink-0">
          <ShareButton benefit={benefit} />
          <BookmarkToggle title={benefit.title} saved={saved} onChange={(next) => onSave(benefit, next)} />
        </div>
      </div>
      {benefit.value !== null && benefit.value.length <= 16 && (
        <p className="font-mono text-lg font-medium text-primary">{benefit.value}</p>
      )}
      <p className="line-clamp-3 text-sm text-muted-foreground">{benefit.summary}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">{benefit.provider}</span>
        <span>{CATEGORY_LABELS[benefit.category]}</span>
        <span>{benefit.region}</span>
        <span>{benefit.corps.map((id) => CORPS_LABELS[id]).join(", ")}</span>
      </div>
    </article>
  );
}
