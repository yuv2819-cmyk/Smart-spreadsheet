import { API_BASE } from "@/lib/api-config";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const headers = new Headers(init.headers || {});

    return fetch(`${API_BASE}${normalizedPath}`, {
        ...init,
        headers,
    });
}
