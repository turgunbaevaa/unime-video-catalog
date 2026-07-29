"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getFolders, createFolder, Folder } from "@/src/lib/api";
import { useSession, signOut } from "next-auth/react";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: session } = useSession();
  const isAdmin = !!session; 
  
  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = 15; 

  const [folders, setFolders] = useState<Folder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // State for the Logout modal window
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const data = await getFolders(currentPage, limit);
      setFolders(data.items);
      setTotalPages(Math.ceil(data.total_count / limit));
    } catch (error) {
      console.error("Error loading folders:", error);
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
      fetchFolders(); 
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert("Error creating folder.");
    } finally {
      setIsCreating(false);
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

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <>
                <Link
                  href="/videos/archive"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Archive
                </Link>

                <button
                  onClick={() => setIsAddFolderModalOpen(true)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                  + Add Folder
                </button>

                <Link
                  href="/tools"
                  title="Admin Tools"
                  className="inline-flex items-center justify-center p-2 text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </Link>
                
                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Login (Admin)
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
          Root Directory
        </h2>

        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading collections...</div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-gray-200 border-dashed rounded-2xl shadow-sm">
            <div className="w-16 h-16 mb-5 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Directory is empty</h3>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folders.map((folder) => (
              <Link
                key={folder._id}
                href={`/folders/${folder._id}`}
                className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group"
              >
                <svg className="w-12 h-12 text-slate-200 group-hover:text-slate-800 transition-colors mb-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path>
                </svg>
                <span className="font-semibold text-slate-700 group-hover:text-slate-900 line-clamp-1">{folder.name}</span>
                {folder.description && (
                  <span className="text-[10px] text-gray-400 mt-1 line-clamp-1">{folder.description}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* --- PAGINATION CONTROLS --- */}
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
              <button disabled className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm">
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
              <button disabled className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm">
                Next
              </button>
            )}
          </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {/* Add Folder Modal */}
      {isAddFolderModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Create New Folder
            </h3>
            <form onSubmit={handleCreateFolder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Folder Name *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
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

      {/* Logout confirmation modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative pointer-events-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Sign Out
            </h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to log out of the administrator account? You will not be able to edit or create folders.
            </p>

            <div className="flex justify-end gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Logout
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
};