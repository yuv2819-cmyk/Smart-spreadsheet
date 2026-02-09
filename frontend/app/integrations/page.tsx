"use client";

import { Database, MessageSquare, Webhook, Lock } from "lucide-react";

const integrations = [
    {
        id: "google-sheets",
        name: "Google Sheets",
        description: "Sync data directly from your Google Drive sheets.",
        icon: Database,
        color: "text-green-600",
        status: "Coming Soon"
    },
    {
        id: "slack",
        name: "Slack",
        description: "Receive notifications and updates in your Slack channels.",
        icon: MessageSquare,
        color: "text-purple-600",
        status: "Coming Soon"
    },
    {
        id: "webhook",
        name: "Webhooks",
        description: "Trigger custom workflows on row updates.",
        icon: Webhook,
        color: "text-blue-600",
        status: "Coming Soon"
    },
];

export default function IntegrationsPage() {
    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
                <p className="text-muted-foreground">Connect your favorite tools to SmartSheet.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map((integration) => (
                    <div
                        key={integration.id}
                        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm opacity-70 hover:opacity-100 transition-opacity relative overflow-hidden group"
                    >
                        <div className="absolute top-3 right-3 bg-secondary px-2 py-1 rounded-md text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {integration.status}
                        </div>

                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                            <integration.icon className={`w-6 h-6 ${integration.color}`} />
                        </div>

                        <h3 className="font-semibold text-lg mb-2">{integration.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            {integration.description}
                        </p>

                        <button disabled className="w-full py-2 rounded-lg bg-secondary/50 text-muted-foreground text-sm font-medium cursor-not-allowed border border-transparent group-hover:border-border transition-colors">
                            Connect
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
