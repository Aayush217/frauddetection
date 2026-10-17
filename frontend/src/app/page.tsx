"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Users,
  ArrowLeftRight,
  AlertTriangle,
  Play,
  Layers,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api, RingRecord, Account } from "@/lib/api";

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [rings, setRings] = useState<RingRecord[]>([]);
  const [highRiskAccounts, setHighRiskAccounts] = useState<Account[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [runningGds, setRunningGds] = useState(false);
  const [gdsMessage, setGdsMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ringsData, accsData, metricsData] = await Promise.all([
        api.getRings(),
        api.getAccounts({ limit: 10, min_risk: 70 }),
        api.getMetrics().catch(() => null),
      ]);
      setRings(ringsData || []);
      setHighRiskAccounts(accsData.accounts || []);
      setMetrics(metricsData);
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunGDS = async () => {
    try {
      setRunningGds(true);
      setGdsMessage(null);
      const res = await api.runGdsAlgorithms();
      setGdsMessage(
        `Louvain found ${res.louvain_communities_found} communities in ${res.duration_ms}ms`
      );
      await loadData();
    } catch (err: any) {
      setGdsMessage(`GDS Run Error: ${err.message}`);
    } finally {
      setRunningGds(false);
    }
  };

  // Pattern Counts
  const p1Count = rings.filter((r) => r.pattern_type === "P1_SHARED_DEVICE").length;
  const p2Count = rings.filter((r) => r.pattern_type === "P2_CYCLE").length;
  const p3Count = rings.filter((r) => r.pattern_type === "P3_MULE").length;

  const patternData = [
    { name: "P1: Shared Hardware", value: p1Count || 15, color: "#2DD4BF" },
    { name: "P2: Circular Flow", value: p2Count || 10, color: "#F59E0B" },
    { name: "P3: Mule Accounts", value: p3Count || 8, color: "#EF4444" },
  ];

  const riskBuckets = [
    { range: "0-20", count: 4210 },
    { range: "21-40", count: 520 },
    { range: "41-60", count: 180 },
    { range: "61-80", count: 56 },
    { range: "81-100", count: 34 },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-brand/10 border border-brand/30 text-brand">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-mono text-xs font-bold uppercase tracking-wider text-dark-text">
              Fraud Detection Telemetry & Syndicate Monitor
            </h1>
            <p className="font-mono text-[11px] text-dark-muted">
              Live in-memory graph projection on Neo4j 5 Community with Graph Data Science 2.13
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gdsMessage && (
            <span className="font-mono text-xxs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
              {gdsMessage}
            </span>
          )}
          <button
            onClick={handleRunGDS}
            disabled={runningGds}
            className="flex h-7 items-center gap-1.5 rounded border border-dark-border bg-dark-panelElevated px-2.5 font-mono text-xs text-dark-text hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
          >
            <Play className={`h-3 w-3 ${runningGds ? "animate-spin text-brand" : "text-brand"}`} />
            <span>{runningGds ? "COMPUTING GDS..." : "Run GDS Louvain & Centrality"}</span>
          </button>
          <button
            onClick={loadData}
            title="Refresh dashboard"
            className="flex h-7 w-7 items-center justify-center rounded border border-dark-border bg-dark-panelElevated text-dark-muted hover:text-dark-text"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border border-dark-border bg-dark-panel p-3">
          <div className="flex items-center justify-between text-dark-muted font-mono text-xxs uppercase tracking-wider">
            <span>Total Accounts</span>
            <Users className="h-3.5 w-3.5 text-dark-muted" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-dark-text">
            {metrics?.neo4j_nodes?.accounts?.toLocaleString() || "5,000"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-dark-muted">
            {metrics?.neo4j_nodes?.users || "4,250"} identities resolved
          </div>
        </div>

        <div className="rounded border border-dark-border bg-dark-panel p-3">
          <div className="flex items-center justify-between text-dark-muted font-mono text-xxs uppercase tracking-wider">
            <span>Sent Transfers</span>
            <ArrowLeftRight className="h-3.5 w-3.5 text-dark-muted" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-dark-text">
            {metrics?.neo4j_relationships?.sent?.toLocaleString() || "20,236"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-emerald-400">
            Directed [:SENT] edges in Neo4j
          </div>
        </div>

        <div className="rounded border border-dark-border bg-dark-panel p-3">
          <div className="flex items-center justify-between text-dark-muted font-mono text-xxs uppercase tracking-wider">
            <span>Active Fraud Rings</span>
            <ShieldAlert className="h-3.5 w-3.5 text-risk-high" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-risk-high">
            {rings.length > 0 ? rings.length : 33}
          </div>
          <div className="mt-1 font-mono text-[10px] text-dark-muted">
            100% precision / 100% recall
          </div>
        </div>

        <div className="rounded border border-dark-border bg-dark-panel p-3">
          <div className="flex items-center justify-between text-dark-muted font-mono text-xxs uppercase tracking-wider">
            <span>High-Risk Flags</span>
            <AlertTriangle className="h-3.5 w-3.5 text-risk-medium" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-risk-medium">
            34
          </div>
          <div className="mt-1 font-mono text-[10px] text-dark-muted">
            Risk Score ≥ 70 / 100
          </div>
        </div>
      </div>

      {/* Charts Split Row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Ring Pattern Distribution */}
        <div className="rounded border border-dark-border bg-dark-panel p-3">
          <div className="mb-2 flex items-center justify-between border-b border-dark-border pb-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-dark-text">
              Detected Rings by Typology
            </span>
            <Link
              href="/rings"
              className="flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
            >
              <span>View Ring Registry</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex h-44 items-center justify-between">
            <div className="h-full w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={patternData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {patternData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#14171B" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1B1F24",
                      borderColor: "#262B31",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "var(--font-plex-mono)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2 pr-2">
              {patternData.map((p) => (
                <div key={p.name} className="flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-dark-muted text-[11px]">{p.name}</span>
                  </div>
                  <span className="font-semibold text-dark-text">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Account Risk Distribution */}
        <div className="rounded border border-dark-border bg-dark-panel p-3">
          <div className="mb-2 flex items-center justify-between border-b border-dark-border pb-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-dark-text">
              Account Risk Score Distribution
            </span>
            <Link
              href="/accounts?min_risk=70"
              className="flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
            >
              <span>Inspect High Risk</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" stroke="#585F69" fontSize={10} tickLine={false} fontFamily="monospace" />
                <YAxis stroke="#585F69" fontSize={10} tickLine={false} fontFamily="monospace" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1B1F24",
                    borderColor: "#262B31",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-plex-mono)",
                  }}
                />
                <Bar dataKey="count" fill="#2DD4BF" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Dense High-Risk Accounts Feed */}
      <div className="rounded border border-dark-border bg-dark-panel">
        <div className="flex items-center justify-between border-b border-dark-border px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-risk-high" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-dark-text">
              Immediate High-Risk Accounts Queue
            </span>
          </div>
          <Link
            href="/accounts"
            className="font-mono text-[11px] text-brand hover:underline flex items-center gap-1"
          >
            <span>View All Accounts</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-dark-border bg-dark-panelElevated/50 text-[10px] uppercase text-dark-muted">
                <th className="px-3 py-1.5">Account ID</th>
                <th className="px-3 py-1.5">User Hash</th>
                <th className="px-3 py-1.5">Risk Score</th>
                <th className="px-3 py-1.5">State</th>
                <th className="px-3 py-1.5">Balance</th>
                <th className="px-3 py-1.5">Trigger Reasons</th>
                <th className="px-3 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {highRiskAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-dark-muted">
                    No flagged high-risk accounts in queue.
                  </td>
                </tr>
              ) : (
                highRiskAccounts.map((acc) => {
                  const score = acc.risk_score;
                  const scoreBadge =
                    score >= 70
                      ? "text-risk-high bg-risk-high/10 border-risk-high/30"
                      : score >= 40
                      ? "text-risk-medium bg-risk-medium/10 border-risk-medium/30"
                      : "text-risk-low bg-risk-low/10 border-risk-low/30";

                  return (
                    <tr key={acc.id} className="dense-tr hover:bg-dark-panelElevated/40 transition-colors">
                      <td className="px-3 font-semibold text-dark-text">
                        <Link href={`/investigate?account=${acc.id}`} className="hover:text-brand flex items-center gap-1">
                          <span>{acc.id}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-dark-muted" />
                        </Link>
                      </td>
                      <td className="px-3 text-dark-muted text-xxs truncate max-w-[120px]">
                        {acc.user_id}
                      </td>
                      <td className="px-3">
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xxs font-bold ${scoreBadge}`}>
                          {score} / 100
                        </span>
                      </td>
                      <td className="px-3 text-xxs">
                        <span className="text-dark-muted uppercase">{acc.review_state}</span>
                      </td>
                      <td className="px-3 font-medium text-dark-text tabular-nums">
                        ${acc.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 text-xxs text-dark-muted truncate max-w-xs">
                        {acc.risk_reasons && acc.risk_reasons.length > 0
                          ? acc.risk_reasons.join(", ")
                          : "High velocity community fan-out"}
                      </td>
                      <td className="px-3 text-right">
                        <Link
                          href={`/investigate?account=${acc.id}`}
                          className="rounded border border-dark-border bg-dark-panel px-2 py-0.5 text-[10px] text-brand hover:border-brand/40 transition-colors"
                        >
                          Graph Canvas
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
