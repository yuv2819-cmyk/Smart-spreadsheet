export type ThemePreference = "system" | "light" | "dark";

export interface UserSettings {
    workspace_name: string;
    subdomain: string;
    display_name: string;
    email: string;
    theme: ThemePreference;
    notifications_email: boolean;
    notifications_product: boolean;
}

export const SETTINGS_STORAGE_KEY = "smartsheet_settings_v1";

export const DEFAULT_SETTINGS: UserSettings = {
    workspace_name: "My Workspace",
    subdomain: "demo",
    display_name: "John Doe",
    email: "john@example.com",
    theme: "system",
    notifications_email: true,
    notifications_product: true,
};

export function loadSettings(): UserSettings {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: UserSettings): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function applyThemePreference(theme: ThemePreference): void {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (theme === "system") {
        root.removeAttribute("data-theme");
        return;
    }
    root.setAttribute("data-theme", theme);
}
