"use client";

import { Check, ImageDown, Loader2 } from "lucide-react";
import { useState } from "react";

import { SESSION_LABEL } from "@/lib/f1";
import { shareCard } from "@/lib/share";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

/** Exports the chart in ``target`` as a branded PNG card (share sheet on phones). */
export function ShareButton({ target, title, className }: { target: React.RefObject<HTMLElement | null>; title: string; className?: string }) {
  const { event, season, session } = useSelection();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const subtitle = event ? `${event.name} ${season} · ${session ? SESSION_LABEL[session] : ""}` : undefined;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!target.current) return;
        setState("busy");
        try {
          await shareCard(target.current, { title, subtitle, filename: `pitwall-${title}-${season ?? ""}-${event?.round ?? ""}` });
          setState("done");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 1800);
      }}
      className={cn("inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink", className)}
      aria-label={`Save “${title}” as an image`}
      title={state === "error" ? "Couldn't export this chart" : "Save as image"}
    >
      {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : state === "done" ? <Check className="size-4 text-good" /> : <ImageDown className="size-4" />}
    </button>
  );
}
