/**
 * Typed API / client errors so pages can tell expected failures from real bugs.
 *
 * Expected: HTTP 4xx from our API (validation, 404, 409, archived folder, bad backup, …)
 * Unexpected: network down, 5xx, JSON parse surprises, unknown throws
 */

export class ApiError extends Error {
  readonly status: number;
  /** Raw FastAPI `detail` when available */
  readonly detail: unknown;
  /** True for intentional client/API outcomes (toast only, no console.error). */
  readonly expected: boolean;

  constructor(
    message: string,
    options: {
      status: number;
      detail?: unknown;
      expected?: boolean;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.detail = options.detail;
    this.expected =
      options.expected ?? (options.status >= 400 && options.status < 500);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "AbortError"
  );
}

/** Expected user/API outcomes — toast OK, do not log as bugs. */
export function isExpectedError(error: unknown): boolean {
  if (isAbortError(error)) return true;
  if (isApiError(error)) return error.expected;
  return false;
}

/** Parse FastAPI `detail` (string | validation array | object) into a user-facing string. */
export function formatApiErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : typeof item === "string"
            ? item
            : null
      )
      .filter((part): part is string => Boolean(part && part.trim()));
    if (parts.length > 0) return parts.join("; ");
  }
  if (detail && typeof detail === "object" && "msg" in detail) {
    const msg = String((detail as { msg: unknown }).msg || "").trim();
    if (msg) return msg;
  }
  return fallback;
}

/**
 * fetch wrapper: network failures become unexpected ApiError (status 0).
 * AbortError is rethrown unchanged.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(
      "Unable to reach the server. Check that the API is running and try again.",
      { status: 0, detail: err, expected: false }
    );
  }
}

/** Throw ApiError with backend detail when present; 4xx = expected, 5xx = unexpected. */
export async function throwIfNotOk(
  res: Response,
  fallback: string
): Promise<void> {
  if (res.ok) return;

  let payload: { detail?: unknown } = {};
  try {
    payload = await res.json();
  } catch {
    // non-JSON body — still an HTTP failure with status
  }

  const message = formatApiErrorDetail(payload.detail, fallback);
  throw new ApiError(message, {
    status: res.status,
    detail: payload.detail,
    expected: res.status >= 400 && res.status < 500,
  });
}
