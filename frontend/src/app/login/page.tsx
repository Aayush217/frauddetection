"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Network, ShieldCheck, AlertCircle, ArrowRight, Lock, UserCheck } from "lucide-react";
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

  const handleQuickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
    setSubmitting(true);
    try {
      await login(u, p);
      router.push(u === "admin" ? "/admin" : "/");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 text-slate-900">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-elevated">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              FraudGraph Platform
            </h1>
            <p className="text-xs text-slate-500">
              Graph Intelligence & Crime Detection
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Analyst Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Passphrase
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold text-xs text-white hover:bg-indigo-700 transition-all shadow-xs disabled:opacity-50"
          >
            <span>{submitting ? "Authenticating..." : "Sign In to Platform"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Demo Viva Quick Login Presets */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
            One-Click Viva Login Presets
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("analyst", "analystpassword123")}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Analyst</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("admin", "adminpassword123")}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
