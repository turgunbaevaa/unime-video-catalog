"use client";

import { useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS, clampSearchQuery } from "@/src/lib/liveSearch";

/**
 * Local input state synced to a URL (or other) committed query.
 * Typing debounces into onCommit; clear commits immediately.
 */
export function useLiveSearchQuery(
  urlQuery: string,
  onCommit: (trimmedQuery: string) => void
) {
  const [query, setQuery] = useState(urlQuery);
  const committedRef = useRef(clampSearchQuery(urlQuery));
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // Sync from external URL changes (back/forward, clear links).
  useEffect(() => {
    const next = clampSearchQuery(urlQuery);
    if (next !== committedRef.current) {
      committedRef.current = next;
      setQuery(urlQuery);
      return;
    }
    setQuery((prev) => (prev === urlQuery ? prev : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    const trimmed = clampSearchQuery(query);
    const timer = setTimeout(() => {
      if (trimmed === committedRef.current) return;
      committedRef.current = trimmed;
      onCommitRef.current(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const clear = () => {
    setQuery("");
    if (committedRef.current === "") return;
    committedRef.current = "";
    onCommitRef.current("");
  };

  return { query, setQuery, clear };
}
