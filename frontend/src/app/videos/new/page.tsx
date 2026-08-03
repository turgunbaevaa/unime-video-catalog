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

type UploadMode = "single" | "bulk";

function NewVideoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const folderId = searchParams.get("folderId");

  const [mode, setMode] = useState<UploadMode>("single");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingFolder, setIsCheckingFolder] = useState(true);
  const [folder, setFolder] = useState<Folder | null>(null);

  // Shared metadata (single + bulk)
  const [authors, setAuthors] = useState("");
  const [tags, setTags] = useState("");

  // Single-only
  const [title, setTitle] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [conferenceName, setConferenceName] = useState("");
  const [conferencePart, setConferencePart] = useState("");

  // Bulk-only
  const [bulkUrls, setBulkUrls] = useState("");
  const [language, setLanguage] = useState("");
  const [publisher, setPublisher] = useState("");
  const [copyright, setCopyright] = useState("");
  const [description, setDescription] = useState("");
  const [dateRecorded, setDateRecorded] = useState("");
  const [performAi, setPerformAi] = useState(true);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    url: string;
  } | null>(null);
  const [bulkResult, setBulkResult] = useState<VideoBulkResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const parseAuthors = () =>
    authors.split(",").map((a) => a.trim()).filter(Boolean);
  const parseTags = () => tags.split(",").map((t) => t.trim()).filter(Boolean);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId) {
      showWarning("Videos must be created inside a folder. Open a folder and use Add Video.");
      return;
    }

    setIsLoading(true);

    const payload: VideoCreate = {
      title,
      authors: parseAuthors(),
      tags: parseTags(),
      azure_stream_url: streamUrl,
      folder_id: folderId,
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
          authors: parseAuthors(),
          tags: parseTags(),
          language: language.trim() || undefined,
          publisher: publisher.trim() || undefined,
          copyright: copyright.trim() || undefined,
          description: description.trim() || undefined,
          date_recorded: dateRecorded ? new Date(dateRecorded).toISOString() : undefined,
          perform_ai_processing: performAi,
        },
        {
          signal: controller.signal,
          onProgress: (info) => setProgress(info),
        }
      );
      setBulkResult(result);
      setProgress(null);
      showSuccess(`Bulk upload complete: ${result.summary.created} video(s) created.`);
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

  const downloadBulkJson = () => {
    if (!bulkResult) return;
    const blob = new Blob([JSON.stringify(bulkResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_upload_result.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Video</h1>
          <p className="text-sm text-gray-500 mt-2">
            Creating in folder <span className="font-medium text-slate-700">{folder.name}</span>
          </p>
        </div>

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
                <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                  Video Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Introduction to Machine Learning"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="streamUrl" className="block text-sm font-medium text-slate-700 mb-1">
                  Azure Stream URL <span className="text-red-500">*</span>
                </label>
                <input
                  id="streamUrl"
                  type="url"
                  required
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://web.microsoftstream.com/video/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
                />
              </div>

            <div>
              <label htmlFor="conferenceName" className="block text-sm font-medium text-slate-700 mb-1">
                Conference name (optional)
              </label>
              <input
                id="conferenceName"
                type="text"
                value={conferenceName}
                onChange={(e) => setConferenceName(e.target.value)}
                placeholder="e.g. Storia Romana 2026"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="conferencePart" className="block text-sm font-medium text-slate-700 mb-1">
                Part number (optional)
              </label>
              <input
                id="conferencePart"
                type="number"
                min={1}
                value={conferencePart}
                onChange={(e) => setConferencePart(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">
                Videos with the same conference name are grouped together in the folder view.
              </p>
            </div>

            <div>
              <label htmlFor="authors" className="block text-sm font-medium text-slate-700 mb-1">
                Authors
              </label>
                <input
                  id="authors"
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Comma separated (e.g. Dr. Spada, Prof. Rossi)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-slate-700 mb-1">
                  Tags
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Comma separated (e.g. lecture, 2026, physics)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
                />
              </div>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target folder
                </label>
                <input
                  type="text"
                  readOnly
                  value={folder.name}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-slate-700"
                />
              </div>

              <div>
                <label htmlFor="bulkUrls" className="block text-sm font-medium text-slate-700 mb-1">
                  Azure URLs <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="bulkUrls"
                  required
                  rows={8}
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  disabled={isLoading}
                  placeholder={"https://web.microsoftstream.com/video/...\nhttps://....blob.core.windows.net/...\n..."}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors text-sm font-mono resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">One URL per line. Empty lines are skipped.</p>
              </div>

              <div>
                <label htmlFor="bulkAuthors" className="block text-sm font-medium text-slate-700 mb-1">
                  Authors
                </label>
                <input
                  id="bulkAuthors"
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  disabled={isLoading}
                  placeholder="Comma separated (shared for all URLs)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="bulkTags" className="block text-sm font-medium text-slate-700 mb-1">
                  Tags
                </label>
                <input
                  id="bulkTags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={isLoading}
                  placeholder="Comma separated"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-slate-700 mb-1">
                    Language
                  </label>
                  <input
                    id="language"
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isLoading}
                    placeholder="e.g. it, en"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="dateRecorded" className="block text-sm font-medium text-slate-700 mb-1">
                    Date recorded
                  </label>
                  <input
                    id="dateRecorded"
                    type="date"
                    value={dateRecorded}
                    onChange={(e) => setDateRecorded(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="publisher" className="block text-sm font-medium text-slate-700 mb-1">
                  Publisher
                </label>
                <input
                  id="publisher"
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="copyright" className="block text-sm font-medium text-slate-700 mb-1">
                  Copyright
                </label>
                <input
                  id="copyright"
                  type="text"
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={performAi}
                  onChange={(e) => setPerformAi(e.target.checked)}
                  disabled={isLoading}
                  className="rounded border-gray-300"
                />
                Perform AI processing (marks videos as pending for transcription)
              </label>
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

            {bulkResult && !isLoading && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                <h3 className="font-semibold text-slate-900 mb-2">Upload complete</h3>
                <ul className="space-y-1 text-slate-700 mb-4">
                  <li>Created: {bulkResult.summary.created}</li>
                  <li>Skipped duplicates: {bulkResult.summary.skipped_duplicates}</li>
                  <li>Invalid URLs: {bulkResult.summary.invalid_urls}</li>
                  <li>Failed: {bulkResult.summary.failed}</li>
                  <li>Total lines: {bulkResult.summary.total}</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadBulkJson}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Download result JSON
                  </button>
                  <Link
                    href={`/folders/${folderId}`}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    Open folder
                  </Link>
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
                  Back
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
