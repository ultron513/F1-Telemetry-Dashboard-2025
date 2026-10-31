"use client";

import { AlertTriangle, CloudOff, Loader2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  unit,
  sub,
  className,
  emphasis,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={cn("tnum truncate text-ink", emphasis ? "text-2xl font-semibold" : "text-lg font-medium")}>
          {value}
        </span>
        {unit && <span className="text-xs text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-md border border-line bg-surface-2 p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[4px] font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-[13px]",
              active ? "bg-team text-on-team shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({
  className,
  variant = "ghost",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "solid" | "outline";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "icon" && "h-8 w-8",
        variant === "ghost" && "text-ink-2 hover:bg-surface-3 hover:text-ink",
        variant === "outline" && "border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
        variant === "solid" && "bg-team text-on-team hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-3", className)} />;
}

export function Loading({ label = "Loading timing data…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-40 items-center justify-center gap-2 text-sm text-ink-3", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, className, onRetry }: { error: unknown; className?: string; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null;
  const Icon = api?.status === 0 || api?.status === 503 ? CloudOff : AlertTriangle;
  return (
    <div className={cn("flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-8 text-center", className)}>
      <Icon className="size-6 text-ink-3" aria-hidden />
      <p className="max-w-md text-sm font-medium text-ink">{api?.message ?? "This panel couldn't load."}</p>
      {api?.hint && <p className="max-w-md text-[13px] text-ink-3">{api.hint}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-32 items-center justify-center px-6 text-center text-sm text-ink-3", className)}>
      {children}
    </div>
  );
}

/** Render children for a react-query result with consistent loading / error UI. */
export function QueryView<T>({
  query,
  children,
  loading,
  className,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch?: () => unknown; isFetching?: boolean };
  children: (data: T) => React.ReactNode;
  loading?: React.ReactNode;
  className?: string;
}) {
  if (query.error && !query.data)
    return <ErrorState error={query.error} className={className} onRetry={query.refetch ? () => query.refetch?.() : undefined} />;
  if (!query.data) return <>{loading ?? <Loading className={className} />}</>;
  return <>{children(query.data)}</>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-px font-mono text-[11px] text-ink-3">{children}</kbd>
  );
}
