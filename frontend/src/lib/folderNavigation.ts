export type FolderContext = {
  page?: number;
  q?: string;
  sort?: string;
};

/** Build the folder list URL from list context (page, search, sort). */
export function buildFolderListHref(folderId: string, context: FolderContext): string {
  const params = new URLSearchParams();
  const page = context.page ?? 1;
  const sort = context.sort ?? "created_at_desc";
  const q = context.q?.trim() ?? "";

  if (page > 1) params.set("page", String(page));
  if (sort && sort !== "created_at_desc") params.set("sort", sort);
  if (q) params.set("q", q);

  const qs = params.toString();
  return qs ? `/folders/${folderId}?${qs}` : `/folders/${folderId}`;
}

/** Link from a folder listing to a video detail page, preserving full list URL. */
export function buildFolderVideoHref(videoId: string, folderListHref: string): string {
  const params = new URLSearchParams({ from: folderListHref });
  return `/videos/${videoId}?${params.toString()}`;
}

/** Link to edit a video while preserving folder list context. */
export function buildFolderEditHref(videoId: string, folderListHref: string): string {
  const params = new URLSearchParams({ from: folderListHref });
  return `/videos/${videoId}/edit?${params.toString()}`;
}

/** Resolve the folder list URL to return to from video detail/edit pages. */
export function resolveFolderReturnHref(
  folderId: string,
  fromParam: string | null,
  fallback: FolderContext
): string {
  if (fromParam && fromParam.startsWith(`/folders/${folderId}`)) {
    return fromParam;
  }
  return buildFolderListHref(folderId, fallback);
}
