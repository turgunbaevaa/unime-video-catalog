"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  getVideo,
  updateVideo,
  getFolders,
  Video,
  Folder,
  VideoUpdateInput,
} from "@/src/lib/api";
import { handleClientError, showSuccess } from "@/src/lib/notify";

export default function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const videoId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [tags, setTags] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [folderId, setFolderId] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [conferenceName, setConferenceName] = useState("");
  const [conferencePart, setConferencePart] = useState("");

  const [initialData, setInitialData] = useState<Video | null>(null);

  useEffect(() => {
    async function loadVideo() {
      try {
        const [video, foldersData] = await Promise.all([
          getVideo(videoId),
          getFolders(1, 100, false),
        ]);

        setInitialData(video);
        setTitle(video.title || "");
        setAuthors(video.authors ? video.authors.join(", ") : "");
        setTags(video.tags ? video.tags.join(", ") : "");
        setStreamUrl(video.azure_stream_url || "");
        setFolderId(video.folder_id || "");
        setConferenceName(video.conference_group || "");
        setConferencePart(
          video.conference_part != null ? String(video.conference_part) : ""
        );
        setFolders(foldersData.items);
      } catch (error) {
        handleClientError(error, "This video could not be loaded.");
      } finally {
        setIsLoading(false);
      }
    }

    loadVideo();
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData) return;

    setIsSaving(true);

    try {
      const updatedFields: VideoUpdateInput = {};

      if (title.trim() !== initialData.title) {
        updatedFields.title = title.trim();
      }

      const newAuthorsArray = authors.split(",").map((a) => a.trim()).filter(Boolean);
      if (JSON.stringify(newAuthorsArray) !== JSON.stringify(initialData.authors)) {
        updatedFields.authors = newAuthorsArray;
      }

      const newTagsArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (JSON.stringify(newTagsArray) !== JSON.stringify(initialData.tags)) {
        updatedFields.tags = newTagsArray;
      }

      if (streamUrl.trim() !== initialData.azure_stream_url) {
        updatedFields.azure_stream_url = streamUrl.trim();
      }

      if (folderId && folderId !== initialData.folder_id) {
        updatedFields.folder_id = folderId;
      }

      const trimmedConference = conferenceName.trim();
      const initialGroup = initialData.conference_group?.trim() || "";
      if (trimmedConference !== initialGroup) {
        updatedFields.conference_group = trimmedConference || null;
        if (!trimmedConference) {
          updatedFields.conference_part = null;
        }
      }

      if (trimmedConference) {
        const partNum = conferencePart.trim()
          ? parseInt(conferencePart, 10)
          : null;
        const initialPart = initialData.conference_part ?? null;
        const newPart = partNum !== null && !Number.isNaN(partNum) ? partNum : null;
        if (newPart !== initialPart) {
          updatedFields.conference_part = newPart;
        }
      }

      const targetFolder = folderId || initialData.folder_id;

      if (Object.keys(updatedFields).length === 0) {
        router.push(targetFolder ? `/folders/${targetFolder}` : "/");
        return;
      }

      await updateVideo(videoId, updatedFields);
      showSuccess("Video updated.");
      router.push(targetFolder ? `/folders/${targetFolder}` : "/");
    } catch (error) {
      handleClientError(error, "This video could not be updated.");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-gray-500">Loading video data...</div>;
  }

  if (initialData?.is_deleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="w-16 h-16 mb-4 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Video is Archived</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          This video has been moved to the archive. You cannot edit it unless you restore it first.
        </p>
        <button
          onClick={() => router.push("/videos/archive")}
          className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
        >
          Go to Archive
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Edit Video</h1>
          <button
            onClick={() => router.back()}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Folder
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              {!folderId && <option value="">Select a folder</option>}
              {folderId && !folders.some((f) => f._id === folderId) && (
                <option value={folderId}>Current folder</option>
              )}
              {folders.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Only this video moves to the selected folder.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Conference name (optional)
            </label>
            <input
              type="text"
              value={conferenceName}
              onChange={(e) => setConferenceName(e.target.value)}
              placeholder="e.g. Storia Romana 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Part number (optional)
            </label>
            <input
              type="number"
              min={1}
              value={conferencePart}
              onChange={(e) => setConferencePart(e.target.value)}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Authors (comma separated)
            </label>
            <input
              type="text"
              required
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Azure Stream URL
            </label>
            <input
              type="url"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
