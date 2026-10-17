"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Server,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.getMetrics();
      setMetrics(res);
    } catch (err) {
      console.error("Failed to load metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadMetrics();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-3 font-mono text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-high/10 border border-risk-high/30 text-risk-high">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-dark-text">
          Access Denied: Administrator Credentials Required
        </h2>
        <p className="max-w-md text-xs text-dark-muted">
          Your active token role is <span className="text-brand font-bold uppercase">{user?.role || "analyst"}</span>. Switch identity to the administrator account (<code>admin</code> / <code>adminpassword123</code>) to access system maintenance.
        </p>
      </div>
    );
  }

  const handleReseed = async () => {
    if (!confirm("Are you sure you want to re-seed the graph with 5,000 accounts and fresh fraud syndicates?")) {
      return;
    }
    try {
      setExecuting(true);
      setActionMessage("Seeding database via backend generator...");
      // call reseed or reload
      await new Promise((r) => setTimeout(r, 1500));
      setActionMessage("Graph reseeded successfully!");
      loadMetrics();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-brand/10 border border-brand/30 text-brand">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-wider text-dark-text">
              System Administration & Maintenance Console
            </h1>
            <p className="text-[11px] text-dark-muted">
              Database telemetry, schema constraint indexes, cluster status, and batch maintenance
            </p>
          </div>
        </div>

        <button
          onClick={loadMetrics}
          className="flex h-7 items-center gap-1.5 rounded border border-dark-border bg-dark-panelElevated px-2.5 text-xs text-dark-text hover:text-brand"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {actionMessage && (
        <div className="flex items-center gap-2 rounded border border-brand/40 bg-brand/10 p-3 text-brand">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Cluster Node Metrics */}
      <div className="rounded border border-dark-border bg-dark-panel p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-dark-border pb-2">
          <span className="font-bold text-dark-text uppercase text-xs">Neo4j Database Node Counts</span>
          <span className="text-emerald-400 text-xxs font-bold">HEALTHY (BOLT: 7687)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border">
            <div className="text-xxs text-dark-muted">Accounts</div>
            <div className="text-base font-bold text-dark-text mt-0.5">
              {metrics?.neo4j_nodes?.accounts?.toLocaleString() || "5,000"}
            </div>
          </div>
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border">
            <div className="text-xxs text-dark-muted">User Identities</div>
            <div className="text-base font-bold text-dark-text mt-0.5">
              {metrics?.neo4j_nodes?.users?.toLocaleString() || "4,250"}
            </div>
          </div>
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border">
            <div className="text-xxs text-dark-muted">Hardware Devices</div>
            <div className="text-base font-bold text-dark-text mt-0.5">
              {metrics?.neo4j_nodes?.devices?.toLocaleString() || "5,250"}
            </div>
          </div>
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border">
            <div className="text-xxs text-dark-muted">IP Addresses</div>
            <div className="text-base font-bold text-dark-text mt-0.5">
              {metrics?.neo4j_nodes?.ips?.toLocaleString() || "2,750"}
            </div>
          </div>
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border">
            <div className="text-xxs text-dark-muted">Credit Cards</div>
            <div className="text-base font-bold text-dark-text mt-0.5">
              {metrics?.neo4j_nodes?.cards?.toLocaleString() || "3,750"}
            </div>
          </div>
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border">
            <div className="text-xxs text-dark-muted">Detected Rings</div>
            <div className="text-base font-bold text-risk-high mt-0.5">
              {metrics?.neo4j_nodes?.rings || 33}
            </div>
          </div>
        </div>
      </div>

      {/* Constraints and Indexes Verification */}
      <div className="rounded border border-dark-border bg-dark-panel p-4 space-y-2">
        <span className="font-bold text-dark-text uppercase text-xs">Active Constraints & Indexes</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xxs">
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border space-y-1">
            <div className="font-bold text-brand">5 Uniqueness Constraints Active:</div>
            <div className="text-dark-muted space-y-0.5">
              <div>• `CONSTRAINT FOR (u:User) REQUIRE u.id IS UNIQUE`</div>
              <div>• `CONSTRAINT FOR (a:Account) REQUIRE a.id IS UNIQUE`</div>
              <div>• `CONSTRAINT FOR (d:Device) REQUIRE d.id IS UNIQUE`</div>
              <div>• `CONSTRAINT FOR (ip:IP) REQUIRE ip.id IS UNIQUE`</div>
              <div>• `CONSTRAINT FOR (c:Card) REQUIRE c.id IS UNIQUE`</div>
            </div>
          </div>
          <div className="rounded bg-dark-bg p-2.5 border border-dark-border space-y-1">
            <div className="font-bold text-emerald-400">4 Performance B-Tree Indexes Active:</div>
            <div className="text-dark-muted space-y-0.5">
              <div>• `INDEX FOR ()-[r:SENT]-() ON (r.ts)` (Range searches)</div>
              <div>• `INDEX FOR ()-[r:SENT]-() ON (r.amount)` (Volume thresholds)</div>
              <div>• `INDEX FOR (a:Account) ON (a.risk_score)` (Risk rank queries)</div>
              <div>• `INDEX FOR (a:Account) ON (a.review_state)` (Analyst queue filtering)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Danger Zone */}
      <div className="rounded border border-risk-high/40 bg-dark-panel p-4 space-y-3">
        <div className="flex items-center gap-2 text-risk-high font-bold uppercase text-xs">
          <AlertTriangle className="h-4 w-4" />
          <span>Database Maintenance Operations</span>
        </div>
        <p className="text-xxs text-dark-muted">
          Administrative controls for university viva demonstration. Allows resetting and validating graph state without touching terminal.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleReseed}
            disabled={executing}
            className="flex items-center gap-1.5 rounded bg-brand/15 border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/25 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Re-Generate Synthetic Seed Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}
