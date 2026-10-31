"use client";

import type { MessageKind, Severity } from "@/lib/api/types";

import { createStore, useStore } from "./store";

export interface Notice {
  id: string;
  kind: MessageKind;
  severity: Severity;
  title: string;
  message: string;
  lap: number | null;
  /** Wall-clock time the notice was raised. */
  at: number;
  source: "replay" | "feed" | "system";
  read: boolean;
}

interface State {
  log: Notice[];
  toasts: Notice[];
}

const store = createStore<State>({ log: [], toasts: [] });
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_LOG = 80;
const MAX_TOASTS = 3;

export function pushNotice(n: Omit<Notice, "id" | "at" | "read">, opts: { toast?: boolean; ttl?: number } = {}) {
  const notice: Notice = { ...n, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), read: false };
  store.set((s) => ({
    log: [notice, ...s.log].slice(0, MAX_LOG),
    toasts: opts.toast === false ? s.toasts : [notice, ...s.toasts].slice(0, MAX_TOASTS),
  }));
  if (opts.toast !== false) {
    const ttl = opts.ttl ?? (n.severity === "critical" ? 9000 : 6000);
    timers.set(notice.id, setTimeout(() => dismissToast(notice.id), ttl));
  }
  return notice.id;
}

export function dismissToast(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  store.set((s) => ({ ...s, toasts: s.toasts.filter((n) => n.id !== id) }));
}

export function markAllRead() {
  store.set((s) => ({ ...s, log: s.log.map((n) => ({ ...n, read: true })) }));
}

export function clearNotices() {
  timers.forEach(clearTimeout);
  timers.clear();
  store.set({ log: [], toasts: [] });
}

export function useNotifications() {
  return useStore(store);
}
