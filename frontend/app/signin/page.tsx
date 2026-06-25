"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from "lucide-react";

import AuthSplitLayout from "@/components/AuthSplitLayout";
import { apiFetch } from "@/lib/api-client";
import { networkApiErrorMessage, readApiErrorMessage } from "@/lib/api-errors";
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
    const errorId = "signin-form-error";

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
                throw new Error(await readApiErrorMessage(response, "Sign in failed."));
            }

            const payload: SignInResponse = await response.json();
            setAuthSession(payload.access_token, payload.user, payload.expires_in, rememberMe ? "local" : "session");
            router.replace("/overview");
        } catch (err) {
            setError(networkApiErrorMessage(err, "Unable to sign in."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthSplitLayout>
            <div
                className="rounded-[32px] border border-[#2a4d78] px-6 py-8 shadow-[0_30px_95px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:px-9 sm:py-10"
                style={{
                    background:
                        "linear-gradient(155deg, rgba(8,17,40,0.95) 0%, rgba(6,15,37,0.94) 58%, rgba(4,12,30,0.94) 100%)",
                }}
            >
                <div>
                    <h1 className="bg-gradient-to-r from-white via-sky-100 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                        Welcome Back
                    </h1>
                    <p className="mt-3 text-sm text-slate-300 sm:text-base">
                        Sign in to continue your analytics journey.
                    </p>
                </div>

                {error && (
                    <div id={errorId} role="alert" className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={submit} className="mt-8 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300" htmlFor="signin-email">Email Address</label>
                        <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/50" />
                            <input
                                id="signin-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? errorId : undefined}
                                className="auth-input w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300" htmlFor="signin-password">Password</label>
                        <div className="relative">
                            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/50" />
                            <input
                                id="signin-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? errorId : undefined}
                                className="auth-input w-full rounded-xl border py-3 pl-11 pr-12 text-sm outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-cyan-200/55 transition hover:text-cyan-200"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-[#2a4d78] bg-[#020814] text-cyan-300 focus:ring-cyan-300/35"
                        />
                        Remember me
                    </label>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(30,174,242,0.38)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: "linear-gradient(90deg, #22d3ee 0%, #2563eb 100%)" }}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        {loading ? "Signing In..." : "Sign In"}
                    </button>
                </form>

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
