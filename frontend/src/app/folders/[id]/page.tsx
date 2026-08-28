"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getVideos, getFolderById, deleteVideo, deleteFolder, updateVideo, updateFolder, getFolders, Video, Folder } from "@/src/lib/api";
import { getErrorMessage, handleClientError, showSuccess, showWarning } from "@/src/lib/notify";
import {
  DisplayItem,
  groupVideosByConference,
  isConferenceItem,
  setConferenceActivePart,
} from "@/src/lib/conferenceGrouping";
import { useSession } from "next-auth/react";
import { useLiveSearchQuery } from "@/src/hooks/useLiveSearchQuery";
import LiveSearchField from "@/src/components/LiveSearchField";
import Pagination from "@/src/components/Pagination";
import { buildFolderVideoHref } from "@/src/lib/folderNavigation";

function FolderContent() {
  const params = useParams();
  const folderId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { data: session } = useSession();
  const isAdmin = !!session;

  const currentPage = Number(searchParams.get("page")) || 1;
  const sortParam = searchParams.get("sort") || "created_at_desc";
  const qParam = searchParams.get("q") || "";
  const limit = 12;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [isEditFolderOpen, setIsEditFolderOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  const [restoreModal, setRestoreModal] = useState<{ isOpen: boolean; videoIds: string[]; }>({ isOpen: false, videoIds: [] });
  const [activeFolders, setActiveFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    videoIds: string[];
    type: 'soft' | 'permanent' | null;
  }>({ isOpen: false, videoIds: [], type: null });

  const [folderDeleteModal, setFolderDeleteModal] = useState<{
    isOpen: boolean;
    type: "soft" | "permanent" | null;
  }>({ isOpen: false, type: null });

  const [folderDeleteError, setFolderDeleteError] = useState<string | null>(null);

  const buildFolderQuery = useCallback(
    (overrides: { page?: number; sort?: string; q?: string }) => {
      const params = new URLSearchParams();
      const page = overrides.page ?? currentPage;
      const sort = overrides.sort ?? sortParam;
      const q = overrides.q !== undefined ? overrides.q : qParam;
      if (page > 1) params.set("page", String(page));
      if (sort && sort !== "created_at_desc") params.set("sort", sort);
      if (q.trim()) params.set("q", q.trim());
      const qs = params.toString();
      return qs ? `/folders/${folderId}?${qs}` : `/folders/${folderId}`;
    },
    [currentPage, sortParam, qParam, folderId]
  );

  const buildVideoDetailHref = useCallback(
    (videoId: string) => buildFolderVideoHref(videoId, { page: currentPage, q: qParam }),
    [currentPage, qParam]
  );

  const commitSearch = useCallback(
    (trimmed: string) => {
      router.replace(buildFolderQuery({ page: 1, q: trimmed }));
    },
    [router, buildFolderQuery]
  );

  const {
    query: folderSearch,
    setQuery: setFolderSearch,
    clear: clearFolderSearch,
  } = useLiveSearchQuery(qParam, commitSearch);

  const reloadVideos = useCallback(async () => {
    if (!folder) return;
    const isArchived = folder.is_deleted ? true : undefined;
    const data = await getVideos(
      false,
      currentPage,
      limit,
      folderId,
      isArchived,
      qParam || undefined,
      sortParam
    );
    setDisplayItems(groupVideosByConference(data.items));
    setTotalPages(Math.ceil(data.total_count / limit) || 1);
    setTotalCount(data.total_count);
  }, [folder, currentPage, limit, folderId, qParam, sortParam]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setListError(null);
        const knownFolder = folder && folder._id === folderId;
        if (!knownFolder) {
          setIsBootstrapping(true);
        } else {
          setIsListLoading(true);
        }

        const folderData = await getFolderById(folderId);
        if (cancelled) return;
        setFolder(folderData);

        const isArchived = folderData.is_deleted ? true : undefined;
        const videosData = await getVideos(
          false,
          currentPage,
          limit,
          folderId,
          isArchived,
          qParam || undefined,
          sortParam
        );
        if (cancelled) return;

        setDisplayItems(groupVideosByConference(videosData.items));
        setTotalPages(Math.ceil(videosData.total_count / limit) || 1);
        setTotalCount(videosData.total_count);
      } catch (error) {
        if (cancelled) return;
        const knownFolder = folder && folder._id === folderId;
        if (!knownFolder) {
          handleClientError(error, "This folder could not be loaded.");
        } else {
          setListError(
            getErrorMessage(error, "Videos could not be loaded. Please try again.")
          );
          setDisplayItems([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
          setIsListLoading(false);
        }
      }
    };

    if (folderId) {
      void load();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh list on query params; folder used for loading mode only
  }, [folderId, currentPage, sortParam, qParam]);

  const handleSortChange = (value: string) => {
    router.replace(buildFolderQuery({ page: 1, sort: value }));
  };

  const openEditFolder = () => {
    if (!folder) return;
    setEditName(folder.name);
    setEditDesc(folder.description || "");
    setIsEditFolderOpen(true);
  };

  const saveFolderEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folder || !editName.trim()) return;
    try {
      setIsSavingFolder(true);
      const updated = await updateFolder(folderId, {
        name: editName.trim(),
        description: editDesc,
      });
      setFolder(updated);
      setIsEditFolderOpen(false);
      showSuccess("Folder updated.");
    } catch (error) {
      handleClientError(error, "This folder could not be updated.");
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleConferencePartChange = (conferenceGroup: string, newIndex: number) => {
    setDisplayItems((prevItems) =>
      setConferenceActivePart(prevItems, conferenceGroup, newIndex)
    );
  };

  const confirmDelete = (ids: string[], type: 'soft' | 'permanent') => {
    setDeleteModal({ isOpen: true, videoIds: ids, type });
  };

  const executeDelete = async () => {
    const { videoIds, type } = deleteModal;
    if (videoIds.length === 0) return;

    try {
      await Promise.all(
        videoIds.map(id => deleteVideo(id, type === 'permanent'))
      );
      await reloadVideos();
      setDeleteModal({ isOpen: false, videoIds: [], type: null });
      showSuccess(deleteModal.type === "permanent" ? "Video permanently deleted." : "Video archived.");
    } catch (error) {
      handleClientError(
        error,
        deleteModal.type === "permanent"
          ? "This video could not be permanently deleted."
          : "This video could not be archived."
      );
    }
  };

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
      await reloadVideos();
      setRestoreModal({ isOpen: false, videoIds: [] });
      showSuccess("Video restored.");
    } catch (error) {
      handleClientError(error, "The videos could not be restored.");
    }
  };

  const executeFolderDelete = async () => {
    setFolderDeleteError(null);
    try {
      await deleteFolder(folderId, folderDeleteModal.type === "permanent");
      setFolderDeleteModal({ isOpen: false, type: null });
      showSuccess(
        folderDeleteModal.type === "permanent" ? "Folder permanently deleted." : "Folder archived."
      );
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = handleClientError(
        err,
        "The folder cannot be permanently deleted because it still contains videos."
      );
      if (message) setFolderDeleteError(message);
    }
  };


  if (isBootstrapping || !folder) {
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={folder.is_deleted ? "/videos/archive" : "/"}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              &larr; {folder.is_deleted ? "Back to Archive" : "Back to Catalog"}
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 line-clamp-1">
              <span className="text-gray-400 font-normal mr-2">
                {folder.is_deleted ? "Archived Folder:" : "Folder:"}
              </span>
              {folder.name}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                {!folder.is_deleted && (
                  <button
                    type="button"
                    onClick={openEditFolder}
                    className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    title="Edit Folder"
                  >
                    Edit Folder
                  </button>
                )}
                {!folder.is_deleted && (
                  <button
                    onClick={() => setFolderDeleteModal({ isOpen: true, type: 'soft' })}
                    className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    title="Archive Folder"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                    Archive Folder
                  </button>
                )}

                <button
                  onClick={() => setFolderDeleteModal({ isOpen: true, type: 'permanent' })}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                  title="Delete Folder Permanently"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>

                {!folder.is_deleted && (
                  <>
                    <div className="h-6 w-px bg-gray-300 mx-1"></div>
                    <Link
                      href={`/videos/new?folderId=${folderId}`}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      + Add Video
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {folder.description && (
          <p className="text-gray-500 mb-4 max-w-2xl">{folder.description}</p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <div className="flex-1 flex gap-2 items-center">
            <LiveSearchField
              value={folderSearch}
              onChange={setFolderSearch}
              onClear={clearFolderSearch}
              placeholder="Search videos in this folder..."
              isSearching={isListLoading}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="folder-sort" className="text-sm text-gray-500 whitespace-nowrap">
              Sort
            </label>
            <select
              id="folder-sort"
              value={sortParam}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
            >
              <option value="created_at_desc">Newest first</option>
              <option value="created_at_asc">Oldest first</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
            </select>
          </div>
          <p className="text-xs text-gray-400 sm:ml-auto">
            {qParam ? totalCount : (folder.video_count ?? totalCount)}{" "}
            {(qParam ? totalCount : (folder.video_count ?? totalCount)) === 1
              ? "video"
              : "videos"}
            {qParam ? " matching" : ""}
          </p>
        </div>

        {listError ? (
          <div className="text-center py-16 bg-white border border-red-100 rounded-2xl shadow-sm px-6">
            <h3 className="text-lg font-medium text-slate-900 mb-2">Search failed</h3>
            <p className="text-sm text-red-600 max-w-md mx-auto">{listError}</p>
          </div>
        ) : displayItems.length === 0 && !isListLoading ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {qParam ? "No matching videos" : "Folder is empty"}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              {qParam
                ? `No videos in this folder match “${qParam}”.`
                : "There are no videos uploaded to this folder yet."}
            </p>
            {isAdmin && !folder.is_deleted && !qParam && (
              <Link
                href={`/videos/new?folderId=${folderId}`}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Upload First Video
              </Link>
            )}
          </div>
        ) : displayItems.length === 0 && isListLoading ? (
          <div className="text-center py-20 text-sm text-gray-500">Searching…</div>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 ${isListLoading ? "opacity-60 transition-opacity" : ""}`}>
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
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-slate-900 line-clamp-2" title={item.conferenceGroup}>
                          {item.conferenceGroup}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1" title={activeVideo.title}>
                          {activeVideo.title}
                        </p>
                      </div>
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200 whitespace-nowrap ml-2">
                        Conference ({item.videos.length})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                      {item.videos.map((vid, vIndex) => (
                        <button
                          key={vid._id}
                          onClick={() => handleConferencePartChange(item.conferenceGroup, vIndex)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex-1 ${
                            item.activePartIndex === vIndex
                              ? 'bg-white text-slate-900 shadow-sm border border-gray-200'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {partLabel(vid, vIndex)}
                        </button>
                      ))}
                    </div>

                    <div className="mb-4 flex-grow">
                      <div className="mb-3">
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">Authors</span>
                        <span className="text-sm text-slate-700 block line-clamp-1">
                          {(activeVideo.authors ?? []).join(', ')}
                        </span>
                      </div>

                      {activeVideo.tags && activeVideo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {activeVideo.tags.map((tag, tagIdx) => (
                            <span key={tagIdx} className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-auto">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <a href={activeVideo.azure_stream_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                            Watch {partLabel(activeVideo, item.activePartIndex)}
                          </a>
                          <Link href={buildVideoDetailHref(activeVideo._id)} className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline transition-colors">
                            Details &rarr;
                          </Link>
                        </div>
                        {activeVideo.is_deleted && (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-md">Deleted</span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex gap-2 mt-3">
                          {!activeVideo.is_deleted ? (
                            <>
                              <button type="button" onClick={() => router.push(`/videos/${activeVideo._id}/edit`)} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                                Edit
                              </button>
                              <button type="button" onClick={() => confirmDelete([activeVideo._id], 'soft')} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                                Archive
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => confirmRestore([activeVideo._id])} className="flex-1 py-1.5 px-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-md cursor-pointer">
                              Restore
                            </button>
                          )}
                          <button type="button" onClick={() => confirmDelete([activeVideo._id], 'permanent')} className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm cursor-pointer">
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              const video = item as Video;
              return (
                <div key={video._id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <h2 className="text-lg font-semibold text-slate-900 mb-3 line-clamp-2" title={video.title}>
                    {video.title}
                  </h2>

                  <div className="mb-4 flex-grow">
                    <div className="mb-3">
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">Authors</span>
                      <span className="text-sm text-slate-700 block line-clamp-1" title={(video.authors ?? []).join(', ')}>
                        {(video.authors ?? []).join(', ')}
                      </span>
                    </div>

                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {video.tags.map((tag, tagIdx) => (
                          <span key={tagIdx} className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-auto">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <a href={video.azure_stream_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                          Watch Video
                        </a>
                        <Link href={buildVideoDetailHref(video._id)} className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline transition-colors">
                          View Details &rarr;
                        </Link>
                      </div>
                      {video.is_deleted && (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-md">Deleted</span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex gap-2 mt-3">
                        {!video.is_deleted ? (
                          <>
                            <button type="button" onClick={() => router.push(`/videos/${video._id}/edit`)} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                              Edit
                            </button>
                            <button type="button" onClick={() => confirmDelete([video._id], 'soft')} className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                              Archive
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => confirmRestore([video._id])} className="flex-1 py-1.5 px-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-md cursor-pointer">
                            Restore
                          </button>
                        )}
                        <button type="button" onClick={() => confirmDelete([video._id], 'permanent')} className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm cursor-pointer">
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

        {!listError && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            getPageHref={(page) => buildFolderQuery({ page })}
            ariaLabel="Folder videos pagination"
          />
        )}
      </main>

      {isEditFolderOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Edit Folder</h3>
            <form onSubmit={saveFolderEdits}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Folder Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditFolderOpen(false)}
                  disabled={isSavingFolder}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFolder || !editName.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingFolder ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Are you sure?</h3>
            <p className="text-gray-500 mb-6">
              {deleteModal.type === 'permanent'
                ? "This will permanently delete the selected item(s). This action cannot be undone."
                : "This will archive the selected item(s). They will be hidden from this folder."}
            </p>
            <div className="flex justify-end gap-3 relative z-10">
              <button type="button" onClick={() => setDeleteModal({ isOpen: false, videoIds: [], type: null })} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={executeDelete} className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors shadow-sm cursor-pointer ${deleteModal.type === 'permanent' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                {deleteModal.type === 'permanent' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {folderDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {folderDeleteModal.type === 'permanent' ? 'Delete Folder?' : 'Archive Folder?'}
            </h3>
            <p className="text-gray-500 mb-4">
              {folderDeleteModal.type === 'permanent'
                ? "Are you sure you want to permanently delete this folder? It must be completely empty."
                : "This will move the folder to the archive. It will no longer be visible on the main page."}
            </p>

            {folderDeleteError && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                {folderDeleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 relative z-10">
              <button
                type="button"
                onClick={() => {
                  setFolderDeleteModal({ isOpen: false, type: null });
                  setFolderDeleteError(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                {folderDeleteError ? "Close" : "Cancel"}
              </button>

              {!folderDeleteError && (
                <button
                  type="button"
                  onClick={executeFolderDelete}
                  className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors shadow-sm cursor-pointer ${folderDeleteModal.type === 'permanent' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                >
                  {folderDeleteModal.type === 'permanent' ? 'Delete' : 'Archive'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

export default function FolderPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
      <FolderContent />
    </Suspense>
  );
}
