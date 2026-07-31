"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import {
  API_BASE,
  downloadDatabaseBackup,
  restoreDatabaseBackup,
} from "@/src/lib/api";

export default function ToolsPage() {
  const { data: session, status } = useSession();

  const [file, setFile] = useState<File | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  if (status === "loading") {
    return <div className="text-center py-20 text-gray-500">Verifying access...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">403 Forbidden</h1>
        <p className="text-gray-500 mb-6">You must be an administrator to access this page.</p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      await downloadDatabaseBackup();
      setMessage({
        text: "Database backup downloaded successfully (folders + videos).",
        type: "success",
      });
    } catch (error) {
      console.error(error);
      setMessage({
        text: error instanceof Error ? error.message : "Failed to export database backup.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async () => {
    if (!file) return;

    setIsRestoring(true);
    setUploadProgress(0);
    setMessage(null);

    try {
      const data = await restoreDatabaseBackup(file, (percent) => {
        setUploadProgress(percent);
      });
      setMessage({
        text:
          data.message ||
          `Restored ${data.folders_restored} folders and ${data.videos_restored} videos.`,
        type: "success",
      });
      setFile(null);
    } catch (error) {
      console.error(error);
      setMessage({
        text: error instanceof Error ? error.message : "Error during restore.",
        type: "error",
      });
    } finally {
      setIsRestoring(false);
      setUploadProgress(null);
      setIsRestoreModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            System <span className="text-gray-400 font-normal">Tools</span>
          </h1>
          <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            &larr; Back to Catalog
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-bold">
            {session.user?.name?.charAt(0) || "A"}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">
              {session.user?.name || "Administrator"}
            </h2>
            <p className="text-sm text-gray-500">
              Logged in via {session.user?.email || "System Account"}
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`p-4 mb-6 rounded-lg border ${
              message.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Export Database</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Download a complete JSON backup of folders and videos, or export MARCXML for
              library integration.
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isExporting || isRestoring}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? "Preparing backup..." : "Export Database (JSON)"}
              </button>
              <a
                href={`${API_BASE}/export/marcxml`}
                download
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                Export MARCXML
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            <h3 className="text-lg font-semibold text-red-600 mb-2">Import Database</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Upload a `.json` backup file to restore folders and videos.
              <br />
              <strong className="text-red-600 font-semibold">
                Warning: This replaces the current catalog data!
              </strong>
            </p>

            <div className="flex flex-col gap-4">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                disabled={isRestoring}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-colors cursor-pointer border border-gray-200 rounded-lg p-1 disabled:opacity-50"
              />

              {uploadProgress !== null && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Upload progress</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!file || isRestoring || isExporting}
                onClick={() => setIsRestoreModalOpen(true)}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isRestoring ? "Restoring..." : "Import Database"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Are you absolutely sure?</h3>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              You are about to restore the database from a backup file.
              <br />
              <br />
              This action will <strong>replace all existing folders and videos</strong> with the
              contents of your uploaded JSON file. Export a fresh backup first if you might need
              the current data.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? "Restoring..." : "Yes, Restore Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
