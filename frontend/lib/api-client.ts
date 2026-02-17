import { API_BASE } from "@/lib/api-config";
import { clearAuthSession, getAuthToken } from "@/lib/auth";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const headers = new Headers(init.headers || {});
    const token = getAuthToken();
    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${normalizedPath}`, {
        ...init,
        headers,
    });

    const isAuthRoute = normalizedPath.startsWith("/auth/");
    if (response.status === 401 && typeof window !== "undefined" && !isAuthRoute) {
        clearAuthSession();
        if (!window.location.pathname.startsWith("/signin") && !window.location.pathname.startsWith("/signup")) {
            window.location.href = "/signin";
        }
    }

    return response;
}
