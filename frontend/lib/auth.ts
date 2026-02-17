export interface AuthUser {
    id: number;
    tenant_id: number;
    email: string;
    full_name: string | null;
    is_active: boolean;
    role: string;
}

const AUTH_TOKEN_KEY = "smartsheet_access_token";
const AUTH_USER_KEY = "smartsheet_auth_user";

function canUseStorage(): boolean {
    return typeof window !== "undefined";
}

export function getAuthToken(): string | null {
    if (!canUseStorage()) return null;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token && token.trim() ? token : null;
}

export function getAuthUser(): AuthUser | null {
    if (!canUseStorage()) return null;
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthUser;
    } catch {
        return null;
    }
}

export function setAuthSession(token: string, user: AuthUser): void {
    if (!canUseStorage()) return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuthSession(): void {
    if (!canUseStorage()) return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    window.dispatchEvent(new Event("auth-changed"));
}

export function getUserInitials(user: AuthUser | null): string {
    if (!user) return "NA";
    const base = (user.full_name || user.email || "").trim();
    if (!base) return "NA";
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
