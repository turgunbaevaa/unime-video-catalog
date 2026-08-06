import { SEARCH_QUERY_MAX_LENGTH } from "@/src/lib/api";

/** Shared debounce for global, folder, and archive live search. */
export const SEARCH_DEBOUNCE_MS = 300;

export function clampSearchQuery(value: string): string {
  return value.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
}
