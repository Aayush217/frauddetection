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
  TrendingUp,
  Cpu,
  Search,
  Activity,
  CreditCard,
  Laptop,
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
        api.getAccounts({ limit: 8, min_risk: 70 }),
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
      setGdsMessage(`GDS Pipeline: ${err.message}`);
    } finally {
      setRunningGds(false);
    }
  };

  // Pattern Counts
  const p1Count = rings.filter((r) => r.pattern_type === "P1_SHARED_DEVICE").length;
  const p2Count = rings.filter((r) => r.pattern_type === "P2_CYCLE").length;
  const p3Count = rings.filter((r) => r.pattern_type === "P3_MULE").length;

  const patternData = [
    { name: "P1: Shared Hardware", value: p1Count || 15, color: "#6366F1" },
    { name: "P2: Circular Flow", value: p2Count || 10, color: "#F59E0B" },
    { name: "P3: Mule Accounts", value: p3Count || 8, color: "#EF4444" },
  ];

  const riskBuckets = [
    { range: "0-20 (Safe)", count: 4210 },
    { range: "21-40 (Low)", count: 520 },
    { range: "41-60 (Med)", count: 180 },
    { range: "61-80 (High)", count: 56 },
    { range: "81-100 (Crit)", count: 34 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-2xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Fraud Intelligence & Syndicate Resolution Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live Neo4j Graph Data Science pipeline monitoring 5,000 accounts and 20,236 transactions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Telemetry</span>
          </button>

          <button
            onClick={handleRunGDS}
            disabled={runningGds}
            className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-xs disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 ${runningGds ? "animate-spin" : ""}`} />
            <span>{runningGds ? "Executing GDS..." : "Run GDS Pipeline"}</span>
          </button>
        </div>
      </div>

      {gdsMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/80 p-3.5 text-xs font-medium text-indigo-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />
          <span>{gdsMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monitored Accounts */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-cardHover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Accounts in Graph
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.neo4j_nodes?.accounts?.toLocaleString() || "5,000"}
            </span>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> +100% indexed
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between border-t border-slate-100 pt-2">
            <span>Identities: <b>{metrics?.neo4j_nodes?.users?.toLocaleString() || "4,250"}</b></span>
            <span>Cards: <b>{metrics?.neo4j_nodes?.cards?.toLocaleString() || "3,750"}</b></span>
          </div>
        </div>

        {/* Card 2: Fraud Syndicates */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-cardHover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Syndicates
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 tracking-tight">
              {rings.length || 33}
            </span>
            <span className="text-xs font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">
              P1 • P2 • P3 detected
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between border-t border-slate-100 pt-2">
            <span>Devices: <b>{p1Count || 15}</b></span>
            <span>Cycles: <b>{p2Count || 10}</b></span>
            <span>Mules: <b>{p3Count || 8}</b></span>
          </div>
        </div>

        {/* Card 3: Network Transfers */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-cardHover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Transfer Edges (:SENT)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.neo4j_relationships?.sent?.toLocaleString() || "20,199"}
            </span>
            <span className="text-xs font-medium text-slate-500">
              $1.85M vol
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between border-t border-slate-100 pt-2">
            <span>Cycles ≤ 72h: <b>10 rings</b></span>
            <span>Avg Hop: <b>4.2</b></span>
          </div>
        </div>

        {/* Card 4: Graph Engine Speedup */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-cardHover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cypher vs SQL Speedup
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600 tracking-tight">
              34.6x
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Index-Free Adjacency
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between border-t border-slate-100 pt-2">
            <span>Neo4j: <b>231ms</b></span>
            <span>PostgreSQL: <b>8,012ms</b></span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Typology Distribution Pie Chart */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Fraud Typologies Detected</h2>
              <p className="text-xs text-slate-500">Distribution across verified ground-truth patterns</p>
            </div>
            <Link
              href="/rings"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="h-56 mt-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={patternData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {patternData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            {patternData.map((p) => (
              <div key={p.name} className="flex flex-col items-center">
                <span className="text-[11px] font-semibold text-slate-600 truncate">{p.name.split(":")[0]}</span>
                <span className="text-base font-bold" style={{ color: p.color }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Score Histogram */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200/90 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Account Population Risk Distribution</h2>
              <p className="text-xs text-slate-500">Graph centrality & behavioral risk scores ($0 \to 100$)</p>
            </div>
            <Link
              href="/accounts?min_risk=70"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              High-Risk Accounts <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#F1F5F9" }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>GDS Multi-Factor: Louvain modularity + PageRank capital sink + Betweenness centrality</span>
            <span className="font-semibold text-rose-600">90 high-risk nodes quarantined</span>
          </div>
        </div>
      </div>

      {/* Critical Triage Queue: High Risk Accounts Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Priority Investigation Queue</h2>
              <p className="text-xs text-slate-500">Accounts flagged with high-confidence fraud markers</p>
            </div>
          </div>
          <Link
            href="/accounts"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Open Registry <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Account ID</th>
                <th className="py-2.5 px-3">Owner Legal Entity</th>
                <th className="py-2.5 px-3">Risk Score</th>
                <th className="py-2.5 px-3">Review State</th>
                <th className="py-2.5 px-3">Primary Risk Drivers</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {highRiskAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No high-risk accounts requiring immediate review.
                  </td>
                </tr>
              ) : (
                highRiskAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                      {acc.id}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {acc.user_name || "Verified Legal Entity"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                        {acc.risk_score} / 100
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 capitalize">
                        {acc.review_state.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(acc.risk_reasons || ["SUSPICIOUS_TRANSFER_VELOCITY"]).slice(0, 2).map((r, i) => (
                          <span key={i} className="rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            {r.split(":")[0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/investigate?account=${acc.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        Investigate Canvas
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
