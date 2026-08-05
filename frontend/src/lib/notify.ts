"use client";

import {
  isAbortError,
  isExpectedError,
} from "@/src/lib/apiError";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
}

export type ToastInput = {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
};

type ToastListener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 5000,
};

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function notifyListeners() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

function nextId() {
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  notifyListeners();
}

export function pushToast(input: ToastInput): string {
  const message = (input.message || "").trim() || "An unexpected error occurred.";
  const type = input.type;
  const id = nextId();
  const duration = input.duration ?? DEFAULT_DURATION[type];

  const item: ToastItem = {
    id,
    type,
    message,
    title: input.title?.trim() || undefined,
    duration,
  };

  toasts = [...toasts, item].slice(-5);
  notifyListeners();

  if (duration > 0) {
    const timer = setTimeout(() => dismissToast(id), duration);
    timers.set(id, timer);
  }

  return id;
}

/** Prefer Error.message (already includes backend detail from api helpers). */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

export function showSuccess(message: string, title?: string) {
  return pushToast({ type: "success", message, title });
}

export function showError(message: string, title?: string) {
  return pushToast({ type: "error", message, title });
}

export function showWarning(message: string, title?: string) {
  return pushToast({ type: "warning", message, title });
}

/**
 * Unified catch-path for UI actions.
 * - Abort: silent
 * - Expected ApiError (4xx): toast only
 * - Unexpected: toast + console.error (real bugs / network / 5xx)
 */
export function handleClientError(
  error: unknown,
  fallback: string
): string | null {
  if (isAbortError(error)) return null;

  const message = getErrorMessage(error, fallback);

  if (!isExpectedError(error)) {
    console.error(error);
  }

  showError(message);
  return message;
}
