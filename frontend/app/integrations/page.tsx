"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, Database, Link2, Loader2, MessageSquare, PlugZap, ReceiptText, RefreshCw, ShoppingBag, Unplug, Wallet, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type IntegrationId =
    | "google-sheets"
    | "slack"
    | "webhook"
    | "tally"
    | "zoho-books"
    | "busy"
    | "razorpay"
    | "phonepe"
    | "bharatpe"
    | "amazon-seller"
    | "flipkart-seller"
    | "gst-portal";

type ConfigMode = "sheet" | "url" | "token" | "token_or_url";

interface IntegrationDefinition {
    id: IntegrationId;
    name: string;
    description: string;
    icon: typeof Database;
    color: string;
    placeholder: string;
    configMode: ConfigMode;
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
        configMode: "sheet",
    },
    {
        id: "slack",
        name: "Slack",
        description: "Save a Slack webhook URL and test alert delivery.",
        icon: MessageSquare,
        color: "text-indigo-600",
        placeholder: "https://hooks.slack.com/services/...",
        configMode: "url",
    },
    {
        id: "webhook",
        name: "Webhooks",
        description: "Save a custom webhook endpoint and test payload delivery.",
        icon: Webhook,
        color: "text-blue-600",
        placeholder: "https://example.com/webhook",
        configMode: "url",
    },
    {
        id: "tally",
        name: "Tally",
        description: "Track Tally export path or connector token for ledger sync workflow.",
        icon: Building2,
        color: "text-amber-600",
        placeholder: "tally-company-token",
        configMode: "token",
    },
    {
        id: "zoho-books",
        name: "Zoho Books",
        description: "Save Zoho Books org token for bookkeeping and tax sync.",
        icon: Wallet,
        color: "text-cyan-600",
        placeholder: "zoho-org-token",
        configMode: "token",
    },
    {
        id: "busy",
        name: "Busy",
        description: "Save Busy export key for offline accounting sync handoff.",
        icon: Database,
        color: "text-emerald-600",
        placeholder: "busy-export-key",
        configMode: "token",
    },
    {
        id: "razorpay",
        name: "Razorpay",
        description: "Store Razorpay webhook URL or API credential reference.",
        icon: CreditCard,
        color: "text-sky-600",
        placeholder: "rzp_live_xxx or https://...",
        configMode: "token_or_url",
    },
    {
        id: "phonepe",
        name: "PhonePe",
        description: "Store PhonePe merchant config for payment trend reporting.",
        icon: CreditCard,
        color: "text-violet-600",
        placeholder: "phonepe-merchant-key",
        configMode: "token_or_url",
    },
    {
        id: "bharatpe",
        name: "BharatPe",
        description: "Store BharatPe merchant reference for payout and sales mapping.",
        icon: CreditCard,
        color: "text-teal-600",
        placeholder: "bharatpe-merchant-key",
        configMode: "token_or_url",
    },
    {
        id: "amazon-seller",
        name: "Amazon Seller",
        description: "Save seller export credential/token for marketplace analytics.",
        icon: ShoppingBag,
        color: "text-orange-600",
        placeholder: "amazon-seller-token",
        configMode: "token",
    },
    {
        id: "flipkart-seller",
        name: "Flipkart Seller",
        description: "Save Flipkart seller credential for marketplace trend sync.",
        icon: ShoppingBag,
        color: "text-blue-700",
        placeholder: "flipkart-seller-token",
        configMode: "token",
    },
    {
        id: "gst-portal",
        name: "GST Portal",
        description: "Store GST portal profile reference for filing readiness checks.",
        icon: ReceiptText,
        color: "text-rose-600",
        placeholder: "gst-profile-ref",
        configMode: "token",
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
        tally: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        "zoho-books": { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        busy: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        razorpay: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        phonepe: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        bharatpe: { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        "amazon-seller": { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        "flipkart-seller": { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
        "gst-portal": { connected: false, config: "", last_tested_at: null, last_test_ok: null, note: null },
    };
}

function connectorTypeLabel(type: DataConnector["connector_type"]): string {
    return type === "google_sheets" ? "Google Sheets" : "PostgreSQL";
}

export default function IntegrationsPage() {
    const [states, setStates] = useState<Record<IntegrationId, IntegrationState>>(emptyStates);
    const [activeTest, setActiveTest] = useState<IntegrationId | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectors, setConnectors] = useState<DataConnector[]>([]);
    const [activeConnectorAction, setActiveConnectorAction] = useState<number | null>(null);

    const sortedIntegrations = useMemo(() => integrations, []);

    const refresh = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

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
        const isUrl = isValidHttpUrl(trimmed);
        if (integration.configMode === "url" && !isUrl) {
            window.alert("Please provide a valid http(s) URL.");
            return;
        }
        if (integration.configMode === "sheet" && trimmed.length < 8) {
            window.alert("Please provide a valid sheet URL or ID.");
            return;
        }
        if (integration.configMode === "token" && trimmed.length < 6) {
            window.alert("Please provide a valid credential or token.");
            return;
        }
        if (integration.configMode === "token_or_url" && !isUrl && trimmed.length < 8) {
            window.alert("Please provide a valid URL or credential token.");
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
        <div className="flex h-full flex-col gap-5 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="section-header">
                    <h1 className="section-title">Integrations</h1>
                    <p className="section-subtitle">Connect external tools and verify each integration endpoint.</p>
                </div>
                <button
                    onClick={() => void refresh()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="panel-surface-tight border-destructive/40 bg-destructive/10 text-sm text-destructive">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="panel-surface inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading integrations...
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sortedIntegrations.map((integration) => (
                            <div
                                key={integration.id}
                                className="panel-surface relative overflow-hidden"
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                                            <integration.icon className={`h-5 w-5 ${integration.color}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold">{integration.name}</h3>
                                            <p className="text-xs text-muted-foreground">Connection endpoint</p>
                                        </div>
                                    </div>
                                    <div
                                        className={cn(
                                            "status-badge",
                                            states[integration.id].connected ? "status-badge--success" : "status-badge--neutral"
                                        )}
                                    >
                                        <Link2 className="h-3 w-3" />
                                        {states[integration.id].connected ? "Connected" : "Disconnected"}
                                    </div>
                                </div>

                                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                                    {integration.description}
                                </p>

                                <div className="space-y-3">
                                    {states[integration.id].config && (
                                        <div className="rounded-md border border-border/60 bg-secondary/40 p-2 text-xs break-all">
                                            {states[integration.id].config}
                                        </div>
                                    )}

                                    {states[integration.id].last_tested_at && (
                                        <div
                                            className={cn(
                                                "status-badge",
                                                states[integration.id].last_test_ok ? "status-badge--success" : "status-badge--error"
                                            )}
                                        >
                                            {states[integration.id].note || "Test complete"}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        {states[integration.id].connected ? (
                                            <button
                                                onClick={() => void disconnectIntegration(integration.id)}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                                            >
                                                <Unplug className="h-4 w-4" />
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => void connectIntegration(integration)}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                                            >
                                                <PlugZap className="h-4 w-4" />
                                                Connect
                                            </button>
                                        )}
                                        <button
                                            onClick={() => void testIntegration(integration)}
                                            disabled={!states[integration.id].connected || activeTest === integration.id}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                                        >
                                            {activeTest === integration.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
                                            Test
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <section className="panel-surface">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Data Connectors</h2>
                                <p className="text-sm text-muted-foreground">
                                    Connect Google Sheets or PostgreSQL and sync fresh datasets on schedule.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => void createConnector("google_sheets")}
                                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    Add Google Sheets
                                </button>
                                <button
                                    onClick={() => void createConnector("postgresql")}
                                    className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm font-medium hover:bg-secondary"
                                >
                                    Add PostgreSQL
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {connectors.length === 0 ? (
                                <div className="panel-surface-tight text-sm text-muted-foreground">
                                    No data connectors configured yet.
                                </div>
                            ) : (
                                connectors.map((connector) => (
                                    <div
                                        key={connector.id}
                                        className="rounded-lg border border-border/60 bg-background/40 p-3 md:p-4"
                                    >
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold">{connector.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {connectorTypeLabel(connector.connector_type)} | Every {connector.sync_interval_minutes} min
                                                </p>
                                                <div className="mt-1">
                                                    <span
                                                        className={cn(
                                                            "status-badge",
                                                            connector.last_sync_status === "success"
                                                                ? "status-badge--success"
                                                                : connector.last_sync_status === "failed"
                                                                    ? "status-badge--error"
                                                                    : "status-badge--neutral"
                                                        )}
                                                    >
                                                        Last sync: {connector.last_sync_status || "never"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => void connectorTest(connector.id)}
                                                    disabled={activeConnectorAction === connector.id}
                                                    className="rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                                                >
                                                    Test
                                                </button>
                                                <button
                                                    onClick={() => void connectorSync(connector.id)}
                                                    disabled={activeConnectorAction === connector.id}
                                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                                                >
                                                    {activeConnectorAction === connector.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                                    Sync now
                                                </button>
                                                <button
                                                    onClick={() => void connectorDelete(connector.id)}
                                                    className="rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        {connector.last_sync_error && (
                                            <p className="mt-2 text-xs text-destructive">{connector.last_sync_error}</p>
                                        )}
                                        {connector.last_synced_at && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Last synced at {new Date(connector.last_synced_at).toLocaleString()}
                                            </p>
                                        )}
                                        {connector.target_dataset_name && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Target dataset: {connector.target_dataset_name}
                                            </p>
                                        )}
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
