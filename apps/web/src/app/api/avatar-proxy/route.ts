import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 16 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(["imgdb.io"]);

const isBlockedHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    /^127\./.test(h) ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "::" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(h) ||
    /^fc00:/i.test(h) ||
    /^fd[0-9a-f]{2}:/i.test(h) ||
    /^fe80:/i.test(h) ||
    /^\d+$/.test(h)
  );
};

/** True only for an https URL on an explicitly allowed avatar host. */
const isAllowed = (parsed: URL): boolean =>
  parsed.protocol === "https:" &&
  ALLOWED_HOSTS.has(parsed.hostname.toLowerCase()) &&
  !isBlockedHost(parsed.hostname);

/**
 * Same-origin proxy for user avatar images (imgdb.io) so Canvas 2D can draw
 * them without CORS tainting when exporting PNG/Video. Redirects are followed
 * manually and every hop is re-validated to prevent SSRF.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!isAllowed(parsed)) {
    return NextResponse.json({ error: "Unsupported url" }, { status: 400 });
  }

  try {
    let current = parsed;
    let upstream: Response | null = null;
    for (let hop = 0; hop < 3; hop++) {
      upstream = await fetch(current.toString(), {
        redirect: "manual",
        headers: { Accept: "image/*" },
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("location");
        if (!location) return NextResponse.json({ error: "Bad redirect" }, { status: 502 });
        current = new URL(location, current);
        if (!isAllowed(current))
          return NextResponse.json({ error: "Unsupported redirect" }, { status: 400 });
        continue;
      }
      break;
    }
    if (!upstream || !upstream.ok)
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }
    const declared = Number(upstream.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES)
      return NextResponse.json({ error: "Image too large" }, { status: 413 });

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
