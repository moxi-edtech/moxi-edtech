import { NextResponse } from "next/server";

function resolveBaseUrl(req: Request): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const host = (req.headers.get("host") || "").replace(/\/$/, "");
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

/**
 * Best-effort forward to a canonical endpoint. If the upstream fails, returns null so the caller can fallback.
 */
export async function tryCanonicalFetch(
  req: Request,
  canonicalPath: string,
  init?: RequestInit
): Promise<NextResponse | null> {
  try {
    const base = resolveBaseUrl(req);
    const url = `${base}${canonicalPath}`;
    const res = await fetch(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.clone().arrayBuffer(),
      redirect: "manual",
      ...init,
    });
    // Accept 2xx only; otherwise let caller fallback
    if (res.ok) {
      const body = await res.arrayBuffer();
      const headers = new Headers(res.headers);
      return new NextResponse(body, { status: res.status, headers });
    }
  } catch {}
  return null;
}

