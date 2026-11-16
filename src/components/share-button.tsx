import { Button } from "@ui-sdk/react/button";
import * as React from "react";
import type { Benefit } from "../domain.ts";
import { CheckIcon, ShareIcon } from "./icons.tsx";

/** The link that opens the catalogue on this benefit. */
export const benefitUrl = (benefit: Benefit) => `${window.location.origin}/?b=${encodeURIComponent(benefit.id)}`;

const COPIED_MS = 1600;

export function ShareButton({ benefit }: { benefit: Benefit }) {
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    const url = benefitUrl(benefit);
    // Phones get the system share sheet. Desktop browsers without one copy the link.
    if (typeof navigator.share === "function") {
      await navigator.share({ title: benefit.title, text: benefit.summary, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <Button
      aria-label={copied ? `Link copiato: ${benefit.title}` : `Condividi ${benefit.title}`}
      onClick={share}
      className={`size-10 shrink-0 border-0 bg-transparent hover:text-foreground ${copied ? "text-primary" : "text-muted-foreground"}`}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
    </Button>
  );
}
