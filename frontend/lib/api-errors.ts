type ApiErrorDetail = string | Array<{ msg?: string; loc?: Array<string | number> }>;

function formatValidationDetail(detail: ApiErrorDetail): string {
    if (typeof detail === "string") {
        return detail;
    }
    if (!Array.isArray(detail) || detail.length === 0) {
        return "";
    }
    return detail
        .map((entry) => {
            if (!entry || typeof entry !== "object") return "";
            const message = typeof entry.msg === "string" ? entry.msg : "";
            const location = Array.isArray(entry.loc) ? entry.loc.filter((part) => part !== "body").join(".") : "";
            return location ? `${location}: ${message}` : message;
        })
        .filter(Boolean)
        .join(" ");
}

export async function readApiErrorMessage(
    response: Response,
    fallback: string
): Promise<string> {
    try {
        const body = (await response.json()) as { detail?: ApiErrorDetail };
        const detail = formatValidationDetail(body.detail ?? "");
        return detail || fallback;
    } catch {
        return fallback;
    }
}

export function networkApiErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) {
        return fallback;
    }

    const message = error.message.toLowerCase();
    if (
        message.includes("failed to fetch") ||
        message.includes("networkerror") ||
        message.includes("load failed") ||
        message.includes("network request failed")
    ) {
        return "Cannot reach the API server. Start the backend on port 8000, then try again.";
    }

    return error.message || fallback;
}