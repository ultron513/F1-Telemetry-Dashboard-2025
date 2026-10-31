"use client";

import { Bell, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";

import { FlagChip } from "@/components/f1/bits";
import { Segmented } from "@/components/ui/primitives";
import { useRaceControl } from "@/lib/api/queries";
import { MESSAGE_STYLE, SEVERITY_RANK } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { dismissToast, markAllRead, useNotifications, type Notice } from "@/state/notifications";
import { useSelection } from "@/state/selection";

/** Bell in the session bar: replay alerts + the session's key race-control calls. */
export function NotificationCenter() {
  const { log } = useNotifications();
  const { key } = useSelection();
  const rc = useRaceControl(key);
  const [tab, setTab] = useState<"alerts" | "session">("session");
  const unread = log.filter((n) => !n.read).length;

  const keyMessages = (rc.data?.messages ?? [])
    .filter((m) => SEVERITY_RANK[m.severity] >= SEVERITY_RANK.high)
    .slice(-40)
    .reverse();

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open && unread) setTab("alerts");
        if (!open) markAllRead();
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="tnum absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-team px-1 text-[10px] font-bold text-on-team">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(92vw,400px)] overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)] data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
            <span className="text-sm font-semibold">Race control</span>
            <Segmented
              size="sm"
              label="Notification source"
              value={tab}
              onChange={setTab}
              options={[
                { value: "session", label: "Key calls" },
                { value: "alerts", label: `Alerts${unread ? ` (${unread})` : ""}` },
              ]}
            />
          </div>
          <div className="scroll-thin max-h-[60vh] overflow-y-auto">
            {tab === "alerts" ? (
              log.length ? (
                log.map((n) => <NoticeRow key={n.id} notice={n} />)
              ) : (
                <p className="px-4 py-8 text-center text-sm text-ink-3">
                  Alerts appear here while you play a session replay on the Race control page.
                </p>
              )
            ) : keyMessages.length ? (
              keyMessages.map((m) => (
                <div key={m.id} className="flex gap-3 border-b border-line/60 px-3 py-2.5 last:border-0">
                  <FlagChip kind={m.kind} label={m.title} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-ink">{m.message}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{m.lap ? `Lap ${m.lap}` : "Pre-session"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-ink-3">No flags, safety cars or penalties in this session.</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  return (
    <div className={cn("flex gap-3 border-b border-line/60 px-3 py-2.5 last:border-0", !notice.read && "bg-surface-2")}>
      <FlagChip kind={notice.kind} label={notice.title} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-ink">{notice.message}</p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">{notice.lap ? `Lap ${notice.lap}` : ""}</p>
      </div>
    </div>
  );
}

/** Race-control style toast stack (bottom right). */
export function Toaster() {
  const { toasts } = useNotifications();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => {
        const s = MESSAGE_STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex animate-toast-in overflow-hidden rounded-md border border-line-strong bg-surface shadow-[var(--shadow-pop)]"
          >
            <div className="w-1.5 shrink-0" style={{ background: s.color }} aria-hidden />
            <div className="min-w-0 flex-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-ink-3">Race control</span>
                {t.lap != null && <span className="tnum text-[11px] text-ink-3">Lap {t.lap}</span>}
              </div>
              <p className="mt-0.5 text-[14px] leading-tight font-bold italic" style={{ color: s.color === "#F2F2F2" ? "var(--ink)" : s.color }}>
                {t.title}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ink-2">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="self-start p-2 text-ink-3 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
