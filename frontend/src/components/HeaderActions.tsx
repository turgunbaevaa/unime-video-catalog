"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

function UserMenu({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline max-w-[8rem] truncate">{displayName}</span>
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/" });
            }}
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-gray-50 cursor-pointer"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function HeaderActions() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isLoggedIn = Boolean(session);
  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    "Admin";

  return (
    <div className="flex items-center gap-2">
      {isLoggedIn ? (
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Link>

          <UserMenu displayName={displayName} />
        </>
      ) : status === "loading" ? (
        <div
          className="h-8 w-16 rounded-lg bg-gray-100 border border-gray-200 animate-pulse"
          aria-hidden
        />
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
