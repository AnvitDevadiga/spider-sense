export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { useEffect, useState } from "react";

/** Returns `value` after it has stayed unchanged for `delay` ms. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(2)}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface StoreMeta {
  label: string;
  badge: string;
}

export const STORE_META: Record<string, StoreMeta> = {
  amazon: { label: "Amazon", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  walmart: { label: "Walmart", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  bestbuy: { label: "Best Buy", badge: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30" },
};

export function storeMeta(source?: string | null): StoreMeta {
  const key = source?.toLowerCase() ?? "";
  return (
    STORE_META[key] ?? {
      label: source || "Retailer",
      badge: "bg-gray-800 text-gray-300 border-gray-700",
    }
  );
}

export function availabilityTone(availability?: string | null): string {
  const s = (availability || "").toLowerCase();
  if (s.includes("out of stock") || s.includes("unavailable")) {
    return "bg-red-950/40 text-red-400 border-red-800/60";
  }
  if (s.includes("low")) {
    return "bg-amber-950/40 text-amber-400 border-amber-800/60";
  }
  return "bg-emerald-950/40 text-emerald-400 border-emerald-800/60";
}
