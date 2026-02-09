"use client";

import { Search, Bell, HelpCircle } from "lucide-react";

export default function Header() {
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
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors">
                    <HelpCircle className="w-4 h-4" />
                </button>
            </div>
        </header>
    );
}
