"use client";

import { Flag, Newspaper, ShieldAlert, Timer, TriangleAlert, Trophy, UserX } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { QueryView } from "@/components/ui/primitives";
import { useReport } from "@/lib/api/queries";
import type { ReportResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

const MOMENT = {
  lead: { icon: Trophy, tone: "text-team" },
  neutral: { icon: TriangleAlert, tone: "text-warn" },
  penalty: { icon: ShieldAlert, tone: "text-bad" },
  fastest: { icon: Timer, tone: "text-purple" },
  retirement: { icon: UserX, tone: "text-ink-3" },
} as const;

export function SessionReport() {
  const { key } = useSelection();
  const q = useReport(key);
  return (
    <Panel
      share="Session report"
      title={
        <span className="inline-flex items-center gap-2">
          <Newspaper className="size-4 text-team" aria-hidden /> Session report
        </span>
      }
      subtitle={
        q.data?.mode === "llm"
          ? `Written by ${q.data.model} from the session's data`
          : "Written automatically from the session's data"
      }
    >
      <QueryView query={q}>{(r) => <ReportBody r={r} />}</QueryView>
    </Panel>
  );
}

function ReportBody({ r }: { r: ReportResponse }) {
  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <h2 className="display text-[24px] leading-tight text-ink sm:text-[28px]">{r.headline}</h2>
        <p className="mt-2 text-[15px] text-ink-2">{r.standfirst}</p>
        <div className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {r.sections.map((s) => (
            <section key={s.title}>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-team">{s.title}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
      <aside className="space-y-4 lg:border-l lg:border-line lg:pl-6">
        {r.stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-3">
            {r.stats.map((s) => (
              <div key={s.label} className="rounded-md bg-surface-2 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wider text-ink-3">{s.label}</dt>
                <dd className="tnum mt-0.5 text-[17px] font-semibold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {r.moments.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-3">
              <Flag className="size-3.5" aria-hidden /> Key moments
            </h3>
            <ol className="space-y-2">
              {r.moments.map((m, i) => {
                const meta = MOMENT[m.kind as keyof typeof MOMENT] ?? MOMENT.retirement;
                const Icon = meta.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5 text-[13px]">
                    <span className="tnum w-9 shrink-0 pt-px text-right text-ink-3">{m.lap != null ? `L${m.lap}` : "—"}</span>
                    <Icon className={cn("mt-0.5 size-3.5 shrink-0", meta.tone)} aria-hidden />
                    <span className="text-ink-2">{m.text}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </aside>
    </article>
  );
}
