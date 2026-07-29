"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getVideos, getFolderById, deleteVideo, deleteFolder, Video, Folder } from "@/src/lib/api";
import { useSession } from "next-auth/react";

function FolderContent() {
  const params = useParams();
  const folderId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { data: session } = useSession();
  const isAdmin = !!session;

  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = 12;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);


  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    videoId: string | null;
    type: 'soft' | 'permanent' | null;
  }>({ isOpen: false, videoId: null, type: null });

  const [folderDeleteModal, setFolderDeleteModal] = useState<{
    isOpen: boolean;
    type: "soft" | "permanent" | null;
}>({
    isOpen: false,
    type: null,
});


  useEffect(() => {
    const loadFolderAndVideos = async () => {
      try {
        setIsLoading(true);
        const folderData = await getFolderById(folderId);
        setFolder(folderData);

        const videosData = await getVideos(false, currentPage, limit, folderId);
        setVideos(videosData.items);
        setTotalPages(Math.ceil(videosData.total_count / limit));
      } catch (error) {
        console.error("Error loading folder data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (folderId) {
      loadFolderAndVideos();
    }
  }, [folderId, currentPage]);


  const confirmDelete = (id: string, type: 'soft' | 'permanent') => {
    setDeleteModal({ isOpen: true, videoId: id, type });
  };

  const executeDelete = async () => {
    const { videoId, type } = deleteModal;
    if (!videoId) return;

    try {
      await deleteVideo(videoId, type === 'permanent');
      const data = await getVideos(false, currentPage, limit, folderId);
      
      if (data.items.length === 0 && currentPage > 1) {
        router.push(`/folders/${folderId}?page=${currentPage - 1}`);
      } else {
        setVideos(data.items);
        setTotalPages(Math.ceil(data.total_count / limit));
      }
      setDeleteModal({ isOpen: false, videoId: null, type: null });
    } catch (error) {
      console.error("Failed to delete video:", error);
      alert("Error deleting video.");
    }
  };

  const executeFolderDelete = async () => {
  try {
    await deleteFolder(
      folderId,
      folderDeleteModal.type === "permanent"
    );

    router.push("/");

  } catch (err: any) {

    alert(err.message);

  } finally {

    setFolderDeleteModal({
      isOpen: false,
      type: null,
    });

  }
  };


  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 text-center py-20 text-gray-500">Loading workspace...</div>;
  }

  if (!folder) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Folder not found</h2>
        <Link href="/" className="text-blue-600 hover:underline">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* --- HEADER --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
              &larr; Back to Catalog
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 line-clamp-1">
              <span className="text-gray-400 font-normal mr-2">Folder:</span> 
              {folder.name}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => setFolderDeleteModal({ isOpen: true, type: 'soft' })}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  title="Archive Folder"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                  Archive Folder
                </button>
                <button
                  onClick={() => setFolderDeleteModal({ isOpen: true, type: 'permanent' })}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                  title="Delete Folder Permanently"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
                
                <div className="h-6 w-px bg-gray-300 mx-1"></div>

                <Link
                  href={`/videos/new?folderId=${folderId}&returnPage=${currentPage}`}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                  + Add Video
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* --- CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {folder.description && (
          <p className="text-gray-500 mb-8 max-w-2xl">{folder.description}</p>
        )}

        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Folder is empty</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              There are no videos uploaded to this folder yet.
            </p>
            {isAdmin && (
              <Link
                href={`/videos/new?folderId=${folderId}&returnPage=${currentPage}`}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Upload First Video
              </Link>
            )}
          </div>
        ) : (
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

                  <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-auto">
                    <div className="flex justify-between items-center">
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
                        <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-md">Deleted</span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex gap-2 mt-3">
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- PAGINATION FOR VIDEO --- */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-12 mb-8">
            {currentPage > 1 ? (
              <Link
                href={`/folders/${folderId}?page=${currentPage - 1}`}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                Previous
              </Link>
            ) : (
              <button disabled className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm">
                Previous
              </button>
            )}
            <span className="text-sm text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
            {currentPage < totalPages ? (
              <Link
                href={`/folders/${folderId}?page=${currentPage + 1}`}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                Next
              </Link>
            ) : (
              <button disabled className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm">
                Next
              </button>
            )}
          </div>
        )}
      </main>

      {/* --- MODAL VIEW TO DELETE VIDEO --- */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Are you sure?</h3>
            <p className="text-gray-500 mb-6">
              {deleteModal.type === 'permanent'
                ? "This will permanently delete the video. This action cannot be undone."
                : "This will archive the video. It will be hidden from this folder."}
            </p>
            <div className="flex justify-end gap-3 relative z-10">
              <button type="button" onClick={() => setDeleteModal({ isOpen: false, videoId: null, type: null })} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={executeDelete} className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors shadow-sm cursor-pointer ${deleteModal.type === 'permanent' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                {deleteModal.type === 'permanent' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL VIEW TO DELETE A FOLDER --- */}
      {folderDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {folderDeleteModal.type === 'permanent' ? 'Delete Folder?' : 'Archive Folder?'}
            </h3>
            <p className="text-gray-500 mb-6">
              {folderDeleteModal.type === 'permanent'
                ? "Are you sure you want to permanently delete this folder? This action cannot be undone."
                : "This will move the folder to the archive. It will no longer be visible on the main page."}
            </p>
            <div className="flex justify-end gap-3 relative z-10">
              <button type="button" onClick={() => setFolderDeleteModal({ isOpen: false, type: null })} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={executeFolderDelete} className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors shadow-sm cursor-pointer ${folderDeleteModal.type === 'permanent' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                {folderDeleteModal.type === 'permanent' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FolderPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
      <FolderContent />
    </Suspense>
  );
}