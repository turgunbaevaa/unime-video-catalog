// src/lib/api.ts

export interface TranscriptSegment {
  start_time: number;
  end_time: number;
  text: string;
}

export interface AIProcessing {
  status: string;
  language?: string | null;
  whisper_transcript?: string | null;
  transcript_segments?: TranscriptSegment[];
  llm_summary?: string | null;
}

export interface OpacExport {
  is_exported: boolean;
  last_exported_at?: string | null;
}

export interface Video {
  _id: string;
  title: string;
  authors: string[];
  tags: string[];
  azure_stream_url: string;
  folder_id: string;
  conference_group?: string | null;
  conference_part?: number | null;
  date_recorded?: string;
  created_at?: string;
  uploaded_by?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  description?: string | null;
  ai_processing?: AIProcessing;
  opac_export?: OpacExport;
}

export interface PaginatedVideos {
  items: Video[];
  total_count: number;
  page: number;
  limit: number;
}

export interface VideoCreate {
  title: string;
  authors: string[];
  tags: string[];
  azure_stream_url: string;
  folder_id: string;
  conference_group?: string;
  conference_part?: number;
  language?: string;
  description?: string;
  date_recorded?: string;
  perform_ai_processing?: boolean;
}

export interface VideoUpdateInput {
  title?: string;
  authors?: string[];
  date_recorded?: string | null;
  tags?: string[];
  azure_stream_url?: string;
  folder_id?: string;
  conference_group?: string | null;
  conference_part?: number | null;
  is_deleted?: boolean;
  language?: string | null;
  description?: string | null;
  perform_ai_processing?: boolean;
}

/** Normalize env so both host-only and host+/api/v1 values resolve to .../api/v1 */
function normalizeApiBase(raw?: string): string {
  const fallback = "http://127.0.0.1:8000/api/v1";
  const value = (raw || fallback).trim().replace(/\/+$/, "");
  if (/\/api\/v1$/i.test(value)) {
    return value;
  }
  return `${value}/api/v1`;
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

/** Re-export abort helper used by search UI. */
export { isAbortError } from "@/src/lib/apiError";

import {
  ApiError,
  apiFetch,
  formatApiErrorDetail,
  throwIfNotOk,
} from "@/src/lib/apiError";

// --- VIDEOS API ---

export async function getVideos(
  includeDeleted = false,
  page = 1,
  limit = 12,
  folderId?: string,
  isArchived?: boolean,
  searchQ?: string,
  sort?: string
): Promise<PaginatedVideos> {
  let url = `${API_BASE}/videos/?page=${page}&limit=${limit}`;

  if (includeDeleted) url += "&include_deleted=true";
  if (isArchived) url += "&only_deleted=true";
  if (folderId) url += `&folder_id=${folderId}`;

  if (searchQ) url += `&q=${encodeURIComponent(searchQ)}`;
  if (sort) url += `&sort=${encodeURIComponent(sort)}`;

  const res = await apiFetch(url, { cache: "no-store" });
  await throwIfNotOk(res, "The video list could not be loaded.");
  return res.json();
}

export async function getVideo(id: string): Promise<Video> {
  const res = await apiFetch(`${API_BASE}/videos/${id}`, { cache: "no-store" });
  await throwIfNotOk(res, "This video could not be loaded.");
  return res.json();
}

export async function createVideo(data: VideoCreate): Promise<Video> {
  const res = await apiFetch(`${API_BASE}/videos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await throwIfNotOk(res, "This video could not be created.");
  return res.json();
}

export interface VideoBulkCreateInput {
  folder_id: string;
  urls: string[];
  authors?: string[];
  tags?: string[];
  language?: string;
  description?: string;
  date_recorded?: string;
  perform_ai_processing?: boolean;
  conference_group?: string;
  conference_part?: number;
}

export interface VideoBulkItemResult {
  url: string;
  status:
    | "created"
    | "duplicate_in_batch"
    | "duplicate_existing"
    | "invalid"
    | "failed"
    | "empty";
  video_id?: string | null;
  title?: string | null;
  message?: string | null;
}

export interface VideoBulkSummary {
  created: number;
  skipped_duplicates: number;
  invalid_urls: number;
  failed: number;
  total: number;
}

export interface VideoBulkResponse {
  summary: VideoBulkSummary;
  results: VideoBulkItemResult[];
}

async function bulkCreateVideos(
  data: VideoBulkCreateInput,
  signal?: AbortSignal
): Promise<VideoBulkResponse> {
  const res = await apiFetch(`${API_BASE}/videos/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal,
  });
  await throwIfNotOk(res, "The bulk upload could not be completed.");
  return res.json();
}

