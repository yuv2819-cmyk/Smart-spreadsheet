"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Link2, Loader2, MessageSquare, PlugZap, RefreshCw, Unplug, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

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

interface DataConnector {
    id: number;
    name: string;
    connector_type: "google_sheets" | "postgresql";
    enabled: boolean;
    sync_interval_minutes: number;
    target_dataset_name: string | null;
    last_synced_at: string | null;
    last_sync_status: string | null;
    last_sync_error: string | null;
}

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

function integrationKeyToApiKey(id: IntegrationId): string {
    if (id === "google-sheets") return "google-sheets";
    return id;
}

function emptyStates(): Record<IntegrationId, IntegrationState> {
    return {
        "google-sheets": { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        slack: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        webhook: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
    };
}

export default function IntegrationsPage() {
    const [states, setStates] = useState<Record<IntegrationId, IntegrationState>>(emptyStates);
    const [activeTest, setActiveTest] = useState<IntegrationId | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectors, setConnectors] = useState<DataConnector[]>([]);
    const [activeConnectorAction, setActiveConnectorAction] = useState<number | null>(null);

    const sortedIntegrations = useMemo(() => integrations, []);

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiFetch("/workspace/integrations");
            if (!response.ok) throw new Error("Failed to load integrations.");
            const payload = await response.json();
            const next = emptyStates();
            if (Array.isArray(payload)) {
                for (const item of payload) {
                    const key = String(item?.integration_key || "");
                    const mappedId = key === "google-sheets" ? "google-sheets" : (key as IntegrationId);
                    if (!(mappedId in next)) continue;
                    next[mappedId] = {
                        connected: Boolean(item?.connected),
                        config: String(item?.config || ""),
                        last_tested_at: item?.last_tested_at ? String(item.last_tested_at) : null,
                        last_test_ok: item?.last_test_ok === null || item?.last_test_ok === undefined ? null : Boolean(item.last_test_ok),
                        note: item?.note ? String(item.note) : null,
                    };
                }
            }
            setStates(next);

            const connectorsRes = await apiFetch("/connectors");
            if (connectorsRes.ok) {
                const connectorPayload = await connectorsRes.json();
                if (Array.isArray(connectorPayload)) {
                    setConnectors(connectorPayload);
                } else {
                    setConnectors([]);
                }
            } else {
                setConnectors([]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to load integrations.");
            setStates(emptyStates());
            setConnectors([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const isValidHttpUrl = (value: string): boolean => {
        try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    };

    const connectIntegration = async (integration: IntegrationDefinition) => {
        const existing = states[integration.id]?.config || "";
        const value = window.prompt(`Enter ${integration.name} configuration:`, existing || integration.placeholder);
        if (value === null) return;
        const trimmed = value.trim();
        if (!trimmed) {
            window.alert("Configuration value cannot be empty.");
            return;
        }
        if (integration.id !== "google-sheets" && !isValidHttpUrl(trimmed)) {
            window.alert("Please provide a valid http(s) URL.");
            return;
        }

        const payload = {
            integration_key: integrationKeyToApiKey(integration.id),
            connected: true,
            config: trimmed,
            last_tested_at: states[integration.id].last_tested_at,
            last_test_ok: states[integration.id].last_test_ok,
            note: "Connected",
        };
        const response = await apiFetch(`/workspace/integrations/${integrationKeyToApiKey(integration.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            setError("Failed to connect integration.");
            return;
        }
        await refresh();
    };

    const disconnectIntegration = async (id: IntegrationId) => {
        if (!window.confirm("Disconnect this integration?")) return;
        const response = await apiFetch(`/workspace/integrations/${integrationKeyToApiKey(id)}/disconnect`, {
            method: "POST",
        });
        if (!response.ok) {
            setError("Failed to disconnect integration.");
            return;
        }
        await refresh();
    };

    const testIntegration = async (integration: IntegrationDefinition) => {
        const state = states[integration.id];
        if (!state.connected || !state.config) return;

        setActiveTest(integration.id);
        setError(null);
        try {
            const response = await apiFetch(`/workspace/integrations/${integrationKeyToApiKey(integration.id)}/test`, {
                method: "POST",
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.detail || "Test failed.");
            }
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Integration test failed.");
        } finally {
            setActiveTest(null);
        }
    };

    const createConnector = async (type: "google_sheets" | "postgresql") => {
        let payload: Record<string, unknown> | null = null;
        if (type === "google_sheets") {
            const url = window.prompt("Enter Google Sheet URL:");
            if (!url || !url.trim()) return;
            payload = {
                name: "Google Sheets Connector",
                connector_type: "google_sheets",
                config: { url: url.trim() },
                enabled: true,
                sync_interval_minutes: 60,
            };
        } else {
            const connection_url = window.prompt("Enter PostgreSQL connection URL:");
            if (!connection_url || !connection_url.trim()) return;
            const query = window.prompt("Enter SQL query for sync:", "SELECT * FROM your_table LIMIT 1000");
            if (!query || !query.trim()) return;
            payload = {
                name: "PostgreSQL Connector",
                connector_type: "postgresql",
                config: { connection_url: connection_url.trim(), query: query.trim() },
                enabled: true,
                sync_interval_minutes: 60,
            };
        }

        const response = await apiFetch("/connectors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            setError(String(body?.detail || "Failed to create connector."));
            return;
        }
        await refresh();
    };

    const connectorSync = async (connectorId: number) => {
        setActiveConnectorAction(connectorId);
        try {
            const response = await apiFetch(`/connectors/${connectorId}/sync`, { method: "POST" });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(String(body?.detail || "Sync failed"));
            }
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Connector sync failed.");
        } finally {
            setActiveConnectorAction(null);
        }
    };

    const connectorTest = async (connectorId: number) => {
        setActiveConnectorAction(connectorId);
        try {
            const response = await apiFetch(`/connectors/${connectorId}/test`, { method: "POST" });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(String(body?.detail || "Test failed"));
            }
            const payload = await response.json();
            window.alert(payload.detail || "Connector test complete.");
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Connector test failed.");
        } finally {
            setActiveConnectorAction(null);
        }
    };

    const connectorDelete = async (connectorId: number) => {
        if (!window.confirm("Delete this connector?")) return;
        const response = await apiFetch(`/connectors/${connectorId}`, { method: "DELETE" });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            setError(String(body?.detail || "Failed to delete connector."));
            return;
        }
        await refresh();
    };

    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
                <p className="text-muted-foreground">Connect external tools and verify each integration endpoint.</p>
            </div>
            {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}
            {loading ? (
                <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading integrations...
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedIntegrations.map((integration) => (
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
                                            onClick={() => void disconnectIntegration(integration.id)}
                                            className="w-full py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium border border-border/60 hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Unplug className="w-4 h-4" />
                                            Disconnect
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => void connectIntegration(integration)}
                                            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <PlugZap className="w-4 h-4" />
                                            Connect
                                        </button>
                                    )}
                                    <button
                                        onClick={() => void testIntegration(integration)}
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

                    <section className="mt-8 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Data Connectors</h2>
                                <p className="text-sm text-muted-foreground">
                                    Connect Google Sheets or PostgreSQL and sync fresh datasets on schedule.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => void createConnector("google_sheets")}
                                    className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    Add Google Sheets
                                </button>
                                <button
                                    onClick={() => void createConnector("postgresql")}
                                    className="px-3 py-2 rounded-lg text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary"
                                >
                                    Add PostgreSQL
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {connectors.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No data connectors configured yet.</p>
                            ) : (
                                connectors.map((connector) => (
                                    <div
                                        key={connector.id}
                                        className="rounded-lg border border-border/60 bg-background/40 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {connector.name} ({connector.connector_type})
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Interval: every {connector.sync_interval_minutes} min | Last status: {connector.last_sync_status || "never"}
                                            </p>
                                            {connector.last_sync_error && (
                                                <p className="text-xs text-destructive">{connector.last_sync_error}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => void connectorTest(connector.id)}
                                                disabled={activeConnectorAction === connector.id}
                                                className="px-2.5 py-1.5 rounded-md text-xs border border-border bg-secondary/60 hover:bg-secondary disabled:opacity-50"
                                            >
                                                Test
                                            </button>
                                            <button
                                                onClick={() => void connectorSync(connector.id)}
                                                disabled={activeConnectorAction === connector.id}
                                                className="px-2.5 py-1.5 rounded-md text-xs border border-border bg-secondary/60 hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-1"
                                            >
                                                {activeConnectorAction === connector.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                Sync now
                                            </button>
                                            <button
                                                onClick={() => void connectorDelete(connector.id)}
                                                className="px-2.5 py-1.5 rounded-md text-xs border border-destructive/40 text-destructive hover:bg-destructive/10"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
