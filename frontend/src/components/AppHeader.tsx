"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchBar from "@/src/components/SearchBar";
import HeaderActions from "@/src/components/HeaderActions";
import { shouldShowGlobalSearch } from "@/src/lib/headerNav";

export default function AppHeader() {
  const pathname = usePathname();
  const showGlobalSearch = shouldShowGlobalSearch(pathname);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="shrink-0 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">UM</span>
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight hidden sm:block">
            UniMe Catalog
          </span>
        </Link>

        <div className="flex-1 max-w-xl flex justify-center min-h-9">
          {showGlobalSearch ? (
            <Suspense
              fallback={
                <div className="w-full max-w-md h-9 rounded-full bg-gray-100 border border-gray-200" />
              }
            >
              <SearchBar />
            </Suspense>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
