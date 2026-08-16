import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  return `$${v.toFixed(2)}`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] || "").toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || "").toUpperCase() : "");
}

export function timeAgo(ts?: number): string {
  if (!ts) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
