"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getVideos, deleteVideo, Video } from "@/src/lib/api";

export default function Home() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Condition for controlling a modal window
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    videoId: string | null;
    type: 'soft' | 'permanent' | null;
  }>({
    isOpen: false,
    videoId: null,
    type: null,
  });

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const data = await getVideos();
      setVideos(data);
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const confirmDelete = (id: string, type: 'soft' | 'permanent') => {
    setDeleteModal({ isOpen: true, videoId: id, type });
  };

  const executeDelete = async () => {
    const { videoId, type } = deleteModal;
    if (!videoId) return;

    try {
      const isPermanent = type === 'permanent';
      await deleteVideo(videoId, isPermanent);
      await fetchVideos();
      setDeleteModal({ isOpen: false, videoId: null, type: null });
    } catch (error) {
      console.error("Failed to delete video:", error);
      alert("Error deleting video.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">

      {/* --- NAVIGATION (HEADER) --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            UniMe <span className="text-gray-400 font-normal">Catalog</span>
          </h1>

          {/* Обертка для кнопок справа с отступом между ними */}
          <div className="flex items-center gap-3">
            <Link
              href="/videos/archive"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Archive
            </Link>

            <Link
              href="/videos/new"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
            >
              + Add New Video
            </Link>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading catalog...</div>
        ) : videos.length === 0 ? (

          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Catalog is empty</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              There are no videos here yet. Be the first to upload material to the university database.
            </p>
            <Link
              href="/videos/new"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Upload Video
            </Link>
          </div>

        ) : (

          /* VIDEO LIST STATE (Grid) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
            {videos.map((video, index) => {
              const uniqueId = video._id;
              const uniqueKey = uniqueId || index;

              return (
                <div
                  key={uniqueKey}
                  className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col ${video.is_deleted ? 'opacity-60 grayscale' : ''}`}
                >
                  <h2 className="text-lg font-semibold text-slate-900 mb-3 line-clamp-2" title={video.title}>
                    {video.title}
                  </h2>

                  <div className="mb-4 flex-grow">
                    <div className="mb-3">
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">Authors</span>
                      <span className="text-sm text-slate-700 block line-clamp-1" title={video.authors.join(', ')}>
                        {video.authors.join(', ')}
                      </span>
                    </div>

                    {video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {video.tags.map((tag, tagIdx) => (
                          <span
                            key={tagIdx}
                            className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Block */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-auto">
                    <div className="flex justify-between items-center">
                      
                      {/* НОВЫЙ БЛОК: Ссылки "Watch Video" и "View Details" */}
                      <div className="flex items-center gap-4">
                        <a
                          href={video.azure_stream_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                          Watch Video
                        </a>
                        <Link 
                          href={`/videos/${uniqueId}`} 
                          className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline transition-colors"
                        >
                          View Details &rarr;
                        </Link>
                      </div>

                      {video.is_deleted && (
                        <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-md">
                          Deleted
                        </span>
                      )}
                    </div>

                    {/* Updated buttons in a consistent style */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/videos/${uniqueId}/edit`)}
                        className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
                      >
                        Edit
                      </button>
                      {!video.is_deleted && (
                        <button
                          type="button"
                          onClick={() => confirmDelete(uniqueId, 'soft')}
                          className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => confirmDelete(uniqueId, 'permanent')}
                        className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shadow-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Custom deletion confirmation modal window */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Are you sure?
            </h3>
            <p className="text-gray-500 mb-6">
              {deleteModal.type === 'permanent'
                ? "This will permanently delete the video. This action cannot be undone."
                : "This will archive the video. It will be hidden from the main catalog."}
            </p>

            <div className="flex justify-end gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, videoId: null, type: null })}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors shadow-sm cursor-pointer ${deleteModal.type === 'permanent'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                  }`}
              >
                {deleteModal.type === 'permanent' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}