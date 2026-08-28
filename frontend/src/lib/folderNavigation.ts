type FolderContext = {
  page?: number;
  q?: string;
};

/** Link from a folder listing to a video detail page, preserving list context. */
export function buildFolderVideoHref(videoId: string, context: FolderContext): string {
  const params = new URLSearchParams();
  const page = context.page ?? 1;

  if (page > 1) params.set("returnPage", String(page));
  if (context.q?.trim()) params.set("returnQuery", context.q.trim());

  const qs = params.toString();
  return qs ? `/videos/${videoId}?${qs}` : `/videos/${videoId}`;
}

/** Back link from video details to the folder the user came from. */
export function buildFolderReturnHref(folderId: string, context: FolderContext): string {
  const params = new URLSearchParams();
  const page = context.page ?? 1;

  if (page > 1) params.set("page", String(page));
  if (context.q?.trim()) params.set("q", context.q.trim());

  const qs = params.toString();
  return qs ? `/folders/${folderId}?${qs}` : `/folders/${folderId}`;
}
