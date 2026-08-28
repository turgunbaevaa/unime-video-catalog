"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getVideos, updateVideo, deleteVideo, getFolders, updateFolder, deleteFolder, Video, Folder } from "@/src/lib/api";
import { getErrorMessage, handleClientError, showSuccess, showWarning } from "@/src/lib/notify";
import {
  DisplayItem,
  groupVideosByConference,
  isConferenceItem,
  setConferenceActivePart,
} from "@/src/lib/conferenceGrouping";
import { useLiveSearchQuery } from "@/src/hooks/useLiveSearchQuery";
import LiveSearchField from "@/src/components/LiveSearchField";
import { parsePage } from "@/src/lib/pagination";

function buildArchiveHref(
  overrides: { page?: number; q?: string },
  current: { page: number; q: string }
) {
  const params = new URLSearchParams();
  const page = overrides.page ?? current.page;
  const q = overrides.q !== undefined ? overrides.q : current.q;
  if (page > 1) params.set("page", String(page));
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return qs ? `/videos/archive?${qs}` : "/videos/archive";
}

function ArchiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = parsePage(searchParams.get("page"));
  const qParam = searchParams.get("q") || "";
  const limit = 12;

  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [deletedFolders, setDeletedFolders] = useState<Folder[]>([]);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeFolders, setActiveFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; videoIds: string[]; }>({ isOpen: false, videoIds: [] });
  const [restoreModal, setRestoreModal] = useState<{ isOpen: boolean; videoIds: string[]; }>({ isOpen: false, videoIds: [] });
  const [folderDeleteModal, setFolderDeleteModal] = useState<{ isOpen: boolean; folderId: string | null; }>({ isOpen: false, folderId: null });
  const [folderDeleteError, setFolderDeleteError] = useState<string | null>(null);

  const commitSearch = useCallback(
    (trimmed: string) => {
      router.replace(buildArchiveHref({ page: 1, q: trimmed }, { page: currentPage, q: qParam }));
    },
    [router, currentPage, qParam]
  );

  const {
    query: archiveSearch,
    setQuery: setArchiveSearch,
    clear: clearArchiveSearch,
  } = useLiveSearchQuery(qParam, commitSearch);

  const handleConferencePartChange = (conferenceGroup: string, newIndex: number) => {
    setDisplayItems((prevItems) =>
      setConferenceActivePart(prevItems, conferenceGroup, newIndex)
    );
  };

  const fetchArchiveData = useCallback(async () => {
    try {
      setListError(null);
      setIsListLoading(true);

      const trimmedQ = qParam.trim() || undefined;

      const [videosData, matchedFoldersData, membershipFoldersData] = await Promise.all([
        getVideos(false, currentPage, limit, undefined, true, trimmedQ),
        getFolders(1, 100, true, trimmedQ),
        trimmedQ ? getFolders(1, 100, true) : Promise.resolve(null),
      ]);

      const membershipFolders = membershipFoldersData?.items ?? matchedFoldersData.items;
      setDeletedFolders(matchedFoldersData.items);

      const archivedFolderIds = new Set(membershipFolders.map((f: Folder) => f._id));
      const standaloneDeletedVideos = videosData.items.filter(
        (video: Video) => !archivedFolderIds.has(video.folder_id)
      );

      setDisplayItems(groupVideosByConference(standaloneDeletedVideos));
      setTotalPages(Math.ceil(videosData.total_count / limit) || 1);
    } catch (error) {
      setDeletedFolders([]);
      setDisplayItems([]);
      setTotalPages(1);
      setListError(
        getErrorMessage(error, "Archive results could not be loaded. Please try again.")
      );
    } finally {
      setIsListLoading(false);
      setHasLoadedOnce(true);
    }
  }, [currentPage, limit, qParam]);

  useEffect(() => {
    void fetchArchiveData();
  }, [fetchArchiveData]);

  // --- ACTIONS FOR VIDEOS ---
  const confirmRestore = async (ids: string[]) => {
    try {
      const foldersData = await getFolders(1, 100, false);
      setActiveFolders(foldersData.items);
      if (foldersData.items.length > 0) {
        setSelectedFolderId(foldersData.items[0]._id);
      } else {
        setSelectedFolderId("");
      }
      setRestoreModal({ isOpen: true, videoIds: ids });
    } catch (error) {
      handleClientError(error, "Active folders could not be loaded.");
    }
  };

  const executeRestore = async () => {
    if (restoreModal.videoIds.length === 0 || !selectedFolderId) {
      showWarning("Please select a target folder.");
      return;
    }
    try {
      await Promise.all(
        restoreModal.videoIds.map(id => updateVideo(id, { is_deleted: false, folder_id: selectedFolderId }))
      );
      await fetchArchiveData();
      setRestoreModal({ isOpen: false, videoIds: [] });
      showSuccess("Video restored.");
    } catch (error) {
      handleClientError(error, "The videos could not be restored.");
    }
  };

  const executePermanentDelete = async () => {
    if (deleteModal.videoIds.length === 0) return;
    try {
      await Promise.all(deleteModal.videoIds.map(id => deleteVideo(id, true)));
      await fetchArchiveData();
      setDeleteModal({ isOpen: false, videoIds: [] });
      showSuccess("Video permanently deleted.");
    } catch (error) {
      handleClientError(error, "This video could not be permanently deleted.");
    }
  };

  // --- ACTIONS FOR FOLDERS ---
  const executeRestoreFolder = async (folderId: string) => {
    try {
      await updateFolder(folderId, { is_deleted: false });
      await fetchArchiveData();
      showSuccess("Folder restored.");
    } catch (error) {
      handleClientError(error, "This folder could not be updated.");
    }
  };

  const executePermanentDeleteFolder = async () => {
    if (!folderDeleteModal.folderId) return;
    setFolderDeleteError(null);
    try {
      await deleteFolder(folderDeleteModal.folderId, true);
      await fetchArchiveData();
      setFolderDeleteModal({ isOpen: false, folderId: null });
      showSuccess("Folder permanently deleted.");
    } catch (error: unknown) {
      const message = handleClientError(
        error,
        "The folder cannot be permanently deleted because it still contains videos."
      );
      if (message) setFolderDeleteError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* --- HEADER --- */}
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
          <Link href="/" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            &larr; Back to Catalog
          </Link>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 max-w-xl">
          <LiveSearchField
            value={archiveSearch}
            onChange={setArchiveSearch}
            onClear={clearArchiveSearch}
            placeholder="Search archived folders and videos..."
            isSearching={isListLoading}
          />
        </div>

        {!hasLoadedOnce ? (
          <div className="text-center py-20 text-gray-500">Loading archive...</div>
        ) : listError ? (
          <div className="text-center py-16 bg-white border border-red-100 rounded-2xl shadow-sm px-6">
            <h3 className="text-lg font-medium text-slate-900 mb-2">Search failed</h3>
            <p className="text-sm text-red-600 max-w-md mx-auto">{listError}</p>
          </div>
        ) : displayItems.length === 0 && deletedFolders.length === 0 && !isListLoading ? (
          
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {qParam ? "No matching archive items" : "Archive is empty"}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              {qParam
                ? `No archived folders or videos match “${qParam}”.`
                : "There are no archived folders or videos in the university database."}
            </p>
            {!qParam && (
              <Link href="/" className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                Return to Catalog
              </Link>
            )}
          </div>

        ) : displayItems.length === 0 && deletedFolders.length === 0 && isListLoading ? (
          <div className="text-center py-20 text-sm text-gray-500">Searching…</div>
        ) : (
          <div className={isListLoading ? "opacity-60 transition-opacity" : undefined}>
            {/* --- ARCHIVED FOLDERS SECTION --- */}
            {deletedFolders.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                  Archived Folders
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {deletedFolders.map((folder) => (
                    <div key={folder._id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
                      <Link href={`/folders/${folder._id}`} className="text-lg font-semibold text-slate-900 mb-2 hover:text-blue-600 hover:underline transition-colors block">
                          {folder.name}
                      </Link>
                      <p className="text-sm text-gray-500 line-clamp-2 flex-grow mb-4">
                        {folder.description || "No description provided."}
                      </p>
                      <div className="flex gap-2 mt-auto border-t border-gray-100 pt-4">
                        <button onClick={() => executeRestoreFolder(folder._id)} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                          Restore
                        </button>
                        <button onClick={() => setFolderDeleteModal({ isOpen: true, folderId: folder._id })} className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- ARCHIVED VIDEOS SECTION --- */}
            {displayItems.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  Archived Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  {displayItems.map((item) => {
                    if (isConferenceItem(item)) {
                      const safeIndex = Math.min(item.activePartIndex, Math.max(0, item.videos.length - 1));
                      const activeVideo = item.videos[safeIndex];
                      const partLabel = (vid: Video, vIndex: number) =>
                        vid.conference_part != null
                          ? `Part ${vid.conference_part}`
                          : `DVD ${vIndex + 1}`;
                      return (
                        <div key={item.conferenceGroup} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                          <div className="flex justify-between items-start mb-3">
                            <h2 className="text-lg font-semibold text-slate-900 line-clamp-2" title={item.conferenceGroup}>{item.conferenceGroup}</h2>
                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200 whitespace-nowrap ml-2">Conference ({item.videos.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                            {item.videos.map((vid, vIndex) => (
                              <button key={vid._id} onClick={() => handleConferencePartChange(item.conferenceGroup, vIndex)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex-1 ${item.activePartIndex === vIndex ? 'bg-white text-slate-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                                {partLabel(vid, vIndex)}
                              </button>
                            ))}
                          </div>
                          <div className="mb-4 flex-grow">
                            <div className="mb-3">
                              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">Authors</span>
                              <span className="text-sm text-slate-700 block line-clamp-1">{activeVideo.authors?.join(', ')}</span>
                            </div>
                            {activeVideo.tags && activeVideo.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {activeVideo.tags.map((tag, tagIdx) => (
                                  <span key={tagIdx} className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-auto">
                            <div className="flex justify-between items-center">
                              <a href={activeVideo.azure_stream_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                                Watch {partLabel(activeVideo, item.activePartIndex)}
                              </a>
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">Archived</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button type="button" onClick={() => confirmRestore(item.videos.map(v => v._id))} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                                  Restore Conference
                              </button>
                              <button type="button" onClick={() => setDeleteModal({ isOpen: true, videoIds: item.videos.map(v => v._id) })} className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm">
                                Delete Conference
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const video = item as Video;
                      return (
                        <div key={video._id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                          <h2 className="text-lg font-semibold text-slate-900 mb-3 line-clamp-2" title={video.title}>{video.title}</h2>
                          <div className="mb-4 flex-grow">
                            <div className="mb-3">
                              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">Authors</span>
                              <span className="text-sm text-slate-700 block line-clamp-1" title={video.authors?.join(', ')}>{video.authors?.join(', ')}</span>
                            </div>
                            {video.tags && video.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {video.tags.map((tag, tagIdx) => (
                                  <span key={tagIdx} className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-auto">
                            <div className="flex justify-between items-center">
                              <a href={video.azure_stream_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">Watch Video</a>
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">Archived</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button type="button" onClick={() => confirmRestore([video._id])} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                                  Restore
                              </button>
                              <button type="button" onClick={() => setDeleteModal({ isOpen: true, videoIds: [video._id] })} className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm">Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- PAGINATION (for videos only) --- */}
        {hasLoadedOnce && !listError && totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-12 mb-8">
            {currentPage > 1 ? (
              <Link
                href={buildArchiveHref({ page: currentPage - 1 }, { page: currentPage, q: qParam })}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg shadow-sm font-medium text-sm"
              >
                Previous
              </Link>
            ) : (
              <button disabled className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm">Previous</button>
            )}
            <span className="text-sm text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
            {currentPage < totalPages ? (
              <Link
                href={buildArchiveHref({ page: currentPage + 1 }, { page: currentPage, q: qParam })}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg shadow-sm font-medium text-sm"
              >
                Next
              </Link>
            ) : (
              <button disabled className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm">Next</button>
            )}
          </div>
        )}
      </main>

      {/* --- MODALS --- */}
      {/* Video Permanent Delete */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Are you sure?</h3>
            <p className="text-gray-500 mb-6">This will permanently delete the selected item(s). This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, videoIds: [] })} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={executePermanentDelete} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Permanent Delete */}
      {folderDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Delete Folder?</h3>
            <p className="text-gray-500 mb-4">This will permanently delete the folder. It must be empty (no videos inside).</p>
            
            {folderDeleteError && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                {folderDeleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 relative z-10">
              <button 
                onClick={() => {
                  setFolderDeleteModal({ isOpen: false, folderId: null });
                  setFolderDeleteError(null);
                }} 
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                {folderDeleteError ? "Close" : "Cancel"}
              </button>
              
              {!folderDeleteError && (
                <button 
                  onClick={executePermanentDeleteFolder} 
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Restore */}
      {restoreModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Restore Video</h3>
            <p className="text-gray-500 mb-4 text-sm">Select the target folder where you want to restore this video.</p>
            {activeFolders.length === 0 ? (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">No active folders found. Please create a folder first before restoring.</div>
            ) : (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Folder <span className="text-red-500">*</span></label>
                <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-sm bg-white">
                  {activeFolders.map((folder) => (
                    <option key={folder._id} value={folder._id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setRestoreModal({ isOpen: false, videoIds: [] })} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button disabled={activeFolders.length === 0} onClick={executeRestore} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrashPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading archive...</div>}>
      <ArchiveContent />
    </Suspense>
  );
}