"use client";

import { useEffect, useState } from "react";
import { Bell, Building, RotateCcw, Save, User } from "lucide-react";

import {
    applyThemePreference,
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    type ThemePreference,
    type UserSettings,
} from "@/lib/user-settings";

type SettingsTab = "general" | "profile" | "notifications";

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
    const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        applyThemePreference(settings.theme);
    }, [settings.theme]);

    const updateSettings = (patch: Partial<UserSettings>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
    };

    const save = () => {
        setError(null);
        const subdomain = settings.subdomain.trim().toLowerCase();
        if (!/^[a-z0-9-]{2,40}$/.test(subdomain)) {
            setError("Subdomain must be 2-40 chars and use only lowercase letters, numbers, and hyphens.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        const normalized: UserSettings = {
            ...settings,
            workspace_name: settings.workspace_name.trim(),
            subdomain,
            display_name: settings.display_name.trim(),
            email: settings.email.trim().toLowerCase(),
        };
        setSettings(normalized);
        saveSettings(normalized);
        applyThemePreference(normalized.theme);
        setSavedAt(new Date().toLocaleString());
    };

    const resetDefaults = () => {
        if (!window.confirm("Reset all settings to defaults?")) return;
        setSettings(DEFAULT_SETTINGS);
        saveSettings(DEFAULT_SETTINGS);
        applyThemePreference(DEFAULT_SETTINGS.theme);
        setSavedAt(new Date().toLocaleString());
        setError(null);
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
