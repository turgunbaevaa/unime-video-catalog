"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/src/components/ui/Toast";
import { subscribeToasts, type ToastItem } from "@/src/lib/notify";

/**
 * Global toast viewport (top-right). Mount once near the app root.
 * Confirmation / destructive modals stay on individual pages.
 */
export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed top-4 right-4 z-[10000] flex w-[min(100vw-2rem,24rem)] flex-col gap-2.5"
      >
        {items.map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
