"use client";

import type { ToastItem, ToastType } from "@/src/lib/notify";
import { dismissToast } from "@/src/lib/notify";

const STYLES: Record<
  ToastType,
  { bar: string; iconWrap: string; icon: string }
> = {
  success: {
    bar: "bg-emerald-500",
    iconWrap: "bg-emerald-50 text-emerald-600",
    icon: "text-emerald-600",
  },
  error: {
    bar: "bg-red-500",
    iconWrap: "bg-red-50 text-red-600",
    icon: "text-red-600",
  },
  warning: {
    bar: "bg-amber-500",
    iconWrap: "bg-amber-50 text-amber-600",
    icon: "text-amber-600",
  },
};

function ToastIcon({ type }: { type: ToastType }) {
  const className = "w-4 h-4";
  if (type === "success") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function Toast({ item }: { item: ToastItem }) {
  const styles = STYLES[item.type];

  return (
    <div
      role="status"
      aria-live={item.type === "error" ? "assertive" : "polite"}
      className="toast-enter pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-lg shadow-slate-900/10"
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`} />
      <div className="flex gap-3 p-3.5 pl-4">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}
        >
          <ToastIcon type={item.type} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          {item.title ? (
            <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
          ) : null}
          <p
            className={`text-sm text-slate-600 leading-snug ${item.title ? "mt-0.5" : ""}`}
          >
            {item.message}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismissToast(item.id)}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
