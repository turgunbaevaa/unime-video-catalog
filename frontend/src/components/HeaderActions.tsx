"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function HeaderActions() {
  const { data: session } = useSession();
  const isAdmin = !!session;
  const pathname = usePathname();

  // Если мы находимся на странице конкретной папки или в архиве, 
  // кнопка Add Folder может отличаться, но базовые кнопки хедера держим здесь:
  return (
    <div className="flex items-center gap-2">
      {isAdmin ? (
        <>
          <Link
            href="/videos/archive"
            className={`hidden sm:inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors shadow-sm ${
              pathname === "/videos/archive" 
                ? "bg-slate-900 text-white border-slate-900" 
                : "text-slate-700 bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            Archive
          </Link>
          
          <Link
            href="/tools"
            title="Admin Tools"
            className="p-2 text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </Link>
        </>
      ) : (
        <Link
          href="/login"
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Login
        </Link>
      )}
    </div>
  );
}