import { API_BASE } from "@/lib/api-config";
import { clearAuthSession, getAuthToken } from "@/lib/auth";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const headers = new Headers(init.headers || {});
    const token = getAuthToken();
    const isAuthRoute = normalizedPath.startsWith("/auth/");

    if (!headers.has("X-Request-Id") && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        headers.set("X-Request-Id", crypto.randomUUID());
    }

    if (token) {
        if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    } else if (typeof window !== "undefined" && !isAuthRoute) {
        clearAuthSession();
        if (!window.location.pathname.startsWith("/signin") && !window.location.pathname.startsWith("/signup")) {
            window.location.href = "/signin";
        }
        return new Response(
            JSON.stringify({ detail: "Session expired. Please sign in again." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE}${normalizedPath}`, {
            ...init,
            headers,
        });
    } catch (error) {
        const detail =
            error instanceof TypeError
                ? "Cannot reach the API server. Start the backend on port 8000, then try again."
                : "Network error while contacting the API server.";
        return new Response(JSON.stringify({ detail }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (response.status === 401 && typeof window !== "undefined" && !isAuthRoute) {
        clearAuthSession();
        if (!window.location.pathname.startsWith("/signin") && !window.location.pathname.startsWith("/signup")) {
            window.location.href = "/signin";
        }
    }

    return response;
}
