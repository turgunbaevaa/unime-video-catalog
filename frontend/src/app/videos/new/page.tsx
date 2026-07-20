"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createVideo } from "@/src/lib/api";

export default function NewVideoPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for the form fields 
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [tags, setTags] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const authorsArray = authors.split(",").map((a) => a.trim()).filter(Boolean);
    const tagsArray = tags.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      await createVideo({
        title,
        authors: authorsArray,
        tags: tagsArray,
        azure_stream_url: streamUrl,
      });

      router.push("/");
      router.refresh(); 
    } catch (err) {
      console.error(err);
      setError("An error occurred while saving the video.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4 inline-block">
            &larr; Back to Catalog
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Add New Video
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Create a new catalog record for a lecture.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Title Field */}
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

            {/* Stream URL Field */}
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

            {/* Authors Field */}
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

            {/* Tags Field */}
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
              href="/"
              className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center"
            >
              {isLoading ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>

      </main>
    </div>
  );
}