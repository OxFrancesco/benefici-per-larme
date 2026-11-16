import { Toggle } from "@ui-sdk/react/toggle";
import { BookmarkIcon } from "./icons.tsx";

export function BookmarkToggle({
  title,
  saved,
  onChange,
}: {
  title: string;
  saved: boolean;
  onChange: (saved: boolean) => void;
}) {
  return (
    <Toggle
      aria-label={`Salva ${title}`}
      pressed={saved}
      onPressedChange={onChange}
      className="size-10 shrink-0 border-0 bg-transparent text-muted-foreground hover:text-foreground data-[pressed]:bg-transparent data-[pressed]:text-primary"
    >
      <BookmarkIcon filled={saved} />
    </Toggle>
  );
}
