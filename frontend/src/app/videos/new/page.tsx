"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createVideo,
  VideoCreate,
  getFolderById,
  Folder,
  bulkCreateVideosWithProgress,
  VideoBulkResponse,
} from "@/src/lib/api";
import { handleClientError, showSuccess, showWarning } from "@/src/lib/notify";
import MetadataForm, {
  isFutureDate,
  parseCommaSeparated,
  todayISODate,
  type MetadataFormValues,
} from "@/src/components/MetadataForm";

type UploadMode = "single" | "bulk";

const FAILED_PREVIEW_LIMIT = 3;

const inputClass =
  "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors text-sm";

type FailedImportItem = {
  url: string;
  reason: string;
};

function BulkCompletionScreen({
  folderId,
  folderName,
  result,
  onUploadAnother,
}: {
  folderId: string;
  folderName: string;
  result: VideoBulkResponse;
  onUploadAnother: () => void;
}) {
  const [showAllFailed, setShowAllFailed] = useState(false);

  const imported = result.summary.created;
  const skipped = result.summary.skipped_duplicates;
  const failedItems: FailedImportItem[] = result.results
    .filter((row) => row.status === "invalid" || row.status === "failed")
    .map((row) => ({
      url: row.url?.trim() || "(empty line)",
      reason: row.message?.trim() || "This URL could not be imported.",
    }));
  const couldntImport = failedItems.length;
  const visibleFailed = showAllFailed
    ? failedItems
    : failedItems.slice(0, FAILED_PREVIEW_LIMIT);
  const hasMoreFailed = failedItems.length > FAILED_PREVIEW_LIMIT;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 pt-10 pb-8 text-center sm:px-10">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Upload completed
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          All URLs have been processed
          {folderName ? (
            <>
              {" "}
              for <span className="font-medium text-slate-700">{folderName}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="border-t border-gray-100 px-6 py-6 sm:px-10">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Imported
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {imported}
            </dd>
            <dd className="mt-0.5 text-xs text-gray-500">
              {imported === 1 ? "video" : "videos"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Skipped
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {skipped}
            </dd>
            <dd className="mt-0.5 text-xs text-gray-500">
              {skipped === 1 ? "duplicate" : "duplicates"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Couldn&apos;t import
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {couldntImport}
            </dd>
            <dd className="mt-0.5 text-xs text-gray-500">
              {couldntImport === 1 ? "URL" : "URLs"}
            </dd>
          </div>
        </dl>
      </div>

      {failedItems.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-6 sm:px-10">
          <h3 className="text-sm font-semibold text-slate-900">Couldn&apos;t import</h3>
          <ul className="mt-4 space-y-4">
            {visibleFailed.map((item, index) => (
              <li key={`${item.url}-${index}`} className="text-left">
                <p className="break-all font-mono text-sm text-slate-800">{item.url}</p>
                <p className="mt-1 text-xs text-gray-500">
                  <span className="font-medium text-gray-400">Reason</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>
          {hasMoreFailed && (
            <button
              type="button"
              onClick={() => setShowAllFailed((open) => !open)}
              className="mt-4 text-sm font-medium text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline cursor-pointer"
            >
              {showAllFailed
                ? "Show fewer"
                : `Show all (${failedItems.length})`}
            </button>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-5 sm:px-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onUploadAnother}
          className="inline-flex justify-center items-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Upload Another Batch
        </button>
        <Link
          href={`/folders/${folderId}`}
          className="inline-flex justify-center items-center px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
        >
          Open Folder
        </Link>
      </div>
    </div>
  );
}

function NewVideoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const folderId = searchParams.get("folderId");

  const [mode, setMode] = useState<UploadMode>("single");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingFolder, setIsCheckingFolder] = useState(true);
  const [folder, setFolder] = useState<Folder | null>(null);

  // Upload-specific
  const [title, setTitle] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");

  // Conference (mode-specific)
  const [conferenceName, setConferenceName] = useState("");
  const [conferencePart, setConferencePart] = useState("");
  const [sameConference, setSameConference] = useState(false);
  const [bulkConferenceName, setBulkConferenceName] = useState("");

  // Shared metadata
  const [meta, setMeta] = useState<MetadataFormValues>({
    authors: "",
    tags: "",
    language: "",
    dateRecorded: "",
    publisher: "",
    copyright: "",
    description: "",
    performAi: true,
  });

  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    url: string;
  } | null>(null);
  const [bulkResult, setBulkResult] = useState<VideoBulkResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const maxDate = todayISODate();

  useEffect(() => {
    const checkFolderStatus = async () => {
      if (!folderId) {
        setIsCheckingFolder(false);
        return;
      }
      try {
        const folderData = await getFolderById(folderId);
        if (folderData.is_deleted) {
          showWarning("Cannot add videos to an archived folder.");
          router.push("/videos/archive");
          return;
        }
        setFolder(folderData);
        setIsCheckingFolder(false);
      } catch (error) {
        handleClientError(error, "The target folder does not exist.");
        router.push("/");
      }
    };

    checkFolderStatus();
  }, [folderId, router]);

  const parseAuthors = () => parseCommaSeparated(meta.authors);
  const parseTags = () => parseCommaSeparated(meta.tags);

  const patchMeta = (patch: Partial<MetadataFormValues>) => {
    setMeta((prev) => ({ ...prev, ...patch }));
  };

  const validateDateRecorded = (): boolean => {
    if (meta.dateRecorded && isFutureDate(meta.dateRecorded)) {
      showWarning("Recording dates cannot be in the future.");
      return false;
    }
    return true;
  };

  const sharedPayloadFields = () => ({
    authors: parseAuthors(),
    tags: parseTags(),
    language: meta.language.trim() || undefined,
    publisher: meta.publisher.trim() || undefined,
    copyright: meta.copyright.trim() || undefined,
    description: meta.description.trim() || undefined,
    date_recorded: meta.dateRecorded
      ? new Date(meta.dateRecorded).toISOString()
      : undefined,
    perform_ai_processing: meta.performAi,
  });

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId) {
      showWarning("Videos must be created inside a folder. Open a folder and use Add Video.");
      return;
    }
    if (!validateDateRecorded()) return;

    setIsLoading(true);

    const payload: VideoCreate = {
      title,
      azure_stream_url: streamUrl,
      folder_id: folderId,
      ...sharedPayloadFields(),
    };

    const trimmedConference = conferenceName.trim();
    if (trimmedConference) {
      payload.conference_group = trimmedConference;
      const partNum = parseInt(conferencePart, 10);
      if (conferencePart.trim() && !Number.isNaN(partNum)) {
        payload.conference_part = partNum;
      }
    }

    try {
      await createVideo(payload);
      showSuccess("Video created.");
      router.push(`/folders/${folderId}`);
      router.refresh();
    } catch (err) {
      handleClientError(err, "This video could not be created.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId) {
      showWarning("Videos must be created inside a folder.");
      return;
    }

    const urls = bulkUrls.split(/\r?\n/);
    if (!urls.some((u) => u.trim())) {
      showWarning("Paste at least one Azure URL (one per line).");
      return;
    }

    if (!validateDateRecorded()) return;

    if (sameConference && !bulkConferenceName.trim()) {
      showWarning("Enter a conference name, or turn off conference mode.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setBulkResult(null);
    setProgress({ current: 0, total: urls.filter((u) => u.trim()).length || 1, url: "" });

    try {
      const result = await bulkCreateVideosWithProgress(
        {
          folder_id: folderId,
          urls,
          ...sharedPayloadFields(),
          conference_group: sameConference
            ? bulkConferenceName.trim()
            : undefined,
        },
        {
          signal: controller.signal,
          onProgress: (info) => setProgress(info),
        }
      );
      setBulkResult(result);
      setProgress(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        showWarning("Bulk upload cancelled.");
      } else {
        handleClientError(err, "The bulk upload could not be completed.");
      }
      setProgress(null);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleCancelBulk = () => {
    abortRef.current?.abort();
  };

  const handleUploadAnotherBatch = () => {
    setBulkResult(null);
    setBulkUrls("");
    setProgress(null);
    setMode("bulk");
  };

  if (isCheckingFolder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">
        Verifying folder...
      </div>
    );
  }

  if (!folderId || !folder) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Choose a folder first</h1>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          Videos are created from inside a folder so the catalog stays organized. Open a folder
          and use Add Video.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
        >
          Browse Folders
        </Link>
      </div>
    );
  }

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const showBulkCompletion = mode === "bulk" && Boolean(bulkResult) && !isLoading;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href={`/folders/${folderId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4 inline-block transition-colors"
          >
            &larr; Back to {folder.name}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {showBulkCompletion ? "Bulk Upload" : "Add Video"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {showBulkCompletion ? (
              <>
                Finished importing into{" "}
                <span className="font-medium text-slate-700">{folder.name}</span>
              </>
            ) : (
              <>
                Creating in folder{" "}
                <span className="font-medium text-slate-700">{folder.name}</span>
              </>
            )}
          </p>
        </div>

        {showBulkCompletion && bulkResult ? (
          <BulkCompletionScreen
            folderId={folderId}
            folderName={folder.name}
            result={bulkResult}
            onUploadAnother={handleUploadAnotherBatch}
          />
        ) : (
          <>
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => {
                  setMode("single");
                  setBulkResult(null);
                }}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "single"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-gray-600 hover:text-slate-800"
                }`}
              >
                Single Upload
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("bulk");
                }}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "bulk"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-gray-600 hover:text-slate-800"
                }`}
              >
                Bulk Upload
              </button>
            </div>

            {mode === "single" ? (
              <form
                onSubmit={handleSingleSubmit}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Video Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="title"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Introduction to Machine Learning"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="streamUrl"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Azure Stream URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="streamUrl"
                      type="url"
                      required
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                      placeholder="https://web.microsoftstream.com/video/..."
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="conferenceName"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Conference name (optional)
                    </label>
                    <input
                      id="conferenceName"
                      type="text"
                      value={conferenceName}
                      onChange={(e) => setConferenceName(e.target.value)}
                      placeholder="e.g. International AI Conference 2026"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="conferencePart"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Part number (optional)
                    </label>
                    <input
                      id="conferencePart"
                      type="number"
                      min={1}
                      value={conferencePart}
                      onChange={(e) => setConferencePart(e.target.value)}
                      placeholder="e.g. 1"
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Videos with the same conference name are grouped together in the folder
                      view.
                    </p>
                  </div>

                  <MetadataForm
                    values={meta}
                    onChange={patchMeta}
                    disabled={isLoading}
                    maxDate={maxDate}
                  />
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-gray-100">
                  <Link
                    href={`/folders/${folderId}`}
                    className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? "Saving..." : "Save Video"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleBulkSubmit}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="bulkUrls"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Azure URLs <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="bulkUrls"
                      required
                      rows={8}
                      value={bulkUrls}
                      onChange={(e) => setBulkUrls(e.target.value)}
                      disabled={isLoading}
                      placeholder={
                        "https://web.microsoftstream.com/video/...\nhttps://....blob.core.windows.net/...\n..."
                      }
                      className={`${inputClass} font-mono resize-y`}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      One URL per line. Empty lines are skipped.
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameConference}
                        onChange={(e) => setSameConference(e.target.checked)}
                        disabled={isLoading}
                        className="rounded border-gray-300"
                      />
                      These videos belong to the same conference
                    </label>
                    {sameConference && (
                      <div className="mt-3">
                        <label
                          htmlFor="bulkConferenceName"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Conference name
                        </label>
                        <input
                          id="bulkConferenceName"
                          type="text"
                          value={bulkConferenceName}
                          onChange={(e) => setBulkConferenceName(e.target.value)}
                          disabled={isLoading}
                          placeholder="e.g. International AI Conference 2026"
                          className={inputClass}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Part numbers are assigned automatically in URL order (1, 2, 3…).
                        </p>
                      </div>
                    )}
                  </div>

                  <MetadataForm
                    values={meta}
                    onChange={patchMeta}
                    disabled={isLoading}
                    bulk
                    maxDate={maxDate}
                  />
                </div>

                {isLoading && progress && (
                  <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex justify-between text-xs text-gray-600 mb-2">
                      <span className="truncate max-w-[70%]" title={progress.url}>
                        {progress.url
                          ? `Processing: ${progress.url}`
                          : "Starting…"}
                      </span>
                      <span>
                        {progress.current} / {progress.total}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-gray-100">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleCancelBulk}
                      className="px-5 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  ) : (
                    <Link
                      href={`/folders/${folderId}`}
                      className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </Link>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !bulkUrls.trim()}
                    className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? "Uploading…" : "Upload All"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function NewVideoPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
      <NewVideoContent />
    </Suspense>
  );
}
