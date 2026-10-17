"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Network, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("analyst");
  const [password, setPassword] = useState("analystpassword123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const setDemoCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-dark-bg p-4 text-dark-text">
      <div className="w-full max-w-sm rounded border border-dark-border bg-dark-panel p-6 shadow-xl">
        {/* Terminal Header */}
        <div className="mb-6 flex items-center gap-2.5 border-b border-dark-border pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-brand/10 border border-brand/30 text-brand">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-mono text-xs font-bold uppercase tracking-wider text-dark-text">
              FraudGraph Core
            </h1>
            <p className="text-[11px] text-dark-muted font-mono">
              Graph Ring Detection & Identity Resolution
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded border border-risk-high/40 bg-risk-high/10 p-2 font-mono text-xs text-risk-high">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-xxs font-semibold uppercase tracking-wider text-dark-muted mb-1">
              Analyst Identity / Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-dark-border bg-dark-bg px-2.5 py-1.5 font-mono text-xs text-dark-text outline-none focus:border-brand transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xxs font-semibold uppercase tracking-wider text-dark-muted mb-1">
              Passphrase
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-dark-border bg-dark-bg px-2.5 py-1.5 font-mono text-xs text-dark-text outline-none focus:border-brand transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded bg-brand py-1.5 font-mono text-xs font-medium text-dark-bg hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "VERIFYING SIGNATURE..." : "AUTHENTICATE"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Demo Quick-fill buttons for viva defense */}
        <div className="mt-6 border-t border-dark-border pt-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-dark-muted mb-2">
            Viva Demonstration Access:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDemoCredentials("analyst", "analystpassword123")}
              className="rounded border border-dark-border bg-dark-panelElevated px-2 py-1 font-mono text-xxs text-dark-text hover:border-brand/50 hover:text-brand transition-colors text-left"
            >
              <div className="font-semibold text-brand">Analyst</div>
              <div className="text-dark-muted truncate">analyst / analystpassword123</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials("admin", "adminpassword123")}
              className="rounded border border-dark-border bg-dark-panelElevated px-2 py-1 font-mono text-xxs text-dark-text hover:border-brand/50 hover:text-brand transition-colors text-left"
            >
              <div className="font-semibold text-amber-400">Admin</div>
              <div className="text-dark-muted truncate">admin / adminpassword123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
