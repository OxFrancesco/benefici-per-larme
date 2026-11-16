import { Select, SelectContent, SelectItem, SelectItemIndicator, SelectTrigger, SelectValue } from "@ui-sdk/react/select";

export interface Option {
  readonly value: string;
  readonly label: string;
}

/** One catalogue filter. `label` names it for screen readers and for the chat agent, which sets filters by name. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <Select items={[...options]} value={value} onValueChange={(next) => next !== null && onChange(next)}>
      <SelectTrigger aria-label={label} className="w-full min-w-0 justify-between">
        <span className="truncate">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
            <SelectItemIndicator />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
