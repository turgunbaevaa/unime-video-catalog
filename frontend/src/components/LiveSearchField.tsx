"use client";

import { SEARCH_QUERY_MAX_LENGTH } from "@/src/lib/api";

type LiveSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  isSearching?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export default function LiveSearchField({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  isSearching = false,
  disabled = false,
  id,
  className = "",
}: LiveSearchFieldProps) {
  return (
    <div className={`relative flex-1 min-w-0 ${className}`}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        {isSearching ? (
          <svg
            className="h-4 w-4 animate-spin text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        )}
      </div>

      <input
        id={id}
        type="search"
        value={value}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value && onClear) {
            e.preventDefault();
            onClear();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 pl-9 pr-9 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none bg-white disabled:opacity-50"
      />

      {value ? (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || !onClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-50"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
