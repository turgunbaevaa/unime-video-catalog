"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  Folder,
} from "@/src/lib/api";
import { handleClientError, showSuccess } from "@/src/lib/notify";
import { useSession } from "next-auth/react";
import { parsePage } from "@/src/lib/pagination";
import { buildCatalogHref, buildFolderHrefFromCatalog } from "@/src/lib/folderNavigation";

function formatFolderDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function HomeContent() {
  const searchParams = useSearchParams();

  const { data: session } = useSession();
  const isAdmin = !!session;

  const currentPage = parsePage(searchParams.get("page"));
  const limit = 15;
  const catalogHref = buildCatalogHref(currentPage);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const data = await getFolders(currentPage, limit);
      setFolders(data.items);
      setTotalPages(Math.ceil(data.total_count / limit) || 1);
    } catch (error) {
      handleClientError(error, "The folder list could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, [currentPage]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      setIsCreating(true);
      await createFolder({ name: newFolderName, description: newFolderDesc });
      setIsAddFolderModalOpen(false);
      setNewFolderName("");
      setNewFolderDesc("");
      showSuccess("Folder created.");
      fetchFolders();
    } catch (error) {
      handleClientError(error, "This folder could not be created.");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (folder: Folder, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditFolder(folder);
    setEditName(folder.name);
    setEditDesc(folder.description || "");
  };

  const handleEditFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFolder || !editName.trim()) return;

    try {
      setIsSavingEdit(true);
      await updateFolder(editFolder._id, {
        name: editName.trim(),
        description: editDesc,
      });
      setEditFolder(null);
      showSuccess("Folder updated.");
      fetchFolders();
    } catch (error) {
      handleClientError(error, "This folder could not be updated.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openDeleteModal = (folder: Folder, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(folder);
  };

  const handleDeleteFolder = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await deleteFolder(deleteTarget._id, false);
      setDeleteTarget(null);
      showSuccess("Folder archived.");
      fetchFolders();
    } catch (error) {
      handleClientError(error, "This folder could not be archived.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 py-8">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                ></path>
              </svg>
              Folders
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse the catalog by folder. Open a folder to view and manage its videos.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsAddFolderModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              + Create Folder
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading folders...</div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                ></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No folders yet</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              Create your first folder to start organizing university courses and lectures.
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsAddFolderModalOpen(true)}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Create Folder
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => {
              const updatedLabel = formatFolderDate(
                folder.last_updated || folder.updated_at || folder.created_at
              );
              const videoCount = folder.video_count ?? 0;

              return (
                <div
                  key={folder._id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-slate-400 hover:shadow-md transition-all group relative flex flex-col"
                >
                  <Link
                    href={buildFolderHrefFromCatalog(folder._id, catalogHref)}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <svg
                        className="w-10 h-10 text-slate-200 group-hover:text-slate-700 transition-colors shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path>
                      </svg>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-800 group-hover:text-slate-900 line-clamp-1">
                          {folder.name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2 min-h-[2.5rem]">
                          {folder.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 border-t border-gray-100 pt-3">
                      <span>
                        {videoCount} {videoCount === 1 ? "video" : "videos"}
                      </span>
                      {updatedLabel && <span>Updated {updatedLabel}</span>}
                    </div>
                  </Link>

                  {isAdmin && (
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={(e) => openEditModal(folder, e)}
                        className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openDeleteModal(folder, e)}
                        className="flex-1 py-1.5 px-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-12 mb-8">
            {currentPage > 1 ? (
              <Link
                href={`/?page=${currentPage - 1}`}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                Previous
              </Link>
            ) : (
              <button
                disabled
                className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm"
              >
                Previous
              </button>
            )}

            <span className="text-sm text-gray-600 font-medium">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                href={`/?page=${currentPage + 1}`}
                className="px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                Next
              </Link>
            ) : (
              <button
                disabled
                className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm"
              >
                Next
              </button>
            )}
          </div>
        )}
      </main>

      {isAddFolderModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Folder</h3>
            <form onSubmit={handleCreateFolder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Name *
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., 2026 or Machine Learning"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow text-sm"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="Brief description of contents..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 relative z-10">
                <button
                  type="button"
                  onClick={() => setIsAddFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newFolderName.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? "Creating..." : "Create Folder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editFolder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Edit Folder</h3>
            <form onSubmit={handleEditFolder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow text-sm"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditFolder(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Delete Folder?</h3>
            <p className="text-gray-500 mb-6 text-sm">
              &ldquo;{deleteTarget.name}&rdquo; and its videos will be moved to the archive.
              You can restore them later from Archive.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFolder}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
