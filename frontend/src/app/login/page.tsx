"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Network, ShieldCheck, AlertCircle, ArrowRight, Lock, UserCheck, Settings, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<"admin" | "analyst">("admin");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("adminpassword123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to appropriate portal
  useEffect(() => {
    if (user) {
      router.replace(user.role === "admin" ? "/admin" : "/");
    }
  }, [user, router]);

  const handleRoleSelect = (role: "admin" | "analyst") => {
    setSelectedRole(role);
    if (role === "admin") {
      setUsername("admin");
      setPassword("adminpassword123");
    } else {
      setUsername("analyst");
      setPassword("analystpassword123");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const targetPath = username.toLowerCase() === "admin" ? "/admin" : "/";
      router.replace(targetPath);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectLaunch = async (u: string, p: string, targetPath: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await login(u, p);
      router.replace(targetPath);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-elevated">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              FraudGraph Platform
            </h1>
            <p className="text-xs text-slate-500">
              Graph Intelligence & Financial Crime Detection
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Selector Tabs */}
        <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => handleRoleSelect("admin")}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
              selectedRole === "admin"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Admin Portal</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect("analyst")}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
              selectedRole === "analyst"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Analyst Workspace</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium font-mono"
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
            <span>
              {submitting
                ? "Authenticating Session..."
                : selectedRole === "admin"
                ? "Sign In to Admin Panel"
                : "Sign In to Analyst Dashboard"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* 1-Click Launch Presets */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
            Instant 1-Click Launch
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDirectLaunch("admin", "adminpassword123", "/admin")}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 py-2.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100/80 transition-all shadow-2xs"
            >
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <span>Launch Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleDirectLaunch("analyst", "analystpassword123", "/")}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
            >
              <UserCheck className="h-4 w-4 text-slate-600" />
              <span>Launch Analyst</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
