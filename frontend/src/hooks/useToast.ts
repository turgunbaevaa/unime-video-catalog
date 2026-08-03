"use client";

import { useCallback } from "react";
import {
  dismissToast,
  getErrorMessage,
  handleClientError,
  showError,
  showInfo,
  showSuccess,
  showWarning,
  type ToastType,
  pushToast,
} from "@/src/lib/notify";

/**
 * Convenience hook around the global toast helpers.
 * Safe to call from any client component under ToastProvider.
 */
export function useToast() {
  const toast = useCallback(
    (type: ToastType, message: string, title?: string) =>
      pushToast({ type, message, title }),
    []
  );

  return {
    toast,
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
    dismiss: dismissToast,
    getErrorMessage,
    handleClientError,
  };
}
