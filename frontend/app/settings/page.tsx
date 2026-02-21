"use client";

import { useEffect, useState } from "react";
import { Bell, Building, RotateCcw, Save, User } from "lucide-react";

import {
    applyThemePreference,
    DEFAULT_SETTINGS,
    type ThemePreference,
    type UserSettings,
} from "@/lib/user-settings";
import { apiFetch } from "@/lib/api-client";

type SettingsTab = "general" | "profile" | "notifications" | "localization";

function Toggle({
    enabled,
    onChange,
}: {
    enabled: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!enabled)}
            className={`w-12 h-6 rounded-full relative transition-colors ${enabled ? "bg-primary" : "bg-secondary"}`}
        >
            <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${enabled ? "right-1" : "left-1"
                    }`}
            />
        </button>
    );
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await apiFetch("/workspace/settings");
                if (!response.ok) throw new Error("Failed to load settings.");
                const payload = await response.json();
                setSettings({ ...DEFAULT_SETTINGS, ...payload });
            } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to load settings.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        applyThemePreference(settings.theme);
    }, [settings.theme]);

    const updateSettings = (patch: Partial<UserSettings>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
    };

    const save = async () => {
        setError(null);
        const subdomain = settings.subdomain.trim().toLowerCase();
        if (!/^[a-z0-9-]{2,40}$/.test(subdomain)) {
            setError("Subdomain must be 2-40 chars and use only lowercase letters, numbers, and hyphens.");
            return;
        }
        if (settings.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        const normalized: UserSettings = {
            ...settings,
            workspace_name: settings.workspace_name.trim(),
            subdomain,
            display_name: settings.display_name.trim(),
            email: settings.email.trim().toLowerCase(),
            fiscal_year_start_month: Math.min(12, Math.max(1, Number(settings.fiscal_year_start_month) || 1)),
        };
        setSettings(normalized);
        try {
            const response = await apiFetch("/workspace/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(normalized),
            });
            if (!response.ok) throw new Error("Failed to save settings.");
            applyThemePreference(normalized.theme);
            setSavedAt(new Date().toLocaleString());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save settings.");
        }
    };

    const resetDefaults = async () => {
        if (!window.confirm("Reset all settings to defaults?")) return;
        setSettings(DEFAULT_SETTINGS);
        try {
            const response = await apiFetch("/workspace/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(DEFAULT_SETTINGS),
            });
            if (!response.ok) throw new Error("Failed to reset settings.");
            applyThemePreference(DEFAULT_SETTINGS.theme);
            setSavedAt(new Date().toLocaleString());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to reset settings.");
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your workspace preferences.</p>
            </div>
            {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}
            {loading && <p className="text-sm text-muted-foreground">Loading settings...</p>}

            <div className="grid grid-cols-12 gap-8">
                {/* Settings Sidebar */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${activeTab === "general" ? "bg-secondary" : "hover:bg-secondary/50 text-muted-foreground"
                            }`}
                    >
                        <Building className="w-4 h-4" />
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${activeTab === "profile" ? "bg-secondary" : "hover:bg-secondary/50 text-muted-foreground"
                            }`}
                    >
                        <User className="w-4 h-4" />
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab("notifications")}
                        className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${activeTab === "notifications" ? "bg-secondary" : "hover:bg-secondary/50 text-muted-foreground"
                            }`}
                    >
                        <Bell className="w-4 h-4" />
                        Notifications
                    </button>
                    <button
                        onClick={() => setActiveTab("localization")}
                        className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${activeTab === "localization" ? "bg-secondary" : "hover:bg-secondary/50 text-muted-foreground"
                            }`}
                    >
                        <Building className="w-4 h-4" />
                        Localization
                    </button>
                </div>

                {/* Settings Form */}
                <div className="col-span-12 md:col-span-9 space-y-6">
                    {activeTab === "general" && (
                        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                            <h3 className="font-semibold text-lg mb-4">Workspace Settings</h3>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Workspace Name</label>
                                    <input
                                        type="text"
                                        value={settings.workspace_name}
                                        onChange={(e) => updateSettings({ workspace_name: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Subdomain</label>
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={settings.subdomain}
                                            onChange={(e) => updateSettings({ subdomain: e.target.value })}
                                            className="w-full bg-background border border-border rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <div className="bg-secondary border border-l-0 border-border rounded-r-lg px-3 py-2 text-sm text-muted-foreground">
                                            .smartspreadsheet.app
                                        </div>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Theme</label>
                                    <select
                                        value={settings.theme}
                                        onChange={(e) => updateSettings({ theme: e.target.value as ThemePreference })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="system">System</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "profile" && (
                        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                            <h3 className="font-semibold text-lg mb-4">Profile</h3>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Display Name</label>
                                    <input
                                        type="text"
                                        value={settings.display_name}
                                        onChange={(e) => updateSettings({ display_name: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <input
                                        type="email"
                                        value={settings.email}
                                        onChange={(e) => updateSettings({ email: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "notifications" && (
                        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm space-y-4">
                            <h3 className="font-semibold text-lg mb-1">Notifications</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-sm">Email Summary Notifications</p>
                                    <p className="text-sm text-muted-foreground">Weekly summary of dataset activity.</p>
                                </div>
                                <Toggle
                                    enabled={settings.notifications_email}
                                    onChange={(next) => updateSettings({ notifications_email: next })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-sm">Product Update Alerts</p>
                                    <p className="text-sm text-muted-foreground">Announcements for new AI features.</p>
                                </div>
                                <Toggle
                                    enabled={settings.notifications_product}
                                    onChange={(next) => updateSettings({ notifications_product: next })}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === "localization" && (
                        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm space-y-4">
                            <h3 className="font-semibold text-lg mb-1">Localization & India Mode</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-sm">Enable India Insights Mode</p>
                                    <p className="text-sm text-muted-foreground">Switch dashboards and reports to India-focused defaults.</p>
                                </div>
                                <Toggle
                                    enabled={settings.india_mode_enabled}
                                    onChange={(next) =>
                                        updateSettings({
                                            india_mode_enabled: next,
                                            preferred_currency: next ? "INR" : settings.preferred_currency,
                                            number_format: next ? "indian" : settings.number_format,
                                            fiscal_year_start_month: next ? 4 : settings.fiscal_year_start_month,
                                        })
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Preferred Currency</label>
                                    <select
                                        value={settings.preferred_currency}
                                        onChange={(e) => updateSettings({ preferred_currency: e.target.value as "USD" | "INR" })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="INR">INR</option>
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Number Format</label>
                                    <select
                                        value={settings.number_format}
                                        onChange={(e) => updateSettings({ number_format: e.target.value as "international" | "indian" })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="international">International (1,234,567)</option>
                                        <option value="indian">Indian (12,34,567)</option>
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Fiscal Year Start Month</label>
                                    <select
                                        value={String(settings.fiscal_year_start_month)}
                                        onChange={(e) => updateSettings({ fiscal_year_start_month: Number(e.target.value) })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="1">January</option>
                                        <option value="4">April (India FY)</option>
                                        <option value="7">July</option>
                                        <option value="10">October</option>
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Default Report Language</label>
                                    <select
                                        value={settings.report_language}
                                        onChange={(e) =>
                                            updateSettings({ report_language: e.target.value as "english" | "hindi" | "hinglish" })
                                        }
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="english">English</option>
                                        <option value="hindi">Hindi (Romanized)</option>
                                        <option value="hinglish">Hinglish</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4">
                        <p className="text-xs text-muted-foreground">{savedAt ? `Last saved: ${savedAt}` : "Changes not saved yet."}</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={resetDefaults}
                                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>
                            <button
                                onClick={save}
                                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
                            >
                            <Save className="w-4 h-4" />
                            Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
