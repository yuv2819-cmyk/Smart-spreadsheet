export type ThemePreference = "system" | "light" | "dark";

export interface UserSettings {
    workspace_name: string;
    subdomain: string;
    display_name: string;
    email: string;
    theme: ThemePreference;
    notifications_email: boolean;
    notifications_product: boolean;
    india_mode_enabled: boolean;
    preferred_currency: "USD" | "INR";
    number_format: "international" | "indian";
    fiscal_year_start_month: number;
    report_language: "english" | "hindi" | "hinglish";
}

export const SETTINGS_STORAGE_KEY = "smartsheet_settings_v1";

export const DEFAULT_SETTINGS: UserSettings = {
    workspace_name: "My Workspace",
    subdomain: "my-workspace",
    display_name: "",
    email: "",
    theme: "system",
    notifications_email: true,
    notifications_product: true,
    india_mode_enabled: false,
    preferred_currency: "USD",
    number_format: "international",
    fiscal_year_start_month: 1,
    report_language: "english",
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
