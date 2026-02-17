import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ThemeInitializer from "@/components/ThemeInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "SmartSheet - AI-Powered Data Analysis",
    description: "Multi-tenant AI-powered spreadsheet for SMBs with real-time collaboration",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.className} bg-background text-foreground antialiased`}>
                <ThemeInitializer />
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}
