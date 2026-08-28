/** Parse a page query param; invalid or out-of-range values fall back to 1. */
export function parsePage(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

/** Build page number items with ellipsis for numbered pagination. */
export function getPaginationRange(
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const left = Math.max(2, currentPage - 2);
  const right = Math.min(totalPages - 1, currentPage + 2);

  if (left > 2) pages.push("ellipsis");

  for (let page = left; page <= right; page += 1) {
    pages.push(page);
  }

  if (right < totalPages - 1) pages.push("ellipsis");

  pages.push(totalPages);
  return pages;
}
