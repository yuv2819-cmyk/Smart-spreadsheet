"use client";

import { useEffect } from "react";

import { applyThemePreference, loadSettings } from "@/lib/user-settings";

export default function ThemeInitializer() {
    useEffect(() => {
        const settings = loadSettings();
        applyThemePreference(settings.theme);
    }, []);

    return null;
}
