import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.00s";
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(2)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(1)}s`;
}

export function ordinal(n: number): string {
  if (n === 1) return "1º";
  if (n === 2) return "2º";
  if (n === 3) return "3º";
  return `${n}º`;
}

export function medal(place: number | null): string {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return "";
}
