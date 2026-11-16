import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { ITALY_REGIONS, ITALY_VIEWBOX, type MapRegion } from "./italy-regions.ts";

const EASE = [0.23, 1, 0.32, 1] as const;
const [, , WIDTH, HEIGHT] = ITALY_VIEWBOX.split(" ").map(Number);

/** Region names as people and pages write them: "Friuli Venezia Giulia", "Valle d'Aosta", "Trentino Alto Adige". */
export const regionKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const REGION_BY_KEY = new Map(ITALY_REGIONS.map((region) => [regionKey(region.name), region]));

/** The map's name for a benefit's region, or null when it is not one of the twenty regions. */
export const mapRegionName = (name: string) => REGION_BY_KEY.get(regionKey(name))?.name ?? null;

export const MAP_REGION_NAMES = ITALY_REGIONS.map((region) => region.name);

function fill(region: MapRegion, selected: string | null, hovered: string | null, counts: ReadonlyMap<string, number>) {
  if (region.name === selected) return "var(--ui-primary)";
  const local = counts.get(region.name) ?? 0;
  const base = local > 0 ? "color-mix(in srgb, var(--ui-primary) 45%, var(--ui-muted))" : "var(--ui-muted)";
  return region.name === hovered && local > 0 ? `color-mix(in srgb, ${base}, var(--ui-foreground) 16%)` : base;
}

/**
 * Italy by region. Tapping a tinted region, one with benefits of its own, picks it and tapping it again lets it go. The Regione select is the accessible way to the same filter, so the map stays out of the reading order.
 */
export function ItalyMap({
  selected,
  counts,
  onSelect,
  className,
}: {
  selected: string | null;
  counts: ReadonlyMap<string, number>;
  onSelect: (region: string | null) => void;
  className?: string;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const picked = ITALY_REGIONS.find((region) => region.name === selected) ?? null;
  const label = ITALY_REGIONS.find((region) => region.name === (hovered ?? selected)) ?? null;

  return (
    // An explicit ratio, so containers that size to their content, like the sheet, give the map its full height.
    <div className={`relative shrink-0 ${className ?? ""}`} style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
      <svg
        viewBox={ITALY_VIEWBOX}
        aria-hidden
        className="block size-full touch-manipulation select-none"
        onPointerLeave={() => setHovered(null)}
      >
        {ITALY_REGIONS.map((region) => (
          <motion.path
            key={region.name}
            d={region.d}
            initial={false}
            animate={{ fill: fill(region, selected, hovered, counts) }}
            transition={{ duration: 0.22, ease: EASE }}
            stroke="var(--ui-background)"
            strokeWidth={0.9}
            strokeLinejoin="round"
            className={(counts.get(region.name) ?? 0) > 0 ? "cursor-pointer outline-none" : "outline-none"}
            onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(region.name)}
            onClick={() => {
              // A region with no benefits of its own would only lead to an empty list.
              if ((counts.get(region.name) ?? 0) > 0 || region.name === selected) onSelect(region.name === selected ? null : region.name);
            }}
          />
        ))}
        {/* The picked region lifts off the map and settles back into place. */}
        <AnimatePresence>
          {picked !== null && (
            <motion.path
              key={picked.name}
              d={picked.d}
              fill="var(--ui-primary)"
              stroke="var(--ui-foreground)"
              strokeWidth={1.2}
              strokeLinejoin="round"
              pointerEvents="none"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={{ scale: 1.18, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.7 }}
            />
          )}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {label !== null && (
          <motion.span
            key={label.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: EASE }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] border border-border bg-background px-2 py-1 font-mono text-xs whitespace-nowrap"
            style={{ left: `${(label.x / WIDTH) * 100}%`, top: `${(label.y / HEIGHT) * 100}%` }}
          >
            {label.name}
            {(counts.get(label.name) ?? 0) > 0 && <span className="text-primary"> · {counts.get(label.name)}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
