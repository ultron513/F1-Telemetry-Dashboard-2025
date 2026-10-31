"use client";

import { createStore, useStore } from "./store";

/** The deferred `beforeinstallprompt` event (Chromium browsers only). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  prompt: InstallPromptEvent | null;
  installed: boolean;
}

const store = createStore<InstallState>({ prompt: null, installed: false });

export function initInstallListeners() {
  if (typeof window === "undefined") return () => undefined;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) store.set({ prompt: null, installed: true });
  const onPrompt = (e: Event) => {
    e.preventDefault();
    store.set((s) => ({ ...s, prompt: e as InstallPromptEvent }));
  };
  const onInstalled = () => store.set({ prompt: null, installed: true });
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export async function promptInstall() {
  const { prompt } = store.get();
  if (!prompt) return false;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  store.set((s) => ({ ...s, prompt: null, installed: choice.outcome === "accepted" || s.installed }));
  return choice.outcome === "accepted";
}

export function useInstall() {
  return useStore(store);
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
