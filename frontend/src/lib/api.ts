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
  group_id?: string | null;
  part_number?: number | null;
  date_recorded?: string;
  created_at?: string;
  uploaded_by?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
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
  group_id?: string;
  part_number?: number;
}

export interface VideoUpdateInput {
  title?: string;
  authors?: string[];
  date_recorded?: string;
  tags?: string[];
  azure_stream_url?: string;
  folder_id?: string;
  group_id?: string;
  part_number?: number;
  is_deleted?: boolean;
}

/** Normalize env so both host-only and host+/api/v1 values resolve to .../api/v1 */
export function normalizeApiBase(raw?: string): string {
  const fallback = "http://127.0.0.1:8000/api/v1";
  const value = (raw || fallback).trim().replace(/\/+$/, "");
  if (/\/api\/v1$/i.test(value)) {
    return value;
  }
  return `${value}/api/v1`;
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

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

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
}

export async function getVideo(id: string): Promise<Video> {
  const res = await fetch(`${API_BASE}/videos/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch video");
  return res.json();
}

export async function createVideo(data: VideoCreate): Promise<Video> {
  const res = await fetch(`${API_BASE}/videos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create video");
  return res.json();
}

export async function updateVideo(id: string, data: VideoUpdateInput): Promise<Video> {
  const res = await fetch(`${API_BASE}/videos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error("Failed to update video");
  }

  return res.json();
}

export async function deleteVideo(id: string, permanent = false): Promise<void> {
  const url = permanent
    ? `${API_BASE}/videos/${id}/permanent`
    : `${API_BASE}/videos/${id}`;

  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete video");
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

export function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "AbortError"
  );
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

  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error("Failed to search catalog");
  return res.json();
}

export async function getFolders(
  page: number = 1,
  limit: number = 15,
  onlyDeleted: boolean = false
): Promise<FolderListResponse> {
  const res = await fetch(
    `${API_BASE}/folders/?page=${page}&limit=${limit}&only_deleted=${onlyDeleted}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch folders");
  }
  return res.json();
}

export async function createFolder(data: {
  name: string;
  description?: string;
}): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("Failed to create folder");
  }
  return res.json();
}

export async function getFolderById(id: string): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch folder details");
  }
  return res.json();
}

export async function deleteFolder(id: string, permanent = false): Promise<void> {
  const url = permanent
    ? `${API_BASE}/folders/${id}/permanent`
    : `${API_BASE}/folders/${id}`;

  const res = await fetch(url, { method: "DELETE" });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({} as { detail?: string }));
    throw new Error(errorData.detail || "Failed to delete folder");
  }
}

// Restoring / editing a Folder
export async function updateFolder(
  id: string,
  data: { is_deleted?: boolean; name?: string; description?: string }
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update folder");
  return res.json();
}

// --- BACKUP / RESTORE ---

export interface RestoreBackupResult {
  message: string;
  folders_restored: number;
  videos_restored: number;
}

function formatApiErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : JSON.stringify(item)
      )
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }
  return fallback;
}

export async function downloadDatabaseBackup(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/backup`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to export database backup");
  }

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
      let payload: { message?: string; detail?: unknown; folders_restored?: number; videos_restored?: number } = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        // ignore parse errors; fall back to status text
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          message: payload.message || "Database successfully restored!",
          folders_restored: payload.folders_restored ?? 0,
          videos_restored: payload.videos_restored ?? 0,
        });
        return;
      }

      reject(
        new Error(
          formatApiErrorDetail(payload.detail, "Failed to restore database backup")
        )
      );
    };

    xhr.onerror = () => {
      reject(new Error("Network error while restoring database backup"));
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}
