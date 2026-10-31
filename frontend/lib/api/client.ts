// Thin fetch wrapper: one base URL, typed JSON, structured errors.

/**
 * By default the browser calls this site's own `/api/f1` proxy (CDN-cached on
 * Vercel). Set NEXT_PUBLIC_API_URL to call a backend directly instead.
 */
const DIRECT = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
export const API_BASE_URL = DIRECT ? `${DIRECT}/api/v1` : "/api/f1";

export class ApiError extends Error {
  status: number;
  code: string;
  hint: string | null;

  constructor(status: number, code: string, message: string, hint: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

export function buildUrl(path: string, params?: Params): string {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

/** Errors worth retrying: the API is asleep, restarting or still downloading a session. */
export function isTransient(error: unknown): boolean {
  return error instanceof ApiError && [0, 502, 503, 504].includes(error.status) && error.code !== "data_unavailable";
}

export async function apiGet<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(
      0,
      "network",
      "Can't reach the telemetry API.",
      typeof navigator !== "undefined" && !navigator.onLine
        ? "You're offline. Sessions you've already opened still work."
        : "Check your connection or try again in a moment.",
    );
  }

  if (!response.ok) {
    let code = "http_error";
    let message = `Request failed with status ${response.status}.`;
    let hint: string | null = null;
    try {
      const body = await response.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        hint = body.error.hint ?? null;
      } else if (Array.isArray(body?.detail)) {
        code = "invalid_parameter";
        message = body.detail.map((d: { msg: string }) => d.msg).join("; ");
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, code, message, hint);
  }

  return (await response.json()) as T;
}
