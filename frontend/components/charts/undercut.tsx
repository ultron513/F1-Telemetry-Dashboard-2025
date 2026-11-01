"use client";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { Stat } from "@/components/ui/primitives";
import type { UndercutResponse } from "@/lib/api/types";
import { compound } from "@/lib/f1";
import { delta } from "@/lib/format";
import { cn } from "@/lib/utils";

export const UNDERCUT_VERDICT = {
  undercut: { label: "Undercut works", tone: "text-good" },
  overcut: { label: "Overcut works", tone: "text-good" },
  stay: { label: "Neither move gets past", tone: "text-warn" },
  safe: { label: "Stays ahead either way", tone: "text-good" },
  cover: { label: "Pit first to stay ahead", tone: "text-warn" },
  "stay-out": { label: "Stay out to stay ahead", tone: "text-warn" },
  lose: { label: "Loses the place either way", tone: "text-bad" },
} as const;

export function UndercutView({ u }: { u: UndercutResponse }) {
  const series: LineSeries[] = [
    { id: "under", label: `${u.attacker} pits first`, color: "var(--team-primary)", points: u.undercut.gaps.map((g) => ({ x: g.lap, y: g.gap })), width: 2 },
    { id: "over", label: `${u.attacker} stays out`, color: "var(--ink-3)", dashed: true, points: u.overcut.gaps.map((g) => ({ x: g.lap, y: g.gap })), width: 2 },
  ];
  const behind = (u.gap ?? 0) > 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className={cn("text-xl font-semibold", UNDERCUT_VERDICT[u.verdict].tone)}>{UNDERCUT_VERDICT[u.verdict].label}</div>
        <p className="text-[13.5px] text-ink-2">
          At the end of lap {u.lap}, {u.attacker} is {Math.abs(u.gap ?? 0).toFixed(1)} s {behind ? "behind" : "ahead of"} {u.defender}. A fresh{" "}
          {compound(u.attacker_tyre.next).label.toLowerCase()} is worth {u.fresh_tyre_gain?.toFixed(2) ?? "—"} s on its first lap against{" "}
          {u.attacker_tyre.age}-lap-old {compound(u.attacker_tyre.compound).label.toLowerCase()}s, against a {u.pit_loss?.toFixed(1)} s pit loss.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Undercut gap" value={delta(u.undercut.final_gap, 2)} sub={u.undercut.attacker_ahead ? `${u.attacker} ahead` : `${u.defender} ahead`} />
          <Stat label="Overcut gap" value={delta(u.overcut.final_gap, 2)} sub={u.overcut.attacker_ahead ? `${u.attacker} ahead` : `${u.defender} ahead`} />
        </div>
      </div>
      <LineChart
        ariaLabel="Projected gap between the two cars under each pit timing"
        series={series}
        height={220}
        yFormat={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}s`}
        tooltipX={(v) => `Lap ${v}`}
        refLines={[{ y: 0, label: "Level" }]}
        invertY
      />
    </div>
  );
}
