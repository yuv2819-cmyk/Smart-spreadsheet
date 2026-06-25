import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RAW_BACKEND_BASE_URL = (process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000").trim();

function normalizeBackendBaseUrl(raw: string): string {
    const trimmed = (raw || "").trim();
    // In production, always prefer HTTPS. If someone accidentally sets an http:// backend URL,
    // Next's fetch will follow a 307/308 redirect for GETs, but POSTs can fail because the body
    // stream can't be resent. Auto-upgrading avoids that class of failures.
    if (process.env.NODE_ENV === "production" && /^http:\/\//i.test(trimmed)) {
        return trimmed.replace(/^http:\/\//i, "https://");
    }
    return trimmed;
}

const BACKEND_BASE_URL = normalizeBackendBaseUrl(RAW_BACKEND_BASE_URL);
const INTERNAL_SERVICE_TOKENS = new Set(
    [process.env.BACKEND_API_TOKEN, process.env.MVP_API_TOKEN]
        .map((value) => (value || "").trim())
        .filter(Boolean)
);

const HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "expect",
    "proxy-connection",
    "host",
    "content-length",
    "content-encoding",
    "accept-encoding",
]);

function buildTargetUrl(path: string[], search: string): string {
    const safeBase = BACKEND_BASE_URL.replace(/\/+$/, "");
    const safePath = path.join("/");
    return `${safeBase}/${safePath}${search}`;
}

function getBackendConfigError(): string | null {
    const baseIsDefaultLocal = BACKEND_BASE_URL === "http://127.0.0.1:8000";
    const hasExplicitEnv = Boolean((process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "").trim());
    const looksLikeHttpUrl = /^https?:\/\//i.test(BACKEND_BASE_URL);

    if (process.env.NODE_ENV === "production") {
        if (!hasExplicitEnv || baseIsDefaultLocal) {
            return "Server misconfigured: BACKEND_API_URL is not set. Add BACKEND_API_URL=https://<your-railway-domain> in Vercel and redeploy.";
        }
        if (!looksLikeHttpUrl) {
            return "Server misconfigured: BACKEND_API_URL must start with http:// or https://";
        }
    }

    if (!looksLikeHttpUrl) {
        return `Invalid BACKEND_API_URL: ${BACKEND_BASE_URL}`;
    }

    return null;
}

function allowsAnonymous(path: string[]): boolean {
    const joined = path.join("/");
    if (!joined) return true;
    if (joined === "health" || joined === "ready") return true;
    if (joined.startsWith("auth/signin") || joined.startsWith("auth/signup")) return true;
    if (joined.startsWith("reports/public/")) return true;
    return false;
}

function extractBearerToken(headers: Headers): string {
    const rawAuthorization = (headers.get("authorization") || "").trim();
    if (!rawAuthorization) return "";
    const [scheme, ...rest] = rawAuthorization.split(/\s+/);
    if (!scheme || scheme.toLowerCase() !== "bearer" || rest.length === 0) return "";
    return rest.join(" ").trim();
}

async function proxyRequest(req: NextRequest, path: string[]): Promise<NextResponse> {
    const configError = getBackendConfigError();
    if (configError) {
        return NextResponse.json({ detail: configError }, { status: 500 });
    }

    const targetUrl = buildTargetUrl(path, req.nextUrl.search);
    const headers = new Headers();

    req.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    // Browser traffic must never control backend tenant/user impersonation headers.
    headers.delete("x-tenant-id");
    headers.delete("x-user-id");
    headers.delete("x-internal-service-request");

    if (!allowsAnonymous(path)) {
        const browserToken = extractBearerToken(headers);
        if (!browserToken) {
            return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
        }
        if (INTERNAL_SERVICE_TOKENS.has(browserToken)) {
            return NextResponse.json(
                { detail: "Browser requests must use a user access token." },
                { status: 401 }
            );
        }
    }

    const method = req.method.toUpperCase();
    const requestInit: RequestInit = {
        method,
        headers,
        cache: "no-store",
        redirect: "manual",
    };

    let bodyBuffer: ArrayBuffer | undefined;
    if (!["GET", "HEAD"].includes(method)) {
        // Materialize request body so we can safely replay it on one-hop redirects
        // (e.g. FastAPI /reports -> /reports/) without stream reuse errors.
        bodyBuffer = await req.arrayBuffer();
        if (bodyBuffer.byteLength > 0) {
            requestInit.body = bodyBuffer;
        }
    }

    let upstreamResponse: Response;
    try {
        upstreamResponse = await fetch(targetUrl, requestInit);
        if (
            [301, 302, 303, 307, 308].includes(upstreamResponse.status) &&
            upstreamResponse.headers.has("location")
        ) {
            const location = upstreamResponse.headers.get("location") || "";
            const redirectUrl = new URL(location, targetUrl).toString();

            const retryInit: RequestInit = {
                ...requestInit,
            };

            // Align with standard redirect behavior for 303.
            if (upstreamResponse.status === 303) {
                retryInit.method = "GET";
                delete retryInit.body;
            } else if (!["GET", "HEAD"].includes(method) && bodyBuffer && bodyBuffer.byteLength > 0) {
                retryInit.body = bodyBuffer;
            }

            upstreamResponse = await fetch(redirectUrl, retryInit);
        }
    } catch (error) {
        const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
        const causeText =
            cause instanceof Error ? cause.message : cause !== undefined ? String(cause) : "";
        const baseMessage = error instanceof Error ? error.message : String(error);
        const combinedMessage = causeText ? `${baseMessage} (cause: ${causeText})` : baseMessage;
        const detail =
            process.env.NODE_ENV === "production"
                ? "Unable to reach backend API"
                : `Unable to reach backend API: ${combinedMessage}`;
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
