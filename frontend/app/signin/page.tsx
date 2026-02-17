"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Github, Loader2, Lock, LogIn, Mail } from "lucide-react";

import AuthSplitLayout from "@/components/AuthSplitLayout";
import { apiFetch } from "@/lib/api-client";
import { getAuthToken, setAuthSession } from "@/lib/auth";

interface SignInResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: {
        id: number;
        tenant_id: number;
        email: string;
        full_name: string | null;
        is_active: boolean;
        role: string;
    };
}

export default function SignInPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (getAuthToken()) {
            router.replace("/overview");
        }
    }, [router]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await apiFetch("/auth/signin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                let message = "Sign in failed.";
                try {
                    const body = await response.json();
                    message = body.detail || message;
                } catch {
                    // ignore json parse errors
                }
                throw new Error(message);
            }

            const payload: SignInResponse = await response.json();
            setAuthSession(payload.access_token, payload.user);
            router.replace("/overview");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to sign in.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthSplitLayout>
            <div className="rounded-[30px] border border-white/10 bg-gradient-to-b from-[#121831]/95 to-[#0b1022]/95 px-6 py-8 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-9 sm:py-10">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Welcome Back</h1>
                    <p className="mt-3 text-sm text-slate-300 sm:text-base">
                        Sign in to continue your analytics journey.
                    </p>
                </div>

                {error && (
                    <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={submit} className="mt-8 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300" htmlFor="signin-email">Email Address</label>
                        <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                id="signin-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-[#050913] py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300" htmlFor="signin-password">Password</label>
                        <div className="relative">
                            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                id="signin-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-[#050913] py-3 pl-11 pr-12 text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-200"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-sm">
                        <label className="inline-flex items-center gap-2 text-slate-300">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-300/30"
                            />
                            Remember me
                        </label>
                        <button
                            type="button"
                            disabled
                            className="cursor-not-allowed text-slate-500"
                        >
                            Forgot password?
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        {loading ? "Signing In..." : "Sign In"}
                    </button>
                </form>

                <div className="mt-8 flex items-center gap-4 text-xs text-slate-500">
                    <span className="h-px flex-1 bg-white/10" />
                    or continue with
                    <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#050913] px-4 py-3 text-sm font-medium text-slate-400"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M21.35 11.1h-9.18v2.98h5.28c-.23 1.47-1.76 4.3-5.28 4.3-3.18 0-5.77-2.63-5.77-5.88s2.59-5.88 5.77-5.88c1.81 0 3.02.77 3.72 1.43l2.54-2.44C16.82 4.1 14.72 3 12.17 3 7.2 3 3.17 7.03 3.17 12s4.03 9 9 9c5.2 0 8.65-3.66 8.65-8.82 0-.59-.06-1.04-.15-1.08Z"
                            />
                        </svg>
                        Google
                    </button>
                    <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#050913] px-4 py-3 text-sm font-medium text-slate-400"
                    >
                        <Github className="h-4 w-4" />
                        GitHub
                    </button>
                </div>

                <p className="mt-7 text-center text-sm text-slate-400">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">
                        Sign up
                    </Link>
                </p>
            </div>
        </AuthSplitLayout>
    );
}
