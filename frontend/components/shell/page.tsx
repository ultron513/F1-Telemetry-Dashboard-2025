"use client";

import { ErrorState, Loading } from "@/components/ui/primitives";
import { isTransient } from "@/lib/api/client";
import { SESSION_LABEL } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const { event, session, season } = useSelection();
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <p className="text-[13px] text-ink-3">
          {event ? (
            <>
              {event.name} {season} <span className="text-ink-3/60">/</span> {session ? SESSION_LABEL[session] : ""}
            </>
          ) : (
            " "
          )}
        </p>
        <h1 className="display mt-1 text-[30px] text-ink sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Blocks a page until the session summary is available; shows a clear reason if it can't load. */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { summaryState, key, events } = useSelection();
  if (!key) {
    if (!events.length) return <Loading label="Loading the calendar…" className="min-h-[50vh]" />;
    return <Loading className="min-h-[50vh]" />;
  }
  if (summaryState.error && !summaryState.data) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        <ErrorState error={summaryState.error} className="min-h-[50vh]" onRetry={() => summaryState.refetch()} />
      </div>
    );
  }
  if (!summaryState.data && summaryState.failureCount > 0 && isTransient(summaryState.failureReason)) {
    return (
      <Loading
        label="Waking up the data server — this takes about a minute after it has been idle. Retrying automatically…"
        className="min-h-[50vh] text-center"
      />
    );
  }
  if (!summaryState.data) {
    return (
      <Loading
        label="Loading session timing — the first load of a session can take up to a minute while FastF1 downloads it."
        className="min-h-[50vh] text-center"
      />
    );
  }
  return <>{children}</>;
}