/**
 * Processes URLs one-by-one via the bulk endpoint so the UI can show progress
 * and cancel between items. Client pre-marks empty lines and in-batch duplicates.
 */
export async function bulkCreateVideosWithProgress(
  data: VideoBulkCreateInput,
  options?: {
    signal?: AbortSignal;
    onProgress?: (info: {
      current: number;
      total: number;
      url: string;
    }) => void;
  }
): Promise<VideoBulkResponse> {
  const rawUrls = data.urls;
  const results: VideoBulkItemResult[] = [];
  const summary: VideoBulkSummary = {
    created: 0,
    skipped_duplicates: 0,
    invalid_urls: 0,
    failed: 0,
    total: rawUrls.length,
  };

  const seen = new Set<string>();
  const toCreate: { index: number; url: string }[] = [];

  rawUrls.forEach((raw, index) => {
    const url = (raw || "").trim();
    if (!url) {
      summary.invalid_urls += 1;
      results[index] = {
        url: "",
        status: "empty",
        message: "Empty line skipped",
      };
      return;
    }
    if (seen.has(url)) {
      summary.skipped_duplicates += 1;
      results[index] = {
        url,
        status: "duplicate_in_batch",
        message: "Duplicate URL in this upload batch",
      };
      return;
    }
    seen.add(url);
    toCreate.push({ index, url });
  });

  let processedCreates = 0;
  for (const item of toCreate) {
    if (options?.signal?.aborted) {
      throw new DOMException("Bulk upload cancelled", "AbortError");
    }
    options?.onProgress?.({
      current: processedCreates + 1,
      total: toCreate.length,
      url: item.url,
    });

    const conferencePart =
      data.conference_group && data.conference_group.trim()
        ? processedCreates + 1
        : undefined;

    const partial = await bulkCreateVideos(
      {
        ...data,
        urls: [item.url],
        conference_part: conferencePart,
      },
      options?.signal
    );
    const row = partial.results[0];
    results[item.index] = row;
    summary.created += partial.summary.created;
    summary.skipped_duplicates += partial.summary.skipped_duplicates;
    summary.invalid_urls += partial.summary.invalid_urls;
    summary.failed += partial.summary.failed;
    processedCreates += 1;
  }

  return {
    summary,
    results: results.filter(Boolean),
  };
}

