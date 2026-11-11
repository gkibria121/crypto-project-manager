import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const apiUrl = (process.env.API_INTERNAL_URL || "http://localhost:4000").replace(
    /\/$/,
    ""
  );
  const requestId = request.headers.get("x-request-id") ?? undefined;

  try {
    const res = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
      headers: requestId ? { "x-request-id": requestId } : undefined,
      signal: AbortSignal.timeout(3000),
    });
    const upstream = await res.json().catch(() => null);
    return NextResponse.json(
      {
        status: res.ok ? "ok" : "degraded",
        frontend: "up",
        upstream,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        frontend: "up",
        upstream: null,
      },
      { status: 200 }
    );
  }
}
