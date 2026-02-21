import { apiFetch } from "@/lib/api-client";

export async function trackEvent(event_name: string, payload: Record<string, unknown> = {}): Promise<void> {
    try {
        await apiFetch("/events/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_name, payload }),
        });
    } catch {
        // Non-blocking analytics.
    }
}
