import Link from "next/link";
import { getPaginationRange } from "@/src/lib/pagination";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getPageHref: (page: number) => string;
  ariaLabel?: string;
};

const navButtonClass =
  "px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm";
const navButtonDisabledClass =
  "px-4 py-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm";
const pageLinkClass =
  "min-w-[2.25rem] px-3 py-2 text-sm font-medium rounded-lg border transition-colors shadow-sm text-center";
const pageLinkActiveClass = "bg-slate-900 text-white border-slate-900";
const pageLinkInactiveClass =
  "bg-white text-slate-700 border-gray-300 hover:bg-gray-50";

export default function Pagination({
  currentPage,
  totalPages,
  getPageHref,
  ariaLabel = "Pagination",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <nav
      className="flex flex-wrap justify-center items-center gap-2 mt-12 mb-8"
      aria-label={ariaLabel}
    >
      {currentPage > 1 ? (
        <Link href={getPageHref(currentPage - 1)} className={navButtonClass}>
          &lt; Previous
        </Link>
      ) : (
        <button type="button" disabled className={navButtonDisabledClass}>
          &lt; Previous
        </button>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-gray-400 select-none"
              aria-hidden="true"
            >
              ...
            </span>
          ) : page === currentPage ? (
            <span
              key={page}
              aria-current="page"
              className={`${pageLinkClass} ${pageLinkActiveClass}`}
            >
              {page}
            </span>
          ) : (
            <Link
              key={page}
              href={getPageHref(page)}
              className={`${pageLinkClass} ${pageLinkInactiveClass}`}
            >
              {page}
            </Link>
          )
        )}
      </div>

      {currentPage < totalPages ? (
        <Link href={getPageHref(currentPage + 1)} className={navButtonClass}>
          Next &gt;
        </Link>
      ) : (
        <button type="button" disabled className={navButtonDisabledClass}>
          Next &gt;
        </button>
      )}
    </nav>
  );
}
