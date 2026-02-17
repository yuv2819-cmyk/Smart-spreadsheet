"use client";

import { useEffect, useState } from "react";
import { Database, Link2, Loader2, MessageSquare, PlugZap, Unplug, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

type IntegrationId = "google-sheets" | "slack" | "webhook";

interface IntegrationDefinition {
    id: IntegrationId;
    name: string;
    description: string;
    icon: typeof Database;
    color: string;
    placeholder: string;
}

interface IntegrationState {
    connected: boolean;
    config: string;
    last_tested_at: string | null;
    last_test_ok: boolean | null;
    note: string | null;
}

const INTEGRATION_STORAGE_KEY = "smartsheet_integrations_v1";

const integrations: IntegrationDefinition[] = [
    {
        id: "google-sheets",
        name: "Google Sheets",
        description: "Store a sheet URL/ID so your team can track source links in one place.",
        icon: Database,
        color: "text-green-600",
        placeholder: "https://docs.google.com/spreadsheets/d/...",
    },
    {
        id: "slack",
        name: "Slack",
        description: "Save a Slack webhook URL and test alert delivery.",
        icon: MessageSquare,
        color: "text-purple-600",
        placeholder: "https://hooks.slack.com/services/...",
    },
    {
        id: "webhook",
        name: "Webhooks",
        description: "Save a custom webhook endpoint and test payload delivery.",
        icon: Webhook,
        color: "text-blue-600",
        placeholder: "https://example.com/webhook",
    },
];

function loadStates(): Record<IntegrationId, IntegrationState> {
    const defaults: Record<IntegrationId, IntegrationState> = {
        "google-sheets": { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        slack: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        webhook: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
    };

    if (typeof window === "undefined") return defaults;
    try {
        const raw = localStorage.getItem(INTEGRATION_STORAGE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
    } catch {
        return defaults;
    }
}

export default function IntegrationsPage() {
    const [states, setStates] = useState<Record<IntegrationId, IntegrationState>>(loadStates);
    const [activeTest, setActiveTest] = useState<IntegrationId | null>(null);

    useEffect(() => {
        localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(states));
    }, [states]);

    const updateState = (id: IntegrationId, patch: Partial<IntegrationState>) => {
        setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const promptConfig = (integration: IntegrationDefinition): string | null => {
        const existing = states[integration.id]?.config || "";
        const value = window.prompt(`Enter ${integration.name} configuration:`, existing || integration.placeholder);
        if (value === null) return null;
        const trimmed = value.trim();
        if (!trimmed) {
            window.alert("Configuration value cannot be empty.");
            return null;
        }
        return trimmed;
    };

    const isValidHttpUrl = (value: string): boolean => {
        try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    };

    const connectIntegration = (integration: IntegrationDefinition) => {
        const value = promptConfig(integration);
        if (!value) return;

        if (integration.id !== "google-sheets" && !isValidHttpUrl(value)) {
            window.alert("Please provide a valid http(s) URL.");
            return;
        }

        updateState(integration.id, {
            connected: true,
            config: value,
            note: "Connected",
        });
    };

    const disconnectIntegration = (id: IntegrationId) => {
        if (!window.confirm("Disconnect this integration?")) return;
        updateState(id, {
            connected: false,
            config: "",
            note: "Disconnected",
            last_test_ok: null,
            last_tested_at: null,
        });
    };

    const testIntegration = async (integration: IntegrationDefinition) => {
        const state = states[integration.id];
        if (!state.connected || !state.config) return;

        setActiveTest(integration.id);
        try {
            if (integration.id === "google-sheets") {
                const looksValid = state.config.includes("docs.google.com/spreadsheets") || state.config.length >= 12;
                updateState(integration.id, {
                    last_test_ok: looksValid,
                    last_tested_at: new Date().toISOString(),
                    note: looksValid ? "Sheet reference format looks valid." : "Sheet reference looks invalid.",
                });
                return;
            }

            const response = await fetch("/api/integrations/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target_url: state.config,
                    payload: {
                        event: "integration_test",
                        source: "smartsheet",
                        integration: integration.id,
                        timestamp: new Date().toISOString(),
                    },
                }),
            });

            const data = await response.json();
            const ok = Boolean(data?.ok);
            updateState(integration.id, {
                last_test_ok: ok,
                last_tested_at: new Date().toISOString(),
                note: ok ? "Test payload delivered." : String(data?.detail || "Test failed."),
            });
        } catch {
            updateState(integration.id, {
                last_test_ok: false,
                last_tested_at: new Date().toISOString(),
                note: "Network error while testing integration.",
            });
        } finally {
            setActiveTest(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
                <p className="text-muted-foreground">Connect external tools and verify each integration endpoint.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map((integration) => (
                    <div
                        key={integration.id}
                        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm relative overflow-hidden"
                    >
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-medium border border-border/60 bg-secondary/70 flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {states[integration.id].connected ? "Connected" : "Disconnected"}
                        </div>

                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                            <integration.icon className={`w-6 h-6 ${integration.color}`} />
                        </div>

                        <h3 className="font-semibold text-lg mb-2">{integration.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            {integration.description}
                        </p>

                        <div className="space-y-3">
                            {states[integration.id].config && (
                                <div className="text-xs rounded-md border border-border/60 bg-secondary/40 p-2 break-all">
                                    {states[integration.id].config}
                                </div>
                            )}

                            {states[integration.id].last_tested_at && (
                                <div
                                    className={cn(
                                        "text-xs rounded-md px-2 py-1 border",
                                        states[integration.id].last_test_ok
                                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "border-destructive/40 bg-destructive/10 text-destructive"
                                    )}
                                >
                                    {states[integration.id].note || "Test complete"}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                {states[integration.id].connected ? (
                                    <button
                                        onClick={() => disconnectIntegration(integration.id)}
                                        className="w-full py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium border border-border/60 hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Unplug className="w-4 h-4" />
                                        Disconnect
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => connectIntegration(integration)}
                                        className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <PlugZap className="w-4 h-4" />
                                        Connect
                                    </button>
                                )}
                                <button
                                    onClick={() => testIntegration(integration)}
                                    disabled={!states[integration.id].connected || activeTest === integration.id}
                                    className="w-full py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium border border-border/60 hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {activeTest === integration.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
                                    Test
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
