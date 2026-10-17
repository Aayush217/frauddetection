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
  Cpu,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Plus,
  Activity,
  Layers,
  Database,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", href: "/", icon: Activity },
  { name: "Investigation", href: "/investigate", icon: Network },
  { name: "Fraud Rings", href: "/rings", icon: ShieldAlert },
  { name: "Accounts", href: "/accounts", icon: Users },
  { name: "Transfers", href: "/transfers", icon: ArrowLeftRight },
  { name: "Entities (Devices/IP)", href: "/entities", icon: Laptop },
  { name: "Graph Analytics", href: "/analytics", icon: Layers },
  { name: "Cypher vs SQL", href: "/benchmarks", icon: Database },
  { name: "Admin Console", href: "/admin", icon: Settings, adminOnly: true },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAdmin, isAuthenticated, loading } = useAuth();
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
      <div className="flex h-screen w-screen items-center justify-center bg-dark-bg text-dark-text">
        <div className="flex items-center gap-3 font-mono text-xs text-dark-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          INITIALIZING ANALYST WORKSPACE...
        </div>
      </div>
    );
  }

  // Allow login page without shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-dark-border bg-dark-panel transition-all duration-200 z-30 select-none ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        {/* Brand header */}
        <div className="flex h-12 items-center justify-between border-b border-dark-border px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-brand/10 border border-brand/30 text-brand">
              <Network className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold tracking-wider text-dark-text uppercase">
                  FraudGraph
                </span>
                <span className="text-[10px] text-dark-muted tracking-tight">
                  Graph Intelligence v1.0
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-dark-muted hover:bg-dark-panelElevated hover:text-dark-text transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`group flex h-8 items-center gap-2.5 rounded px-2 font-mono text-xs transition-colors ${
                  active
                    ? "bg-brand/15 text-brand font-medium border border-brand/30"
                    : "text-dark-muted hover:bg-dark-panelElevated hover:text-dark-text"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand" : "text-dark-muted group-hover:text-dark-text"}`} />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-dark-border p-2">
          {!collapsed ? (
            <div className="flex items-center justify-between rounded bg-dark-panelElevated/50 p-2 border border-dark-border">
              <div className="flex flex-col overflow-hidden">
                <span className="truncate font-mono text-xs font-medium text-dark-text">
                  {user?.username || "analyst"}
                </span>
                <span className="font-mono text-[10px] text-brand uppercase">
                  {user?.role || "analyst"}
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="rounded p-1 text-dark-muted hover:bg-dark-panel hover:text-risk-high transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-8 w-full items-center justify-center rounded text-dark-muted hover:bg-dark-panelElevated hover:text-risk-high"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-12 items-center justify-between border-b border-dark-border bg-dark-panel px-4 z-20">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-dark-muted uppercase tracking-wider">
              Workspace / <span className="text-dark-text font-medium">{pathname.replace("/", "") || "Overview"}</span>
            </span>
            <div className="h-3.5 w-[1px] bg-dark-border" />
            <div className="flex items-center gap-1.5 rounded bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              NEO4J + GDS LIVE
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Command palette search bar */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-7 items-center gap-2 rounded border border-dark-border bg-dark-panelElevated px-2.5 font-mono text-xs text-dark-muted hover:border-dark-text/30 hover:text-dark-text transition-colors"
            >
              <Search className="h-3 w-3" />
              <span>Search account, ring, cypher...</span>
              <kbd className="rounded border border-dark-border bg-dark-panel px-1 text-[10px]">⌘K</kbd>
            </button>

            {/* Quick action: simulate transfer */}
            <Link
              href="/transfers?new=true"
              className="flex h-7 items-center gap-1.5 rounded bg-brand px-2.5 font-mono text-xs font-medium text-dark-bg hover:bg-brand-hover transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Transfer</span>
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-auto bg-dark-bg p-4">
          {children}
        </main>
      </div>

      {/* Cmd+K Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-md border border-dark-border bg-dark-panel shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center border-b border-dark-border px-3 py-2">
              <Search className="h-4 w-4 text-dark-muted mr-2" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type an account ID (e.g. ACC_000100), device, or Cypher keyword..."
                className="flex-1 bg-transparent font-mono text-xs text-dark-text placeholder:text-dark-muted outline-none"
              />
              <kbd className="rounded border border-dark-border px-1.5 py-0.5 text-[10px] font-mono text-dark-muted">
                ESC
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-dark-muted px-2 py-1">
                Quick Navigation
              </div>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      setSearchOpen(false);
                      window.location.href = item.href;
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs text-dark-text hover:bg-dark-panelElevated"
                  >
                    <item.icon className="h-3.5 w-3.5 text-brand" />
                    <span>Go to {item.name}</span>
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
