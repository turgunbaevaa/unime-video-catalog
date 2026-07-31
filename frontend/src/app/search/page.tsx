"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { searchCatalog, isAbortError, Video, Folder } from "@/src/lib/api";

function parsePage(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") || "").trim();
  const page = parsePage(searchParams.get("page"));
  const limit = 12;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalFolders, setTotalFolders] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(q));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;

    const controller = new AbortController();
    let cancelled = false;

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);
      setFolders([]);
      setVideos([]);

      try {
        const data = await searchCatalog(q, page, limit, controller.signal);
        if (cancelled) return;
        setFolders(data.folders || []);
        setVideos(data.videos || []);
        setTotalFolders(data.total_folders || 0);
        setTotalVideos(data.total_videos || 0);
      } catch (err) {
        if (isAbortError(err) || cancelled) return;
        console.error("Search failed:", err);
        setFolders([]);
        setVideos([]);
        setTotalFolders(0);
        setTotalVideos(0);
        setError("Could not load search results. Please try again.");
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchResults();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [q, page]);

  // Derive empty-query view from the URL so we don't need a clearing effect.
  const visibleFolders = q ? folders : [];
  const visibleVideos = q ? videos : [];
  const visibleTotalFolders = q ? totalFolders : 0;
  const visibleTotalVideos = q ? totalVideos : 0;
  const visibleLoading = Boolean(q) && isLoading;
  const visibleError = q ? error : null;

  const totalHits = visibleTotalFolders + visibleTotalVideos;
  const totalPages = Math.max(
    Math.ceil(visibleTotalFolders / limit) || 0,
    Math.ceil(visibleTotalVideos / limit) || 0,
    1
  );
  const pageOutOfRange =
    !visibleLoading &&
    !visibleError &&
    q.length > 0 &&
    totalHits > 0 &&
    page > totalPages;
  const pageEmpty =
    !visibleLoading &&
    !visibleError &&
    q.length > 0 &&
    totalHits > 0 &&
    visibleFolders.length === 0 &&
    visibleVideos.length === 0;
  const showPagination =
    !visibleLoading &&
    !visibleError &&
    q.length > 0 &&
    totalHits > 0 &&
    totalPages > 1;

  const resultsHref = (nextPage: number) =>
    `/search?q=${encodeURIComponent(q)}&page=${nextPage}`;

  if (visibleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Searching...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Search Results</h1>
          <p className="text-sm text-gray-500 mt-2">
            {q ? (
              <>
                Found {totalHits} {totalHits === 1 ? "result" : "results"} for{" "}
                <span className="font-semibold text-slate-900">&quot;{q}&quot;</span>
                {totalHits > 0 && (
                  <span className="text-gray-400">
                    {" "}
                    ({visibleTotalFolders}{" "}
                    {visibleTotalFolders === 1 ? "folder" : "folders"}, {visibleTotalVideos}{" "}
                    {visibleTotalVideos === 1 ? "video" : "videos"})
                  </span>
                )}
              </>
            ) : (
              "Enter a search query to find folders and videos."
            )}
          </p>
        </div>

        {visibleError ? (
          <div className="text-center py-20 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-medium text-red-800 mb-2">Search failed</h3>
            <p className="text-sm text-red-600 mb-4">{visibleError}</p>
            <Link
              href={q ? `/search?q=${encodeURIComponent(q)}` : "/"}
              className="text-sm font-medium text-red-700 hover:underline"
            >
              Try again
            </Link>
          </div>
        ) : !q || totalHits === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
            <p className="text-sm text-gray-500">
              {q
                ? "Try adjusting your search query or check for typos."
                : "Use the search bar above to look for folders, titles, authors, or tags."}
            </p>
          </div>
        ) : pageEmpty || pageOutOfRange ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-medium text-slate-900 mb-2">No items on this page</h3>
            <p className="text-sm text-gray-500 mb-4">
              This page is outside the available results for this query.
            </p>
            <Link
              href={resultsHref(1)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Go to page 1
            </Link>
          </div>
        ) : (
          <>
            {visibleFolders.length > 0 && (
              <section className="mb-12" aria-label="Folder results">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Folders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {visibleFolders.map((folder) => (
                    <Link
                      key={folder._id}
                      href={`/folders/${folder._id}`}
                      className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <svg
                        className="w-12 h-12 text-slate-200 group-hover:text-slate-800 transition-colors mb-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                      </svg>
                      <span className="font-semibold text-slate-700 group-hover:text-slate-900 line-clamp-1">
                        {folder.name}
                      </span>
                      {folder.description && (
                        <span className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                          {folder.description}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {visibleVideos.length > 0 && (
              <section aria-label="Video results">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Videos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleVideos.map((video) => (
                    <div
                      key={video._id}
                      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                    >
                      <h2
                        className="text-lg font-semibold text-slate-900 mb-3 line-clamp-2"
                        title={video.title}
                      >
                        {video.title}
                      </h2>

                      <div className="mb-4 flex-grow">
                        <div className="mb-3">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">
                            Authors
                          </span>
                          <span className="text-sm text-slate-700 block line-clamp-1">
                            {video.authors?.join(", ") || "—"}
                          </span>
                        </div>
                        {video.tags && video.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {video.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-100 mt-auto flex justify-between items-center">
                        <Link
                          href={`/videos/${video._id}`}
                          className="text-sm font-medium text-slate-900 hover:underline"
                        >
                          View Details &rarr;
                        </Link>
                        {video.folder_id && (
                          <Link
                            href={`/folders/${video.folder_id}`}
                            className="text-xs font-medium text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                          >
                            Go to Folder
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {showPagination && !pageOutOfRange && (
          <nav
            className="flex justify-center items-center space-x-4 mt-12 mb-8"
            aria-label="Search pagination"
          >
            {page > 1 ? (
              <Link
                href={resultsHref(page - 1)}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                Previous
              </Link>
            ) : (
              <button
                disabled
                className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm"
              >
                Previous
              </button>
            )}

            <span className="text-sm text-gray-600 font-medium">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>

            {page < totalPages ? (
              <Link
                href={resultsHref(page + 1)}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                Next
              </Link>
            ) : (
              <button
                disabled
                className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm"
              >
                Next
              </button>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">Loading...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
