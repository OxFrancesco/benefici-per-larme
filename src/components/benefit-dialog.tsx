import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import * as React from "react";
import type { Benefit } from "../domain.ts";
import { CATEGORY_LABELS, CORPS_LABELS, formatDate } from "../labels.ts";
import { BookmarkToggle } from "./bookmark-toggle.tsx";
import { CloseIcon } from "./icons.tsx";
import { ShareButton } from "./share-button.tsx";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

export function BenefitDialog({
  benefit,
  saved,
  onClose,
  onSave,
}: {
  benefit: Benefit | null;
  saved: boolean;
  onClose: () => void;
  onSave: (benefit: Benefit, saved: boolean) => void;
}) {
  // Keeps the content on screen while the dialog animates out.
  const [shown, setShown] = React.useState(benefit);
  if (benefit !== null && benefit !== shown) setShown(benefit);

  return (
    <Dialog open={benefit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogBackdrop />
      <DialogContent className="h-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] gap-6 p-5 sm:max-h-[80dvh] sm:w-[min(64rem,80vw)] sm:p-8">
        {shown !== null && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <DialogTitle className="text-2xl leading-tight font-bold text-balance sm:text-3xl">
                  {shown.title}
                </DialogTitle>
                {shown.value !== null && <p className="font-mono text-lg text-primary">{shown.value}</p>}
              </div>
              <div className="-mt-2 -mr-2 flex shrink-0 items-center">
                <ShareButton benefit={shown} />
                <BookmarkToggle title={shown.title} saved={saved} onChange={(next) => onSave(shown, next)} />
                <DialogClose aria-label="Chiudi" className="size-10 border-0">
                  <CloseIcon />
                </DialogClose>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-10">
              <div className="flex flex-col gap-5">
                <DialogDescription className="text-base leading-relaxed">{shown.summary}</DialogDescription>
                <dl>
                  <Detail label="Come ottenerlo">{shown.howToClaim}</Detail>
                </dl>
              </div>
              <dl className="flex flex-col gap-4 border-t border-border pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-10">
                <Detail label="A chi spetta">{shown.audience}</Detail>
                <Detail label="Reparto">{shown.corps.map((id) => CORPS_LABELS[id]).join(", ")}</Detail>
                <Detail label="Offerto da">{shown.provider}</Detail>
                <Detail label="Dove vale">{shown.region}</Detail>
                <Detail label="Categoria">{CATEGORY_LABELS[shown.category]}</Detail>
                {shown.validUntil !== null && <Detail label="Valido fino al">{formatDate(shown.validUntil)}</Detail>}
                <Detail label="Fonte">
                  <a href={shown.sourceUrl} target="_blank" rel="noreferrer" className="break-words">
                    {shown.sourceTitle}
                  </a>
                </Detail>
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