export async function updateVideo(id: string, data: VideoUpdateInput): Promise<Video> {
  const res = await apiFetch(`${API_BASE}/videos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  await throwIfNotOk(res, "This video could not be updated.");
  return res.json();
}

export async function deleteVideo(id: string, permanent = false): Promise<void> {
  const url = permanent
    ? `${API_BASE}/videos/${id}/permanent`
    : `${API_BASE}/videos/${id}`;

  const res = await apiFetch(url, { method: "DELETE" });
  await throwIfNotOk(
    res,
    permanent
      ? "This video could not be permanently deleted."
      : "This video could not be archived."
  );
}

// --- FOLDERS API ---

export interface Folder {
  _id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string | null;
  last_updated?: string | null;
  video_count?: number;
  is_deleted: boolean;
  deleted_at?: string | null;
}

export interface FolderListResponse {
  items: Folder[];
  total_count: number;
  page: number;
  limit: number;
}

// --- SEARCH API ---

export const SEARCH_QUERY_MAX_LENGTH = 200;

export interface SearchResponse {
  folders: Folder[];
  videos: Video[];
  total_folders: number;
  total_videos: number;
  page: number;
  limit: number;
}

function emptySearchResponse(page: number, limit: number): SearchResponse {
  return {
    folders: [],
    videos: [],
    total_folders: 0,
    total_videos: 0,
    page,
    limit,
  };
}

export async function searchCatalog(
  q: string,
  page = 1,
  limit = 12,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const trimmed = q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit)
    ? Math.min(100, Math.max(1, Math.floor(limit)))
    : 12;

  if (!trimmed) {
    return emptySearchResponse(safePage, safeLimit);
  }

  const url =
    `${API_BASE}/search/?q=${encodeURIComponent(trimmed)}` +
    `&page=${safePage}&limit=${safeLimit}`;

  const res = await apiFetch(url, { cache: "no-store", signal });
  await throwIfNotOk(res, "Search results could not be loaded. Please try again.");
  return res.json();
}

export async function getFolders(
  page: number = 1,
  limit: number = 15,
  onlyDeleted: boolean = false,
  searchQ?: string
): Promise<FolderListResponse> {
  let url = `${API_BASE}/folders/?page=${page}&limit=${limit}&only_deleted=${onlyDeleted}`;
  if (searchQ?.trim()) {
    url += `&q=${encodeURIComponent(searchQ.trim())}`;
  }
  const res = await apiFetch(url, {
    cache: "no-store",
  });
  await throwIfNotOk(res, "The folder list could not be loaded.");
  return res.json();
}

export async function createFolder(data: {
  name: string;
  description?: string;
}): Promise<Folder> {
  const res = await apiFetch(`${API_BASE}/folders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await throwIfNotOk(res, "This folder could not be created.");
  return res.json();
}

export async function getFolderById(id: string): Promise<Folder> {
  const res = await apiFetch(`${API_BASE}/folders/${id}`, {
    cache: "no-store",
  });
  await throwIfNotOk(res, "This folder could not be loaded.");
  return res.json();
}

export async function deleteFolder(id: string, permanent = false): Promise<void> {
  const url = permanent
    ? `${API_BASE}/folders/${id}/permanent`
    : `${API_BASE}/folders/${id}`;

  const res = await apiFetch(url, { method: "DELETE" });
  await throwIfNotOk(
    res,
    permanent
      ? "This folder could not be permanently deleted."
      : "This folder could not be archived."
  );
}

// Restoring / editing a Folder
export async function updateFolder(
  id: string,
  data: { is_deleted?: boolean; name?: string; description?: string }
): Promise<Folder> {
  const res = await apiFetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await throwIfNotOk(res, "This folder could not be updated.");
  return res.json();
}

// --- BACKUP / RESTORE ---

export interface RestoreBackupResult {
  message: string;
  folders_restored: number;
  videos_restored: number;
}

export async function downloadDatabaseBackup(): Promise<void> {
  const res = await apiFetch(`${API_BASE}/export/backup`, { cache: "no-store" });
  await throwIfNotOk(res, "The database backup could not be downloaded.");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "unime_db_backup.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function restoreDatabaseBackup(
  file: File,
  onProgress?: (percent: number) => void
): Promise<RestoreBackupResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/import/backup`);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };

    xhr.onload = () => {
      let payload: {
        message?: string;
        detail?: unknown;
        folders_restored?: number;
        videos_restored?: number;
      } = {};
      let parseFailed = false;
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        parseFailed = true;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          message: payload.message || "Database successfully restored!",
          folders_restored: payload.folders_restored ?? 0,
          videos_restored: payload.videos_restored ?? 0,
        });
        return;
      }

      if (parseFailed && !xhr.responseText) {
        reject(
          new ApiError(
            "The database could not be restored from this backup file.",
            { status: xhr.status || 0, expected: false }
          )
        );
        return;
      }

      reject(
        new ApiError(
          formatApiErrorDetail(
            payload.detail,
            "The database could not be restored from this backup file."
          ),
          {
            status: xhr.status,
            detail: payload.detail,
            expected: xhr.status >= 400 && xhr.status < 500,
          }
        )
      );
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          "A network error occurred while restoring the database backup.",
          { status: 0, expected: false }
        )
      );
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}
