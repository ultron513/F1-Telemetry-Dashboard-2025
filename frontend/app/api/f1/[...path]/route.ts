import type { NextRequest } from "next/server";

/**
 * Same-origin proxy to the Pit Wall API.
 *
 * - The browser only ever talks to this site, so there is no CORS and the
 *   backend address stays private.
 * - The API's Cache-Control (s-maxage) is passed through, so on Vercel the
 *   response is cached on the CDN edge nearest each visitor: a finished
 *   session is computed once and then served globally in milliseconds.
 */

export const maxDuration = 60;

const ORIGIN = (process.env.PITWALL_API_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "");
const TIMEOUT_MS = 55_000;

function errorResponse(status: number, code: string, message: string, hint: string) {
  return Response.json(
    { error: { code, message, hint } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length || path.some((p) => p === ".." || p.includes("/"))) {
    return errorResponse(400, "bad_request", "Invalid API path.", "");
  }
  const target = `${ORIGIN}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    return timedOut
      ? errorResponse(
          504,
          "warming_up",
          "The data server is still preparing this session.",
          "The first visit to a session downloads it from the F1 archive and can take up to a minute. Retrying automatically.",
        )
      : errorResponse(
          502,
          "upstream_unreachable",
          "The data server is waking up.",
          "It sleeps when nobody has used it for a while and takes about a minute to start. Retrying automatically.",
        );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // A sleeping or rebuilding host answers with an HTML holding page.
    return errorResponse(
      502,
      "upstream_unreachable",
      "The data server is waking up.",
      "It sleeps when nobody has used it for a while and takes about a minute to start. Retrying automatically.",
    );
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  });
  const cacheControl = upstream.headers.get("cache-control");
  headers.set("Cache-Control", upstream.ok && cacheControl ? cacheControl : "no-store");
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
}
