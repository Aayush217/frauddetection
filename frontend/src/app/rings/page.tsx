"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Network,
  RotateCw,
  ChevronRight,
} from "lucide-react";
import { api, RingRecord } from "@/lib/api";

export default function RingsPage() {
  const [rings, setRings] = useState<RingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [patternFilter, setPatternFilter] = useState<string>("");
  const [selectedRing, setSelectedRing] = useState<RingRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchRings = async () => {
    try {
      setLoading(true);
      const res = await api.getRings(statusFilter || undefined);
      setRings(res || []);
    } catch (err) {
      console.error("Failed to load rings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRings();
  }, [statusFilter]);

  const filteredRings = rings.filter((r) => {
    if (patternFilter && r.pattern_type !== patternFilter) return false;
    return true;
  });

  const handleRingReview = async (newStatus: string) => {
    if (!selectedRing) return;
    try {
      setUpdating(true);
      const updated = await api.updateRingReview(selectedRing.id, newStatus, reviewNotes);
      setSelectedRing(updated);
      setRings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setReviewNotes("");
    } catch (err: any) {
      alert(`Ring update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-3 font-mono">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-risk-high" />
          <span className="text-xs font-bold uppercase tracking-wider text-dark-text">
            Fraud Rings Registry ({filteredRings.length} Active Syndicates)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={patternFilter}
            onChange={(e) => setPatternFilter(e.target.value)}
            className="h-7 rounded border border-dark-border bg-dark-bg px-2 text-xs text-dark-text outline-none focus:border-brand"
          >
            <option value="">All Typologies</option>
            <option value="P1_SHARED_DEVICE">P1: Shared Hardware / IP</option>
            <option value="P2_CYCLE">P2: Circular Layering</option>
            <option value="P3_MULE">P3: Mule Fan-In / Fan-Out</option>
            <option value="COMMUNITY">Louvain Graph Community</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-7 rounded border border-dark-border bg-dark-bg px-2 text-xs text-dark-text outline-none focus:border-brand"
          >
            <option value="">All Review Statuses</option>
            <option value="DETECTED">DETECTED</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
            <option value="CONFIRMED_FRAUD">CONFIRMED_FRAUD</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>

          <button
            onClick={fetchRings}
            className="flex h-7 w-7 items-center justify-center rounded border border-dark-border bg-dark-panelElevated text-dark-muted hover:text-dark-text"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table + Drawer Container */}
      <div className="relative flex flex-1 overflow-hidden rounded border border-dark-border bg-dark-panel">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-dark-border bg-dark-panelElevated shadow-sm">
              <tr className="dense-th text-dark-muted">
                <th className="px-3">Ring ID</th>
                <th className="px-3">Typology</th>
                <th className="px-3">Members</th>
                <th className="px-3">Risk Tier</th>
                <th className="px-3">Status</th>
                <th className="px-3">Key Metrics</th>
                <th className="px-3">Detection Timestamp</th>
                <th className="px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredRings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-dark-muted">
                    {loading ? "Loading syndicates..." : "No fraud rings match filter."}
                  </td>
                </tr>
              ) : (
                filteredRings.map((ring) => {
                  const isSelected = selectedRing?.id === ring.id;
                  const patternColor =
                    ring.pattern_type === "P1_SHARED_DEVICE"
                      ? "text-brand border-brand/30 bg-brand/10"
                      : ring.pattern_type === "P2_CYCLE"
                      ? "text-amber-400 border-amber-800/40 bg-amber-950/40"
                      : ring.pattern_type === "P3_MULE"
                      ? "text-rose-400 border-rose-800/40 bg-rose-950/40"
                      : "text-blue-400 border-blue-800/40 bg-blue-950/40";

                  return (
                    <tr
                      key={ring.id}
                      onClick={() => setSelectedRing(ring)}
                      className={`dense-tr cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-brand/10 border-l-2 border-brand"
                          : "hover:bg-dark-panelElevated/50"
                      }`}
                    >
                      <td className="px-3 font-semibold text-dark-text">{ring.id}</td>
                      <td className="px-3">
                        <span className={`inline-flex rounded border px-1.5 py-0.2 text-[10px] font-bold ${patternColor}`}>
                          {ring.pattern_type}
                        </span>
                      </td>
                      <td className="px-3 font-bold tabular-nums text-dark-text">
                        {ring.account_ids?.length || 0} accounts
                      </td>
                      <td className="px-3">
                        <span className="inline-flex rounded border border-risk-high/30 bg-risk-high/10 px-1.5 py-0.2 text-xxs font-bold text-risk-high">
                          {ring.risk_score || 95} / 100
                        </span>
                      </td>
                      <td className="px-3 text-xxs">
                        <span
                          className={`font-semibold ${
                            ring.status === "CONFIRMED_FRAUD"
                              ? "text-risk-high"
                              : ring.status === "UNDER_REVIEW"
                              ? "text-amber-400"
                              : "text-dark-muted"
                          }`}
                        >
                          {ring.status}
                        </span>
                      </td>
                      <td className="px-3 text-xxs text-dark-muted truncate max-w-xs">
                        {ring.metrics
                          ? Object.entries(ring.metrics)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" | ")
                          : "High density subgraph"}
                      </td>
                      <td className="px-3 text-xxs text-dark-dim">
                        {ring.detected_at?.slice(0, 16).replace("T", " ") || "2026-10-17 12:00"}
                      </td>
                      <td className="px-3 text-right">
                        <Link
                          href={`/investigate?ring=${ring.id}`}
                          className="rounded border border-dark-border bg-dark-panel px-2 py-0.5 text-[10px] text-brand hover:border-brand/40"
                        >
                          Open Canvas
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Drawer */}
        {selectedRing && (
          <aside className="w-96 border-l border-dark-border bg-dark-panelElevated flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-150">
            <div className="flex h-11 items-center justify-between border-b border-dark-border px-3 bg-dark-panel">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-dark-text">{selectedRing.id}</span>
                <span className="text-[10px] text-dark-muted uppercase">Syndicate Details</span>
              </div>
              <button
                onClick={() => setSelectedRing(null)}
                className="rounded p-1 text-dark-muted hover:text-dark-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Pattern Header */}
              <div className="rounded border border-dark-border bg-dark-panel p-3 space-y-1.5">
                <div className="text-xxs uppercase tracking-wider text-dark-muted">Pattern Classification</div>
                <div className="text-sm font-bold text-brand">{selectedRing.pattern_type}</div>
                <div className="text-xxs text-dark-muted">
                  {selectedRing.pattern_type === "P1_SHARED_DEVICE" &&
                    "Hardware fingerprint collision: Multiple accounts registered or transacting from single device/IP."}
                  {selectedRing.pattern_type === "P2_CYCLE" &&
                    "Circular fund routing: Closed loop of transfers returning to origin within 72h window."}
                  {selectedRing.pattern_type === "P3_MULE" &&
                    "Smurfing / Layering mule: High fan-in aggregation with rapid outbound dissipation."}
                </div>
              </div>

              {/* Member Accounts */}
              <div className="rounded border border-dark-border bg-dark-panel p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xxs uppercase tracking-wider text-dark-muted">Syndicate Members</span>
                  <span className="text-xxs text-brand">{selectedRing.account_ids?.length || 0} Accounts</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-dark-border">
                  {selectedRing.account_ids?.map((accId) => (
                    <div key={accId} className="flex justify-between items-center pt-1">
                      <span className="text-dark-text font-bold">{accId}</span>
                      <Link
                        href={`/investigate?account=${accId}`}
                        className="text-[10px] text-brand hover:underline flex items-center gap-0.5"
                      >
                        <span>Focus</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ring Metrics */}
              <div className="rounded border border-dark-border bg-dark-panel p-3 space-y-1.5">
                <div className="text-xxs uppercase tracking-wider text-dark-muted">Extracted Graph Metrics</div>
                {selectedRing.metrics && Object.keys(selectedRing.metrics).length > 0 ? (
                  <div className="space-y-1 text-xxs">
                    {Object.entries(selectedRing.metrics).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-dark-muted capitalize">{k.replace("_", " ")}:</span>
                        <span className="text-dark-text font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xxs text-dark-dim">No supplementary metric dictionary.</div>
                )}
              </div>

              {/* Disposition Action */}
              <div className="rounded border border-dark-border bg-dark-panel p-3 space-y-2">
                <div className="text-xxs uppercase tracking-wider text-dark-muted">Disposition</div>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Case notes / SAR filing justification..."
                  className="w-full rounded border border-dark-border bg-dark-bg p-2 text-xxs text-dark-text outline-none focus:border-brand"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={updating}
                    onClick={() => handleRingReview("CONFIRMED_FRAUD")}
                    className="flex items-center justify-center gap-1 rounded bg-rose-950/60 border border-rose-800/60 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-900/50"
                  >
                    <Ban className="h-3 w-3" />
                    <span>CONFIRM FRAUD</span>
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleRingReview("DISMISSED")}
                    className="flex items-center justify-center gap-1 rounded bg-dark-panelElevated border border-dark-border py-1.5 text-xs text-dark-muted hover:text-dark-text"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>DISMISS</span>
                  </button>
                </div>
              </div>

              {/* Canvas Button */}
              <Link
                href={`/investigate?ring=${selectedRing.id}`}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-brand/40 bg-brand/10 py-2 text-xs font-bold text-brand hover:bg-brand/20 transition-colors"
              >
                <span>VISUALIZE SYNDICATE ON GRAPH</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
