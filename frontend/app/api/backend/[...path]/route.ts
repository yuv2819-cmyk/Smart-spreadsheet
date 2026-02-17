import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_BASE_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").trim();
const BACKEND_API_TOKEN = (process.env.BACKEND_API_TOKEN || process.env.MVP_API_TOKEN || "").trim();
const BACKEND_TENANT_ID = (process.env.BACKEND_TENANT_ID || "1").trim();
const BACKEND_USER_ID = (process.env.BACKEND_USER_ID || "1").trim();

const HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
    "content-encoding",
    "accept-encoding",
]);

function resolveAuthToken(): string {
    if (BACKEND_API_TOKEN) return BACKEND_API_TOKEN;
    if (process.env.NODE_ENV === "production") {
        throw new Error("BACKEND_API_TOKEN is required in production");
    }
    return "dev-insecure-token";
}

function buildTargetUrl(path: string[], search: string): string {
    const safeBase = BACKEND_BASE_URL.replace(/\/+$/, "");
    const safePath = path.join("/");
    return `${safeBase}/${safePath}${search}`;
}

async function proxyRequest(req: NextRequest, path: string[]): Promise<NextResponse> {
    let authToken = "";
    try {
        authToken = resolveAuthToken();
    } catch (error) {
        return NextResponse.json(
            { detail: error instanceof Error ? error.message : "Backend proxy not configured" },
            { status: 500 }
        );
    }

    const targetUrl = buildTargetUrl(path, req.nextUrl.search);
    const headers = new Headers();

    req.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    headers.set("Authorization", `Bearer ${authToken}`);
    headers.set("X-Tenant-Id", BACKEND_TENANT_ID);
    headers.set("X-User-Id", BACKEND_USER_ID);

    const method = req.method.toUpperCase();
    const requestInit: RequestInit = {
        method,
        headers,
        cache: "no-store",
    };

    if (!["GET", "HEAD"].includes(method)) {
        requestInit.body = await req.arrayBuffer();
    }

    let upstreamResponse: Response;
    try {
        upstreamResponse = await fetch(targetUrl, requestInit);
    } catch (error) {
        const detail =
            process.env.NODE_ENV === "production"
                ? "Unable to reach backend API"
                : `Unable to reach backend API: ${error instanceof Error ? error.message : String(error)}`;
        return NextResponse.json({ detail }, { status: 502 });
    }

    const responseBody = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            responseHeaders.set(key, value);
        }
    });

    return new NextResponse(responseBody, {
        status: upstreamResponse.status,
        headers: responseHeaders,
    });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxyRequest(req, path);
}

export async function OPTIONS(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxyRequest(req, path);
}
