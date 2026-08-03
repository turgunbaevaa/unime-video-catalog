"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  searchCatalog,
  isAbortError,
  SEARCH_QUERY_MAX_LENGTH,
  Video,
  Folder,
} from "@/src/lib/api";
import { handleClientError } from "@/src/lib/notify";

function SearchBarInner({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [videoResults, setVideoResults] = useState<Video[]>([]);
  const [folderResults, setFolderResults] = useState<Folder[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isSearchPage = pathname === "/search";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    // Results page owns fetching — skip preview requests there.
    if (isSearchPage) return;

    const trimmed = query.trim();
    if (!trimmed) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setError(false);
      setIsLoading(true);
      setIsOpen(true);

      try {
        const data = await searchCatalog(trimmed, 1, 5, controller.signal);
        setVideoResults(data.videos || []);
        setFolderResults(data.folders || []);
        setResultQuery(trimmed);
        setIsOpen(true);
      } catch (err) {
        if (isAbortError(err)) return;
        setVideoResults([]);
        setFolderResults([]);
        setResultQuery(trimmed);
        setError(true);
        setIsOpen(true);
        handleClientError(err, "Search results could not be loaded. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isSearchPage]);

  const clearSearch = () => {
    setQuery("");
    setVideoResults([]);
    setFolderResults([]);
    setResultQuery("");
    setIsOpen(false);
    setError(false);
  };

  const goToSearchPage = () => {
    const trimmed = query.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
    if (!trimmed) return;
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const trimmedQuery = query.trim();
  const resultsMatchQuery = trimmedQuery !== "" && trimmedQuery === resultQuery;
  const previewVideos = resultsMatchQuery ? videoResults : [];
  const previewFolders = resultsMatchQuery ? folderResults : [];
  const previewLoading = Boolean(trimmedQuery) && (isLoading || !resultsMatchQuery);
  const previewError = resultsMatchQuery && error;
  const hasPreviewHits = previewFolders.length > 0 || previewVideos.length > 0;
  const showDropdown = isOpen && !isSearchPage && trimmedQuery !== "";

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
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
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (!isSearchPage && next.trim()) {
            setIsOpen(true);
          }
        }}
        onFocus={() => {
          if (!isSearchPage && query.trim()) setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            goToSearchPage();
          }
        }}
        className="block w-full p-2 pl-10 pr-10 text-sm text-gray-900 border border-gray-300 rounded-full bg-gray-50 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
        placeholder="Search folders, videos, authors, or tags..."
        aria-label="Search catalog"
        autoComplete="off"
      />

      {query && (
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
      )}

      {showDropdown && (
        <div
          id="search-preview-results"
          className="absolute z-[999] w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {previewLoading ? (
            <div className="p-4 text-sm text-gray-500 text-center">Searching...</div>
          ) : previewError ? (
            <div className="p-4 text-sm text-red-500 text-center bg-red-50">
              Connection error. Ensure backend is running.
            </div>
          ) : hasPreviewHits ? (
            <ul className="py-2 max-h-96 overflow-y-auto">
              {previewFolders.length > 0 && (
                <>
                  <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Folders
                  </li>
                  {previewFolders.map((folder) => (
                    <li
                      key={`folder-${folder._id}`}
                      className="hover:bg-gray-50 transition-colors border-b border-gray-50"
                    >
                      <Link href={`/folders/${folder._id}`} className="block px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {folder.name}
                        </div>
                        {folder.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {folder.description}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </>
              )}

              {previewVideos.length > 0 && (
                <>
                  <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Videos
                  </li>
                  {previewVideos.map((video) => (
                    <li
                      key={`video-${video._id}`}
                      className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <Link href={`/videos/${video._id}`} className="block px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {video.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {video.authors?.join(", ")}
                          {video.tags && video.tags.length > 0
                            ? ` • ${video.tags.join(", ")}`
                            : ""}
                        </div>
                      </Link>
                    </li>
                  ))}
                </>
              )}

              <li className="border-t border-gray-100 bg-gray-50/50 hover:bg-gray-100 transition-colors">
                <button
                  type="button"
                  onClick={goToSearchPage}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-blue-600 cursor-pointer flex justify-between"
                >
                  View all results <span>&rarr;</span>
                </button>
              </li>
            </ul>
          ) : (
            <div className="py-2">
              <div className="p-4 text-sm text-gray-500 text-center">
                No results for &quot;{query.trim()}&quot;
              </div>
              <div className="border-t border-gray-100 bg-gray-50/50 hover:bg-gray-100 transition-colors">
                <button
                  type="button"
                  onClick={goToSearchPage}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-blue-600 cursor-pointer flex justify-between"
                >
                  View search page <span>&rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Remount when the results URL query changes (bookmark / Enter / back-forward)
  // so the input stays in sync without a URL→state effect.
  const urlQuery = pathname === "/search" ? searchParams.get("q") || "" : "";
  const instanceKey = pathname === "/search" ? `search:${urlQuery}` : "preview";

  return <SearchBarInner key={instanceKey} initialQuery={urlQuery} />;
}
