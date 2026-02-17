"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { apiFetch } from "@/lib/api-client";
import { clearAuthSession, getAuthToken, setAuthSession } from "@/lib/auth";

interface AppShellProps {
    children: React.ReactNode;
}

const PUBLIC_PATHS = new Set(["/signin", "/signup"]);

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isReady, setIsReady] = useState(false);

    const isPublicPath = useMemo(() => {
        if (!pathname) return false;
        return PUBLIC_PATHS.has(pathname);
    }, [pathname]);

    useEffect(() => {
        let cancelled = false;

        const validateSession = async () => {
            if (isPublicPath) {
                setIsReady(true);
                return;
            }

            const token = getAuthToken();
            if (!token) {
                if (!cancelled) router.replace("/signin");
                return;
            }

            try {
                const response = await apiFetch("/auth/me");
                if (!response.ok) {
                    clearAuthSession();
                    if (!cancelled) router.replace("/signin");
                    return;
                }

                const user = await response.json();
                setAuthSession(token, user);
                if (!cancelled) setIsReady(true);
            } catch {
                clearAuthSession();
                if (!cancelled) router.replace("/signin");
            }
        };

        validateSession();

        return () => {
            cancelled = true;
        };
    }, [isPublicPath, pathname, router]);

    useEffect(() => {
        const handleAuthChanged = () => {
            const token = getAuthToken();
            if (!token && !isPublicPath) {
                router.replace("/signin");
            }
        };
        window.addEventListener("auth-changed", handleAuthChanged);
        return () => window.removeEventListener("auth-changed", handleAuthChanged);
    }, [isPublicPath, router]);

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            </div>
        );
    }

    if (isPublicPath) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto overflow-x-hidden bg-secondary/20 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
