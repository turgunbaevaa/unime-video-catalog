"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SEARCH_QUERY_MAX_LENGTH } from "@/src/lib/api";
import { SEARCH_DEBOUNCE_MS, clampSearchQuery } from "@/src/lib/liveSearch";

/**
 * Header global search: typing live-updates /search via debounce.
 * Uses replace for query edits; push only when leaving the catalog for search.
 * Clearing the query returns to the catalog.
 */
function SearchBarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = pathname === "/search" ? searchParams.get("q") || "" : "";
  const [query, setQuery] = useState(urlQuery);

  /** Last query we wrote to the URL (avoids fighting browser back/forward). */
  const lastCommittedRef = useRef(urlQuery);

  // Sync from URL when navigation came from outside (back/forward / links).
  useEffect(() => {
    if (pathname === "/search") {
      const next = searchParams.get("q") || "";
      if (next !== lastCommittedRef.current) {
        lastCommittedRef.current = next;
        setQuery(next);
      }
      return;
    }

    if (pathname === "/" && lastCommittedRef.current !== "") {
      lastCommittedRef.current = "";
      setQuery("");
    }
  }, [pathname, searchParams]);

  // Debounced live navigation
  useEffect(() => {
    const trimmed = clampSearchQuery(query);

    const timer = setTimeout(() => {
      if (!trimmed) {
        if (pathname === "/search") {
          lastCommittedRef.current = "";
          router.replace("/");
        }
        return;
      }

      const href = `/search?q=${encodeURIComponent(trimmed)}`;
      const currentQ =
        pathname === "/search" ? (searchParams.get("q") || "").trim() : "";

      if (pathname === "/search" && currentQ === trimmed) {
        lastCommittedRef.current = trimmed;
        return;
      }

      lastCommittedRef.current = trimmed;

      if (pathname === "/search") {
        router.replace(href);
      } else {
        // First jump from catalog → keep Back → catalog
        router.push(href);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, pathname, router, searchParams]);

  const commitNow = () => {
    const trimmed = clampSearchQuery(query);
    if (!trimmed) {
      if (pathname === "/search") {
        lastCommittedRef.current = "";
        router.replace("/");
      }
      return;
    }
    const href = `/search?q=${encodeURIComponent(trimmed)}`;
    const currentQ =
      pathname === "/search" ? (searchParams.get("q") || "").trim() : "";
    if (pathname === "/search" && currentQ === trimmed) {
      return;
    }
    lastCommittedRef.current = trimmed;
    if (pathname === "/search") {
      router.replace(href);
    } else {
      router.push(href);
    }
  };

  const clearSearch = () => {
    setQuery("");
    if (pathname === "/search") {
      lastCommittedRef.current = "";
      router.replace("/");
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <input
        type="search"
        value={query}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitNow();
          }
          if (e.key === "Escape" && query) {
            e.preventDefault();
            clearSearch();
          }
        }}
        className="block w-full p-2 pl-10 pr-10 text-sm text-gray-900 border border-gray-300 rounded-full bg-gray-50 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
        placeholder="Search folders, videos, authors, or tags..."
        aria-label="Search catalog"
        autoComplete="off"
      />

      {query ? (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export default function SearchBar() {
  return <SearchBarInner />;
}
