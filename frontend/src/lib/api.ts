// src/lib/api.ts

export interface Video {
  _id: string;
  title: string;
  authors: string[];
  tags: string[];
  azure_stream_url: string;
  folder_id: string; 
  is_deleted: boolean;
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
}

export interface VideoUpdateInput {
  title?: string;
  authors?: string[];
  date_recorded?: string;
  tags?: string[];
  azure_stream_url?: string;
  is_deleted?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// --- VIDEOS API ---

export async function getVideos(
  includeDeleted: boolean = false,
  page: number = 1,
  limit: number = 12,
  folderId?: string,
  onlyDeleted: boolean = false 
): Promise<PaginatedVideos> {
  
  const params = new URLSearchParams({
    include_deleted: String(includeDeleted),
    page: String(page),
    limit: String(limit),
    only_deleted: String(onlyDeleted), 
  });

  if (folderId) {
    params.append("folder_id", folderId);
  }

  const res = await fetch(`${API_BASE}/videos/?${params.toString()}`, {
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error("Failed to fetch videos");
  }
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
  is_deleted: boolean;
  deleted_at?: string | null;
}

export interface FolderListResponse {
  items: Folder[];
  total_count: number;
  page: number;
  limit: number;
}

export async function getFolders(
  page: number = 1, 
  limit: number = 15, 
  onlyDeleted: boolean = false
): Promise<FolderListResponse> {
  const res = await fetch(`${API_BASE}/folders/?page=${page}&limit=${limit}&only_deleted=${onlyDeleted}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch folders");
  }
  return res.json();
}

export async function createFolder(data: { name: string; description?: string }): Promise<Folder> {
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
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete folder");
  }
}

// Восстановление папки из архива
export async function updateFolder(id: string, data: { is_deleted?: boolean }): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update folder");
  return res.json();
}