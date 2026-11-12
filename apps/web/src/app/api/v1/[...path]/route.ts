import { NextResponse, type NextRequest } from "next/server";

const API_INTERNAL_URL = (
  process.env.API_INTERNAL_URL || "http://localhost:4000"
).replace(/\/$/, "");

async function proxyToCoreApi(
  request: NextRequest,
  context: RouteContext<"/api/v1/[...path]">
) {
  const { path } = await context.params;
  const targetPath = path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = `${API_INTERNAL_URL}/api/v1/${targetPath}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }
  const requestId = request.headers.get("x-request-id");
  if (requestId) {
    headers.set("x-request-id", requestId);
  }
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }
  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    headers.set("user-agent", userAgent);
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const isScrapeAction =
    targetPath.endsWith("/scrape") || targetPath.endsWith("/scrape-all");
  const isChatCompletion = targetPath.endsWith("/chat/messages");
  const requestTimeoutMs = isScrapeAction
    ? 240_000
    : isChatCompletion
      ? 90_000
      : 30_000;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    const responseText = await upstreamResponse.text();
    const responseHeaders = new Headers();
    const upstreamContentType = upstreamResponse.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }
    const upstreamRequestId = upstreamResponse.headers.get("x-request-id");
    if (upstreamRequestId) {
      responseHeaders.set("x-request-id", upstreamRequestId);
    }
    const setCookies =
      typeof upstreamResponse.headers.getSetCookie === "function"
        ? upstreamResponse.headers.getSetCookie()
        : [];
    if (setCookies.length > 0) {
      for (const cookieHeader of setCookies) {
        responseHeaders.append("set-cookie", cookieHeader);
      }
    } else {
      const singleSetCookie = upstreamResponse.headers.get("set-cookie");
      if (singleSetCookie) {
        responseHeaders.set("set-cookie", singleSetCookie);
      }
    }
    const clearSiteData = upstreamResponse.headers.get("clear-site-data");
    if (clearSiteData) {
      responseHeaders.set("clear-site-data", clearSiteData);
    }
    responseHeaders.set("x-content-type-options", "nosniff");
    responseHeaders.set("x-frame-options", "DENY");
    responseHeaders.set("referrer-policy", "strict-origin-when-cross-origin");

    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach Core API";
    return NextResponse.json(
      {
        statusCode: 502,
        message: `Core API microservice is unreachable: ${message}`,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/v1/[...path]">
) {
  return proxyToCoreApi(request, context);
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/v1/[...path]">
) {
  return proxyToCoreApi(request, context);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/v1/[...path]">
) {
  return proxyToCoreApi(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/v1/[...path]">
) {
  return proxyToCoreApi(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/v1/[...path]">
) {
  return proxyToCoreApi(request, context);
}
