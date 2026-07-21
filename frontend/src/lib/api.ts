// src/lib/api.ts

export interface Video {
  _id: string;
  title: string;
  authors: string[];
  tags: string[];
  azure_stream_url: string;
  is_deleted: boolean;
  // We can add ai_processing fields here later in Phase 3/4
}

export interface VideoCreate {
  title: string;
  authors: string[];
  tags: string[];
  azure_stream_url: string;
}

export interface VideoUpdateInput {
  title?: string;
  authors?: string[];
  date_recorded?: string;
  tags?: string[];
  azure_stream_url?: string;
  is_deleted?: boolean;
}

const API_BASE = "http://127.0.0.1:8000/api/v1";

// 1. List videos
export async function getVideos(includeDeleted = false): Promise<Video[]> {
  const url = `${API_BASE}/videos/${includeDeleted ? "?include_deleted=true" : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
}

// 2. Get single video
export async function getVideo(id: string): Promise<Video> {
  const res = await fetch(`${API_BASE}/videos/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch video");
  return res.json();
}

// 3. Create video
export async function createVideo(data: VideoCreate): Promise<Video> {
  const res = await fetch(`${API_BASE}/videos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create video");
  return res.json();
}

// 4. Update video (PATCH)
export async function updateVideo(id: string, data: VideoUpdateInput): Promise<Video> {
  const res = await fetch(`${API_BASE}/videos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
    throw new Error("Failed to update video");
  }

  return res.json();
}

// 5. Delete video (soft or permanent)
export async function deleteVideo(id: string, permanent = false): Promise<void> {
  const url = permanent 
    ? `${API_BASE}/videos/${id}/permanent` 
    : `${API_BASE}/videos/${id}`;
    
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete video");
}