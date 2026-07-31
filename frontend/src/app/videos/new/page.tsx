"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createVideo, VideoCreate, getFolderById, Folder } from "@/src/lib/api";

function NewVideoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const folderId = searchParams.get("folderId");

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingFolder, setIsCheckingFolder] = useState(true);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [tags, setTags] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  const [groupId, setGroupId] = useState("");
  const [partNumber, setPartNumber] = useState("");

  useEffect(() => {
    const checkFolderStatus = async () => {
      if (!folderId) {
        setIsCheckingFolder(false);
        return;
      }
      try {
        const folderData = await getFolderById(folderId);
        if (folderData.is_deleted) {
          alert("Security Alert: Cannot add videos to an archived folder!");
          router.push("/videos/archive");
          return;
        }
        setFolder(folderData);
        setIsCheckingFolder(false);
      } catch (error) {
        console.error("Folder not found", error);
        alert("Error: Target folder does not exist.");
        router.push("/");
      }
    };

    checkFolderStatus();
  }, [folderId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId) {
      setError("Videos must be created inside a folder. Open a folder and use Add Video.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const authorsArray = authors.split(",").map((a) => a.trim()).filter(Boolean);
    const tagsArray = tags.split(",").map((t) => t.trim()).filter(Boolean);

    const payload: VideoCreate = {
      title,
      authors: authorsArray,
      tags: tagsArray,
      azure_stream_url: streamUrl,
      folder_id: folderId,
    };

    if (groupId.trim()) {
      payload.group_id = groupId.trim();
    }
    if (partNumber.trim()) {
      payload.part_number = parseInt(partNumber, 10);
    }

    try {
      await createVideo(payload);
      router.push(`/folders/${folderId}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("An error occurred while saving the video.");
    } finally {
      setIsLoading(false);
    }
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Video</h1>
          <p className="text-sm text-gray-500 mt-2">
            Creating in folder <span className="font-medium text-slate-700">{folder.name}</span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

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

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <label htmlFor="groupId" className="block text-sm font-medium text-slate-700 mb-1">
                  Playlist Group ID (Optional)
                </label>
                <input
                  id="groupId"
                  type="text"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  placeholder="e.g. history_rome_2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors text-sm"
                  title="Use the same ID for all videos in a series (e.g. CD1, CD2)"
                />
              </div>
              <div>
                <label htmlFor="partNumber" className="block text-sm font-medium text-slate-700 mb-1">
                  Part / CD Number
                </label>
                <input
                  id="partNumber"
                  type="number"
                  min="1"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. 1, 2, 3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors text-sm"
                />
              </div>
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
