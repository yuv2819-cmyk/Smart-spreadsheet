import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
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
                <div className="flex h-screen overflow-hidden">
                    <Sidebar />
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <Header />
                        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-secondary/20 p-6">
                            {children}
                        </main>
                    </div>
                </div>
            </body>
        </html>
    );
}
