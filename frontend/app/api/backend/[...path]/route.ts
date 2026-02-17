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
    // In production, most requests should arrive with a user JWT from the browser.
    // Keep the dev fallback for local workflows that use the legacy MVP API token.
    if (process.env.NODE_ENV !== "production") return "dev-insecure-token";
    return "";
}

function buildTargetUrl(path: string[], search: string): string {
    const safeBase = BACKEND_BASE_URL.replace(/\/+$/, "");
    const safePath = path.join("/");
    return `${safeBase}/${safePath}${search}`;
}

function allowsAnonymous(path: string[]): boolean {
    const joined = path.join("/");
    if (!joined) return true;
    if (joined === "health" || joined === "ready") return true;
    if (joined.startsWith("auth/signin") || joined.startsWith("auth/signup")) return true;
    return false;
}

async function proxyRequest(req: NextRequest, path: string[]): Promise<NextResponse> {
    const targetUrl = buildTargetUrl(path, req.nextUrl.search);
    const headers = new Headers();

    req.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    const hasIncomingAuth = headers.has("authorization");
    if (!hasIncomingAuth) {
        // Allow unauthenticated proxying for open endpoints (signup/signin/health/ready).
        if (!allowsAnonymous(path)) {
            const authToken = resolveAuthToken();
            if (authToken) {
                headers.set("Authorization", `Bearer ${authToken}`);
                if (!headers.has("X-Tenant-Id")) headers.set("X-Tenant-Id", BACKEND_TENANT_ID);
                if (!headers.has("X-User-Id")) headers.set("X-User-Id", BACKEND_USER_ID);
            }
        }
    } else {
        headers.delete("x-tenant-id");
        headers.delete("x-user-id");
    }

    const method = req.method.toUpperCase();
    const requestInit: RequestInit & { duplex?: "half" } = {
        method,
        headers,
        cache: "no-store",
    };

    if (!["GET", "HEAD"].includes(method)) {
        // Forward the original stream for non-GET requests.
        // Node fetch requires duplex mode for streamed request bodies.
        if (req.body) {
            requestInit.body = req.body;
            requestInit.duplex = "half";
        }
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
