import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface TestRequest {
    target_url?: string;
    payload?: Record<string, unknown>;
}

function isValidHttpUrl(input: string): boolean {
    try {
        const parsed = new URL(input);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    let body: TestRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, detail: "Invalid JSON body." }, { status: 400 });
    }

    const targetUrl = String(body.target_url || "").trim();
    if (!targetUrl || !isValidHttpUrl(targetUrl)) {
        return NextResponse.json({ ok: false, detail: "A valid target_url is required." }, { status: 400 });
    }

    const payload = body.payload || { event: "integration_test" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const upstream = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!upstream.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    detail: `Endpoint responded with ${upstream.status}.`,
                    status: upstream.status,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({ ok: true, status: upstream.status });
    } catch (error) {
        clearTimeout(timeout);
        const detail = error instanceof Error ? error.message : "Request failed.";
        return NextResponse.json({ ok: false, detail }, { status: 502 });
    }
}
