"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { API_BASE_URL } from "@/lib/api/client";
import type { LiveAlert, LiveSnapshot, MessageKind, Severity } from "@/lib/api/types";

export type LiveSource =
  | { mode: "live" }
  | { mode: "archive"; season: number; round: number; session: string; speed: number; start: number };

export type LiveConnection = "idle" | "connecting" | "open" | "ended" | "error";

/** How a backend alert shows up in the notification centre. */
export const ALERT_STYLE: Record<LiveAlert["kind"], { kind: MessageKind; severity: Severity }> = {
  "safety-car": { kind: "sc", severity: "critical" },
  "red-flag": { kind: "red", severity: "critical" },
  vsc: { kind: "vsc", severity: "high" },
  green: { kind: "green", severity: "medium" },
  "lead-change": { kind: "info", severity: "high" },
  "fastest-lap": { kind: "info", severity: "low" },
  pit: { kind: "pit", severity: "low" },
  retirement: { kind: "info", severity: "high" },
  penalty: { kind: "penalty", severity: "high" },
  investigation: { kind: "investigation", severity: "medium" },
  chequered: { kind: "chequered", severity: "high" },
  rain: { kind: "weather", severity: "high" },
};

function socketUrl(source: LiveSource): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  const url = new URL(`${base}/api/v1/live/ws`);
  url.searchParams.set("mode", source.mode);
  if (source.mode === "archive") {
    url.searchParams.set("season", String(source.season));
    url.searchParams.set("round", String(source.round));
    url.searchParams.set("session", source.session);
    url.searchParams.set("speed", String(source.speed));
    url.searchParams.set("start", String(source.start));
  }
  return url.toString();
}

/**
 * One WebSocket per live view. Reconnects with back-off on drops (the real
 * feed can blip), and exposes playback controls for archive replays.
 */
export function useLiveFeed(source: LiveSource | null, onAlerts?: (alerts: LiveAlert[]) => void) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [status, setStatus] = useState<LiveConnection>("idle");
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const alertsRef = useRef(onAlerts);
  useEffect(() => {
    alertsRef.current = onAlerts;
  });
  const key = source ? JSON.stringify(source) : null;

  useEffect(() => {
    if (!key) return;
    const src = JSON.parse(key) as LiveSource;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      setStatus("connecting");
      setError(null);
      const socket = new WebSocket(socketUrl(src));
      ws.current = socket;
      socket.onopen = () => {
        retry = 0;
        setStatus("open");
      };
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "snapshot") {
          setSnapshot(msg as LiveSnapshot);
          if (msg.alerts?.length) alertsRef.current?.(msg.alerts);
        } else if (msg.type === "end") {
          setStatus("ended");
        } else if (msg.type === "error") {
          setError(msg.hint ? `${msg.message} ${msg.hint}` : msg.message);
          setStatus("error");
          closed = true;
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setStatus((s) => (s === "ended" ? s : "connecting"));
        retry += 1;
        timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry));
      };
      socket.onerror = () => {
        setError("Can't reach the live service.");
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws.current?.close();
      ws.current = null;
      setSnapshot(null);
      setStatus("idle");
    };
  }, [key]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
  }, []);

  return {
    snapshot,
    status,
    error,
    setSpeed: (speed: number) => send({ speed }),
    setPaused: (paused: boolean) => send({ paused }),
    seek: (seconds: number) => send({ seek: seconds }),
  };
}

/** Desktop notifications for alerts while the tab is in the background. */
const permissionListeners = new Set<() => void>();
function subscribePermission(cb: () => void) {
  permissionListeners.add(cb);
  return () => permissionListeners.delete(cb);
}
function readPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

export function useDesktopNotifications() {
  // Read on the client only, so server and client render the same markup.
  const permission = useSyncExternalStore(subscribePermission, readPermission, () => "unsupported" as const);
  const request = useCallback(async () => {
    if (readPermission() === "unsupported") return;
    await Notification.requestPermission();
    permissionListeners.forEach((cb) => cb());
  }, []);
  const notify = useCallback(
    (title: string, body: string) => {
      if (permission !== "granted" || typeof document === "undefined" || !document.hidden) return;
      try {
        new Notification(title, { body, icon: "/icon.svg", tag: `${title}-${body}`.slice(0, 64) });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    },
    [permission],
  );
  return { permission, request, notify };
}
