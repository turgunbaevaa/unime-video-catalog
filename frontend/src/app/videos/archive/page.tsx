"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getVideos, updateVideo, deleteVideo, Video } from "@/src/lib/api";

export default function TrashPage() {
  const [deletedVideos, setDeletedVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Confirmation Modal for Permanent Deletion
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    videoId: string | null;
  }>({
    isOpen: false,
    videoId: null,
  });

  const fetchDeletedVideos = async () => {
    try {
      setIsLoading(true);
      const allVideos = await getVideos(true);
      console.log("Videos from API:", allVideos);
      console.log("First video:", allVideos[0]);
      const filtered = allVideos.filter((v: Video) => v.is_deleted);
      setDeletedVideos(filtered);
    } catch (error) {
      console.error("Error loading archive:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedVideos();
  }, []);

  const handleRestore = async (id: string) => {
    try {
      await updateVideo(id, { is_deleted: false });
      await fetchDeletedVideos();
    } catch (error) {
      console.error("Failed to restore video:", error);
      alert("Error restoring video.");
    }
  };

  const executePermanentDelete = async () => {
    if (!deleteModal.videoId) return;

    try {
      await deleteVideo(deleteModal.videoId, true);
      await fetchDeletedVideos();
      setDeleteModal({ isOpen: false, videoId: null });
    } catch (error) {
      console.error("Failed to delete video permanently:", error);
      alert("Error deleting video.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* --- NAVIGATION (HEADER) --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              UniMe <span className="text-gray-400 font-normal">Catalog</span>
            </h1>
            <span className="text-xs font-semibold text-slate-500 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
              Archive
            </span>
          </div>
          
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            ← Back to Catalog
          </Link>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading archive...</div>
        ) : deletedVideos.length === 0 ? (
          
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Archive is empty</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              There are no archived or soft-deleted videos in the university database.
            </p>
            <Link 
              href="/" 
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
            >
              Return to Catalog
            </Link>
          </div>

        ) : (
          
          /* VIDEO LIST STATE (Grid 2 cols) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
            {deletedVideos.map((video, index) => {
              const uniqueId = video._id;
              const uniqueKey = uniqueId || index;

              return (
                <div 
                  key={uniqueKey} 
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
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

                    {video.tags && video.tags.length > 0 && (
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
                      <a 
                        href={video.azure_stream_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        Watch Video
                      </a>
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                        Archived
                      </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => handleRestore(uniqueId)}
                        className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
                      >
                        Restore
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDeleteModal({ isOpen: true, videoId: uniqueId })}
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
              This will permanently delete the video. This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, videoId: null })}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executePermanentDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}