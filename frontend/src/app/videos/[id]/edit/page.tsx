"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getVideos, updateVideo, Video } from "@/src/lib/api";

export default function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const videoId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Состояние полей формы
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [tags, setTags] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  // Исходные данные для сравнения (чтобы отправлять только измененные поля)
  const [initialData, setInitialData] = useState<Video | null>(null);

  useEffect(() => {
    async function loadVideo() {
      try {
        // Получаем все видео (или можно использовать отдельный get-запрос, если он есть)
        const videos = await getVideos(true);
        const video = videos.find((v: Video) => (v.id || (v as any)._id) === videoId);

        if (video) {
          setInitialData(video);
          setTitle(video.title || "");
          setAuthors(video.authors ? video.authors.join(", ") : "");
          setTags(video.tags ? video.tags.join(", ") : "");
          setStreamUrl(video.azure_stream_url || "");
        } else {
          setError("Video not found");
        }
      } catch (err) {
        setError("Failed to load video details");
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
    setError(null);

    try {
      // Формируем объект только с измененными полями (требование F5)
      const updatedFields: any = {};

      if (title.trim() !== initialData.title) {
        updatedFields.title = title.trim();
      }

      const newAuthorsArray = authors.split(",").map(a => a.trim()).filter(Boolean);
      if (JSON.stringify(newAuthorsArray) !== JSON.stringify(initialData.authors)) {
        updatedFields.authors = newAuthorsArray;
      }

      const newTagsArray = tags.split(",").map(t => t.trim()).filter(Boolean);
      if (JSON.stringify(newTagsArray) !== JSON.stringify(initialData.tags)) {
        updatedFields.tags = newTagsArray;
      }

      if (streamUrl.trim() !== initialData.azure_stream_url) {
        updatedFields.azure_stream_url = streamUrl.trim();
      }

      // Если ничего не изменилось, просто возвращаем пользователя назад
      if (Object.keys(updatedFields).length === 0) {
        router.push("/");
        return;
      }

      await updateVideo(videoId, updatedFields);
      router.push("/");
    } catch (err) {
      setError("Failed to update video. Check input data.");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-gray-500">Loading video data...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Edit Video</h1>
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-800">
            Cancel
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">Authors (comma separated)</label>
            <input
              type="text"
              required
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">Azure Stream URL</label>
            <input
              type="url"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Back
            </Link>
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