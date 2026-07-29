"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Убедитесь, что порт совпадает с вашим бэкендом (FastAPI)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ToolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Защита страницы: если сессия загружается или пользователя нет
  if (status === "loading") {
    return <div className="text-center py-20 text-gray-500">Verifying access...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">403 Forbidden</h1>
        <p className="text-gray-500 mb-6">You must be an administrator to access this page.</p>
        <Link href="/" className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
          Return to Home
        </Link>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleRestore = async () => {
    if (!file) return;

    setIsLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/export/restore`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to restore database");
      }

      const data = await response.json();
      setMessage({ text: data.message || "Database successfully restored!", type: "success" });
      setFile(null); // Очищаем файл после успеха
    } catch (error) {
      setMessage({ text: "Error during restore. Check console for details.", type: "error" });
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRestoreModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      {/* Header (Simplified) */}
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
        
        {/* Инфо профиля администратора */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-bold">
            {session.user?.name?.charAt(0) || "A"}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{session.user?.name || "Administrator"}</h2>
            <p className="text-sm text-gray-500">Logged in via {session.user?.email || "System Account"}</p>
          </div>
        </div>

        {/* Уведомления */}
        {message && (
          <div className={`p-4 mb-6 rounded-lg border ${message.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Блок 1: Экспорт */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Export Data</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Download the database either as a complete JSON backup for restoration, or as a MARCXML file for library integration.
            </p>
            
            <div className="flex flex-col gap-3">
              <a 
                href={`${API_BASE_URL}/api/v1/export/backup`}
                download
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                Download JSON Backup
              </a>
              <a 
                href={`${API_BASE_URL}/api/v1/export/marcxml`}
                download
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                Export MARCXML
              </a>
            </div>
          </div>

          {/* Блок 2: Импорт/Восстановление (ОПАСНАЯ ЗОНА) */}
          <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone: Restore</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Upload a `.json` backup file to restore the database. <br />
              <strong className="text-red-600 font-semibold">Warning: This will delete all current records!</strong>
            </p>
            
            <div className="flex flex-col gap-4">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-colors cursor-pointer border border-gray-200 rounded-lg p-1"
              />
              <button
                disabled={!file || isLoading}
                onClick={() => setIsRestoreModalOpen(true)}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isLoading ? "Restoring..." : "Restore Database"}
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* --- МОДАЛКА ПОДТВЕРЖДЕНИЯ ВОССТАНОВЛЕНИЯ --- */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Are you absolutely sure?</h3>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              You are about to restore the database from a backup file. 
              <br /><br />
              This action will <strong>permanently erase all existing videos</strong> and replace them with the data from your uploaded JSON file. Have you downloaded a fresh backup first?
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Yes, Restore Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}