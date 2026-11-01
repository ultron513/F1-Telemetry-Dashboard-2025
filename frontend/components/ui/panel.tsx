"use client";

import { useRef } from "react";

import { ShareButton } from "@/components/ui/share-button";
import { cn } from "@/lib/utils";

interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Thin team-coloured rule on top: reserve for the panel that matters most on a page. */
  accent?: boolean;
  bodyClassName?: string;
  flush?: boolean;
  /** Adds a "save as image" button; a string overrides the card title. */
  share?: boolean | string;
}

export function Panel({
  title,
  subtitle,
  actions,
  accent,
  className,
  bodyClassName,
  flush,
  share,
  children,
  ...rest
}: PanelProps) {
  const body = useRef<HTMLDivElement>(null);
  const shareTitle = typeof share === "string" ? share : typeof title === "string" ? title : "Pit Wall";
  return (
    <section
      className={cn(
        "relative min-w-0 rounded-lg border border-line bg-surface",
        accent && "border-t-0 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-lg before:bg-team",
        className,
      )}
      {...rest}
    >
      {(title || actions || share) && (
        <header className={cn("flex items-start justify-between gap-x-4 gap-y-2 px-4 pt-3.5 pb-2.5 sm:px-5", share && !actions ? "flex-nowrap" : "flex-wrap")}>
          <div className={cn("min-w-0", share && !actions && "flex-1")}>
            {title && <h2 className="text-[15px] leading-tight font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          {(actions || share) && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {actions}
              {share && <ShareButton target={body} title={shareTitle} />}
            </div>
          )}
        </header>
      )}
      <div ref={body} className={cn(flush ? "" : "px-4 pb-4 sm:px-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
