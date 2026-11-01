// Thin fetch wrapper: one base URL, typed JSON, structured errors.

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

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
  const url = new URL(`${API_BASE_URL}/api/v1${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
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
      `Check that the backend is running at ${API_BASE_URL}.`,
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

/** POST JSON (operations endpoints); errors use the same structure as GET. */
export async function apiPost<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the telemetry API.", `Check that the backend is running at ${API_BASE_URL}.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error;
    const detail = Array.isArray(data?.detail) ? data.detail.map((d: { msg: string }) => d.msg).join("; ") : null;
    throw new ApiError(response.status, err?.code ?? "http_error", err?.message ?? detail ?? `Request failed with status ${response.status}.`, err?.hint ?? null);
  }
  return data as T;
}
