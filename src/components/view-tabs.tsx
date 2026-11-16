import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import * as React from "react";
import { BookmarkIcon, ChatIcon, GridIcon } from "./icons.tsx";

export type View = "catalogo" | "salvati" | "chiedi";

const ITEM = "h-14 flex-col gap-0.5 text-xs md:h-9 md:flex-row md:gap-2 md:text-sm";

/**
 * The view switcher: a bar along the bottom on a phone, inline after the logo on a wide screen.
 *
 * The tapped tab lights up in its own render, before the page swaps views. The swap runs as a transition, so a phone
 * that is still rendering the last view never holds the bar back, and a quick second tap replaces the first.
 */
export function ViewTabs({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const [shown, setShown] = React.useState(view);
  // Follows a switch made elsewhere, like the chat sending the person back to the catalogue.
  const [followed, setFollowed] = React.useState(view);
  if (view !== followed) {
    setFollowed(view);
    setShown(view);
  }
  const [, startTransition] = React.useTransition();

  return (
    <SegmentedControl
      aria-label="Vista"
      value={shown}
      onValueChange={(value) => {
        const next = (value ?? "catalogo") as View;
        setShown(next);
        startTransition(() => onChange(next));
      }}
      className="fixed inset-x-0 bottom-0 z-30 flex gap-0 border-x-0 border-b-0 bg-background p-0 pb-[env(safe-area-inset-bottom)] md:relative md:inset-auto md:z-auto md:inline-flex md:gap-0.5 md:border md:bg-transparent md:p-0.5"
    >
      <SegmentedControlItem value="catalogo" className={ITEM}>
        <GridIcon />
        Catalogo
      </SegmentedControlItem>
      <SegmentedControlItem value="salvati" className={ITEM}>
        <BookmarkIcon filled={shown === "salvati"} />
        Salvati
      </SegmentedControlItem>
      {/* On a phone the chat is a page of its own. On a wide screen it is the button bottom right. */}
      <SegmentedControlItem value="chiedi" className={`${ITEM} md:hidden`}>
        <ChatIcon />
        Chiedi
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
