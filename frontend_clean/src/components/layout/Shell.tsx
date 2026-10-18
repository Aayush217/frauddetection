"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  Network,
  Users,
  ArrowLeftRight,
  Laptop,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Plus,
  Activity,
  Layers,
  Database,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Executive Overview", href: "/", icon: Activity },
  { name: "Graph Investigation", href: "/investigate", icon: Network, badge: "Canvas" },
  { name: "Syndicate Rings", href: "/rings", icon: ShieldAlert, badge: "33" },
  { name: "Accounts Directory", href: "/accounts", icon: Users },
  { name: "Transfers Ledger", href: "/transfers", icon: ArrowLeftRight },
  { name: "Hardware & Network Entities", href: "/entities", icon: Laptop },
  { name: "GDS Pipeline & Scoring", href: "/analytics", icon: Layers },
  { name: "Cypher vs SQL Benchmarks", href: "/benchmarks", icon: Database, badge: "34x" },
  { name: "System Administration", href: "/admin", icon: Settings, adminOnly: true },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAdmin, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Loading Fraud Intelligence Platform...
        </div>
      </div>
    );
  }

  // Allow login page without shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-slate-200/90 bg-white transition-all duration-200 z-30 select-none shadow-xs ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200/80 px-3.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Network className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-slate-900">
                  FraudGraph
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                  Graph Intelligence
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
          <div className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed ? "text-center" : ""}`}>
            {collapsed ? "•••" : "Forensic Modules"}
          </div>
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`group flex h-9 items-center justify-between rounded-lg px-2.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70 shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </div>
                {!collapsed && item.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                      active
                        ? "bg-indigo-200/80 text-indigo-800"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="border-t border-slate-200/80 p-2.5 bg-slate-50/50">
          {!collapsed ? (
            <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                  {user?.username?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-xs font-semibold text-slate-800">
                    {user?.username || "analyst"}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-indigo-500" />
                    {user?.role || "analyst"}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-9 w-full items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200/90 bg-white/90 backdrop-blur-md px-6 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Platform</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-semibold capitalize">
                {pathname === "/" ? "Executive Dashboard" : pathname.replace("/", "").replace(/-/g, " ")}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Neo4j 5 Cluster (Bolt: 7687)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick search input */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-800 transition-all shadow-2xs"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span>Quick search or command...</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-3xs">
                ⌘K
              </kbd>
            </button>

            {/* Quick action: simulate transfer */}
            <Link
              href="/transfers?new=true"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Simulate Transfer</span>
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-auto bg-[#F8FAFC] p-6">
          {children}
        </main>
      </div>

      {/* Cmd+K Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 pt-20 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center border-b border-slate-200 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400 mr-2.5" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts, fraud syndicates, or pages..."
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2.5 py-1.5">
                Navigation & Shortcuts
              </div>
              <div className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      setSearchOpen(false);
                      window.location.href = item.href;
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 text-slate-400" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-500 font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
