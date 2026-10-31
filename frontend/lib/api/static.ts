// Static-data mode: read pre-computed JSON files instead of calling the API.
//
// The exporter (backend/scripts/export_static.py) writes every API response to
// a folder that mirrors the API paths, published to a Hugging Face dataset.
// Set NEXT_PUBLIC_DATA_URL to that folder, e.g.
//   https://huggingface.co/datasets/<user>/pitwall-data/resolve/main/v1
// Two-lap comparisons are computed here in the browser from the two drivers'
// telemetry files, using the same method as the API.

import { ApiError } from "./errors";
import type { Channels, CompareResponse, HealthResponse, MiniSector, TelemetryResponse } from "./types";

export const DATA_URL = (process.env.NEXT_PUBLIC_DATA_URL || "").replace(/\/$/, "");
export const STATIC_MODE = DATA_URL.length > 0;

type Params = Record<string, string | number | boolean | null | undefined>;

const DRIVER_LEAVES = new Set(["laps", "telemetry", "degradation", "recommendation"]);

async function getFile<T>(rel: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${DATA_URL}/${rel}`, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(
      0,
      "network",
      "Can't reach the data store.",
      typeof navigator !== "undefined" && !navigator.onLine
        ? "You're offline. Sessions you've already opened still work."
        : "Check your connection and try again.",
    );
  }
  if (response.status === 404) {
    throw new ApiError(
      404,
      "not_published",
      "This hasn't been published yet.",
      "New sessions are added automatically after each race weekend.",
    );
  }
  if (!response.ok) throw new ApiError(response.status, "http_error", `Data store returned ${response.status}.`);
  return (await response.json()) as T;
}

function requireFastest(lap: unknown) {
  if (lap != null && lap !== "" && String(lap).toLowerCase() !== "fastest") {
    throw new ApiError(
      404,
      "lap_not_published",
      "Only each driver's fastest lap is published in this deployment.",
      "Choose “Fastest lap” in the lap picker.",
    );
  }
}

export async function staticGet<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  if (path === "/health") {
    await getFile("seasons.json", signal);
    const health: HealthResponse = { status: "ok", service: "Pit Wall data store", version: "static", offline: false, loaded_sessions: [] };
    return health as T;
  }
  if (path === "/seasons") return getFile<T>("seasons.json", signal);

  let m = path.match(/^\/seasons\/(\d+)\/events$/);
  if (m) return getFile<T>(`seasons/${m[1]}/events.json`, signal);

  m = path.match(/^\/seasons\/(\d+)\/standings$/);
  if (m) return getFile<T>(`seasons/${m[1]}/standings/${params.round ?? "latest"}.json`, signal);

  m = path.match(/^\/sessions\/(\d+)\/(\d+)\/([A-Za-z0-9]+)\/([a-z-]+)$/);
  if (m) {
    const [, season, round, code, leaf] = m;
    const base = `sessions/${season}/${round}/${code.toUpperCase()}`;
    if (leaf === "compare") {
      requireFastest(params.lap_a);
      requireFastest(params.lap_b);
      const [a, b] = await Promise.all([
        getFile<TelemetryResponse>(`${base}/telemetry/${String(params.driver_a).toUpperCase()}.json`, signal),
        getFile<TelemetryResponse>(`${base}/telemetry/${String(params.driver_b).toUpperCase()}.json`, signal),
      ]);
      return compareLaps(a, b) as T;
    }
    if (DRIVER_LEAVES.has(leaf)) {
      if (leaf === "telemetry") requireFastest(params.lap);
      return getFile<T>(`${base}/${leaf}/${String(params.driver).toUpperCase()}.json`, signal);
    }
    return getFile<T>(`${base}/${leaf}.json`, signal);
  }
  throw new ApiError(404, "not_found", `No static data for ${path}.`);
}

// --- Client-side lap comparison (mirrors backend/app/services/telemetry.compare) ---

function interp(x: number[], xp: number[], fp: number[]): number[] {
  const out = new Array<number>(x.length);
  let j = 0;
  const n = xp.length;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (v <= xp[0]) {
      out[i] = fp[0];
      continue;
    }
    if (v >= xp[n - 1]) {
      out[i] = fp[n - 1];
      continue;
    }
    while (j < n - 2 && xp[j + 1] < v) j++;
    while (j > 0 && xp[j] > v) j--;
    const span = xp[j + 1] - xp[j] || 1;
    out[i] = fp[j] + ((fp[j + 1] - fp[j]) * (v - xp[j])) / span;
  }
  return out;
}

function nearest(x: number[], xp: number[], fp: number[]): number[] {
  const out = new Array<number>(x.length);
  let j = 0;
  for (let i = 0; i < x.length; i++) {
    while (j < xp.length - 1 && xp[j] < x[i]) j++;
    out[i] = fp[j];
  }
  return out;
}

const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export function compareLaps(a: TelemetryResponse, b: TelemetryResponse, minisectors = 25): CompareResponse {
  const ca = a.channels;
  const cb = b.channels;
  const grid = ca.distance;
  const lenA = grid[grid.length - 1] || 1;
  const lenB = cb.distance[cb.distance.length - 1] || 1;
  // Map B onto A's distance axis by relative lap distance.
  const srcB = cb.distance.map((d) => (d * lenA) / lenB);

  const channelsB: Channels = {
    distance: grid,
    time: interp(grid, srcB, cb.time).map((v) => r(v, 3)),
    speed: interp(grid, srcB, cb.speed).map((v) => r(v, 1)),
    throttle: interp(grid, srcB, cb.throttle).map((v) => r(v, 1)),
    rpm: interp(grid, srcB, cb.rpm).map((v) => Math.round(v)),
    x: interp(grid, srcB, cb.x).map((v) => r(v, 1)),
    y: interp(grid, srcB, cb.y).map((v) => r(v, 1)),
    brake: nearest(grid, srcB, cb.brake),
    gear: nearest(grid, srcB, cb.gear),
    drs: nearest(grid, srcB, cb.drs),
  };

  const delta = grid.map((_, i) => r(channelsB.time[i] - ca.time[i], 3));

  const edges = Array.from({ length: minisectors + 1 }, (_, i) => (lenA * i) / minisectors);
  const tA = interp(edges, grid, ca.time);
  const tB = interp(edges, grid, channelsB.time);
  const minis: MiniSector[] = [];
  for (let i = 0; i < minisectors; i++) {
    const sa = tA[i + 1] - tA[i];
    const sb = tB[i + 1] - tB[i];
    const diff = sb - sa;
    minis.push({
      index: i,
      start: r(edges[i], 1),
      end: r(edges[i + 1], 1),
      time_a: r(sa, 3),
      time_b: r(sb, 3),
      winner: diff > 0.0005 ? "a" : diff < -0.0005 ? "b" : "even",
      gain: r(Math.abs(diff), 3),
    });
  }

  const sectors = (["s1", "s2", "s3"] as const).map((k) => {
    const av = a.lap[k];
    const bv = b.lap[k];
    return { sector: k.toUpperCase(), a: av, b: bv, delta: av != null && bv != null ? r(bv - av, 3) : null };
  });

  return {
    season: a.season,
    round: a.round,
    session: a.session,
    a: { driver: a.driver, lap: a.lap, stats: a.stats },
    b: { driver: b.driver, lap: b.lap, stats: b.stats },
    distance: grid,
    channels_a: ca,
    channels_b: channelsB,
    delta,
    final_delta: delta.length ? delta[delta.length - 1] : null,
    sector_marks: a.sector_marks,
    sectors,
    minisectors: minis,
    dominance: {
      a: minis.filter((m) => m.winner === "a").length,
      b: minis.filter((m) => m.winner === "b").length,
    },
  };
}
