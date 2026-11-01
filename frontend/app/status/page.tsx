"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Database, Gauge, Layers, Server, Timer } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Button, ErrorState, Loading, Stat } from "@/components/ui/primitives";
import { ApiError, apiPost } from "@/lib/api/client";
import { useJobs, useStatus } from "@/lib/api/queries";
import type { JobInfo } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

const JOB_TONE: Record<string, string> = {
  finished: "text-good",
  failed: "text-bad",
  started: "text-warn",
  queued: "text-ink-3",
};

export default function StatusPage() {
  const status = useStatus();
  const jobs = useJobs();
  const s = status.data;
  const healthy = !!s && !status.error;

  return (
    <>
      <PageHeader
        title="System status"
        description="Live health of the Pit Wall service: request latency by endpoint, what's loaded in memory, the background job queue and the data stores. Refreshes every ten seconds."
      />
      {status.error && !s ? (
        <Panel>
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        </Panel>
      ) : !s ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-5 py-4">
            <span className={cn("size-3 rounded-full", healthy ? "bg-good shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" : "bg-bad")} />
            <span className="text-lg font-semibold text-ink">{healthy ? "All systems operational" : "Degraded"}</span>
            <span className="text-[13px] text-ink-3">
              {s.service} v{s.version} · up {uptime(s.uptime_seconds)}
              {s.offline && " · offline mode"}
              {s.tracing && " · tracing on"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Tile icon={Activity} label="Requests" value={s.requests.total.toLocaleString()} sub={`${s.requests.errors} server errors`} />
            <Tile icon={Timer} label="Median latency" value={medianOfRoutes(s.routes)} sub="Across all endpoints" />
            <Tile icon={Gauge} label="Sessions in memory" value={`${s.sessions.loaded.length} / ${s.sessions.capacity}`} sub="LRU" />
            <Tile icon={Layers} label="Cached views" value={s.payload_cache.entries.toLocaleString()} sub={`${s.payload_cache.caches} caches`} />
            <Tile icon={Database} label="Warehouse" value={s.warehouse.sessions} sub="Sessions in Parquet" />
            <Tile icon={Server} label="Job queue" value={s.queue.backend === "redis" ? "Redis" : "In-process"} sub={`${s.queue.workers} worker${s.queue.workers === 1 ? "" : "s"}`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel title="Endpoints" subtitle="Since the service started. Latency percentiles over the last 2,048 requests per endpoint." flush bodyClassName="pb-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-3 uppercase">
                      <th className="py-2 pl-5 font-medium">Endpoint</th>
                      <th className="py-2 text-right font-medium">Requests</th>
                      <th className="py-2 text-right font-medium">Errors</th>
                      <th className="py-2 text-right font-medium">p50</th>
                      <th className="py-2 text-right font-medium">p95</th>
                      <th className="py-2 pr-5 text-right font-medium">p99</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.routes.map((r) => (
                      <tr key={`${r.method} ${r.route}`} className="border-b border-line/60">
                        <td className="py-1.5 pl-5 font-mono text-[12px] text-ink">
                          <span className="mr-2 text-ink-3">{r.method}</span>
                          {r.route}
                        </td>
                        <td className="tnum py-1.5 text-right text-ink-2">{r.requests}</td>
                        <td className={cn("tnum py-1.5 text-right", r.errors ? "text-bad" : "text-ink-3")}>{r.errors}</td>
                        <td className="tnum py-1.5 text-right text-ink-2">{ms(r.p50_ms)}</td>
                        <td className="tnum py-1.5 text-right text-ink-2">{ms(r.p95_ms)}</td>
                        <td className="tnum py-1.5 pr-5 text-right text-ink-2">{ms(r.p99_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <div className="space-y-4">
              <Panel title="Sessions in memory">
                {s.sessions.loaded.length === 0 ? (
                  <p className="text-[13px] text-ink-3">None loaded yet.</p>
                ) : (
                  <ul className="space-y-1.5 text-[13px]">
                    {s.sessions.loaded.map((l) => (
                      <li key={`${l.season}-${l.round}-${l.session}`} className="flex justify-between">
                        <span className="text-ink">
                          {l.season} · round {l.round} · {l.session}
                        </span>
                        <span className="tnum text-ink-3">loaded in {l.load_seconds}s</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Jobs jobs={jobs.data?.jobs ?? []} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ms(v: number | null) {
  return v == null ? "—" : v < 10 ? `${v.toFixed(1)} ms` : `${Math.round(v)} ms`;
}

function medianOfRoutes(routes: { requests: number; p50_ms: number | null }[]) {
  const weighted = routes.filter((r) => r.p50_ms != null);
  const total = weighted.reduce((a, r) => a + r.requests, 0);
  if (!total) return "—";
  return ms(weighted.reduce((a, r) => a + (r.p50_ms as number) * r.requests, 0) / total);
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <Icon className="mb-2 size-4 text-team" />
      <Stat label={label} value={value} sub={sub} />
    </div>
  );
}

function Jobs({ jobs }: { jobs: JobInfo[] }) {
  const { season, round } = useSelection();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const ingest = useMutation({
    mutationFn: (whole: boolean) =>
      apiPost<{ queued: number }>("/jobs/ingest", { season, round: whole ? null : round }, token ? { "X-Admin-Token": token } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops"] }),
  });
  return (
    <Panel title="Background jobs" subtitle="Download sessions, fill the warehouse and pre-compute views ahead of time.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!season || !round || ingest.isPending} onClick={() => ingest.mutate(false)}>
          Ingest this round
        </Button>
        <Button size="sm" variant="outline" disabled={!season || ingest.isPending} onClick={() => ingest.mutate(true)}>
          Ingest {season} season
        </Button>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token (if set)"
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-[12px] outline-none"
          aria-label="Admin token"
        />
      </div>
      {ingest.error && <p className="mb-2 text-[12.5px] text-bad">{(ingest.error as ApiError).message}</p>}
      {ingest.data && <p className="mb-2 text-[12.5px] text-good">Queued {ingest.data.queued} session{ingest.data.queued === 1 ? "" : "s"}.</p>}
      {jobs.length === 0 ? (
        <p className="text-[13px] text-ink-3">No jobs yet.</p>
      ) : (
        <ul className="max-h-[320px] space-y-1.5 overflow-y-auto text-[13px]">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-ink">{j.description}</span>
              <span className={cn("shrink-0 text-[12px] font-medium", JOB_TONE[j.status] ?? "text-ink-3")} title={j.error ?? undefined}>
                {j.status}
                {j.ended_at && j.started_at ? ` · ${(j.ended_at - j.started_at).toFixed(0)}s` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
