"use client";

import { Save, User, Building, Bell } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your workspace preferences.</p>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Settings Sidebar */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                    <button className="w-full text-left px-3 py-2 rounded-lg bg-secondary font-medium text-sm flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        General
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground text-sm flex items-center gap-2 transition-colors">
                        <User className="w-4 h-4" />
                        Profile
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground text-sm flex items-center gap-2 transition-colors">
                        <Bell className="w-4 h-4" />
                        Notifications
                    </button>
                </div>

                {/* Settings Form */}
                <div className="col-span-12 md:col-span-9 space-y-6">
                    {/* Workspace Section */}
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-lg mb-4">Workspace Settings</h3>
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Workspace Name</label>
                                <input
                                    type="text"
                                    defaultValue="My Workspace"
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Subdomain</label>
                                <div className="flex">
                                    <input
                                        type="text"
                                        defaultValue="demo"
                                        className="w-full bg-background border border-border rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <div className="bg-secondary border border-l-0 border-border rounded-r-lg px-3 py-2 text-sm text-muted-foreground">
                                        .smartspreadsheet.app
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-lg mb-4">Appearance</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">Dark Mode</p>
                                <p className="text-sm text-muted-foreground">Toggle application theme</p>
                            </div>
                            <button className="w-12 h-6 bg-primary rounded-full relative transition-colors">
                                <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
