"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "./strings";

// Per-viewer language choice; Indonesian by default. Storage can be unavailable, so every access is guarded.
const KEY = "langkah.locale";
const listeners = new Set<() => void>();

function read(): Locale {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const locale = useSyncExternalStore(subscribe, read, () => "id" as Locale);
  return [locale, (l) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {}
    listeners.forEach((fn) => fn());
  }];
}
