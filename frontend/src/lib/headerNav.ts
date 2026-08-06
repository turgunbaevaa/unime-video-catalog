/**
 * Single source of truth: where the header Global Search is shown.
 * Everywhere else the header stays, but the search field is hidden.
 */
export function shouldShowGlobalSearch(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/search";
}
