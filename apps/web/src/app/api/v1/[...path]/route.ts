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

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
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
