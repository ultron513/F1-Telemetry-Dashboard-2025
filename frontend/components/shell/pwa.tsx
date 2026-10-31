"use client";

import { Download } from "lucide-react";
import { useEffect } from "react";

import { initInstallListeners, promptInstall, useInstall } from "@/state/install";

/** Registers the service worker (production only) and listens for install prompts. */
export function PwaRuntime() {
  useEffect(() => {
    const cleanup = initInstallListeners();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
    return cleanup;
  }, []);
  return null;
}

/** "Install app" button, shown only when the browser offers installation. */
export function InstallButton({ className }: { className?: string }) {
  const { prompt, installed } = useInstall();
  if (!prompt || installed) return null;
  return (
    <button
      type="button"
      onClick={() => promptInstall()}
      className={
        className ??
        "hidden h-8 items-center gap-1.5 rounded-md bg-team px-3 text-[13px] font-semibold text-on-team hover:brightness-110 sm:inline-flex"
      }
    >
      <Download className="size-4" aria-hidden />
      Install app
    </button>
  );
}
