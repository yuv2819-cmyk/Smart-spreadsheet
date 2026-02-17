"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, HelpCircle, LogOut, Search } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { clearAuthSession, getAuthUser, type AuthUser } from "@/lib/auth";

export default function Header() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        const syncUser = () => setUser(getAuthUser());
        syncUser();
        window.addEventListener("auth-changed", syncUser);
        return () => window.removeEventListener("auth-changed", syncUser);
    }, []);

    const onLogout = async () => {
        try {
            await apiFetch("/auth/logout", { method: "POST" });
        } catch {
            // Ignore network errors on logout and clear local state anyway.
        }
        clearAuthSession();
        router.replace("/signin");
    };

    return (
        <header className="h-14 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
            {/* Search */}
            <div className="flex-1 max-w-md">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search spreadsheets, data..."
                        className="w-full bg-secondary/50 border border-transparent focus:border-border hover:bg-secondary/80 focus:bg-background rounded-md pl-9 pr-4 py-1.5 text-sm transition-all duration-200 outline-none placeholder:text-muted-foreground/70"
                    />
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                {user && (
                    <span className="hidden md:inline text-sm text-muted-foreground mr-1">
                        {user.full_name || user.email}
                    </span>
                )}
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors">
                    <HelpCircle className="w-4 h-4" />
                </button>
                <button
                    onClick={onLogout}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-secondary/50 rounded-md transition-colors"
                    title="Log out"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </header>
    );
}
