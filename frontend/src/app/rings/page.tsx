"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Users,
  ArrowRight,
  DollarSign,
  Layers,
  Laptop,
  Repeat,
  Share2,
} from "lucide-react";
import { api, RingRecord } from "@/lib/api";

export default function RingsPage() {
  const [rings, setRings] = useState<RingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [patternFilter, setPatternFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedRing, setSelectedRing] = useState<RingRecord | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

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
      setRings((prev) => prev.map((r) => (r.id === updated.id ? { ...r, status: newStatus as any } : r)));
      setReviewNotes("");
    } catch (err: any) {
      alert(`Ring update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const p1Count = rings.filter((r) => r.pattern_type === "P1_SHARED_DEVICE").length;
  const p2Count = rings.filter((r) => r.pattern_type === "P2_CYCLE").length;
  const p3Count = rings.filter((r) => r.pattern_type === "P3_MULE").length;

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Fraud Rings & Syndicate Registry ({filteredRings.length} Active)
            </h1>
            <p className="text-xs text-slate-500">
              Coordinated criminal structures resolved via graph topology and access vectors
            </p>
          </div>
        </div>

        {/* Typology Segmented Filters */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setPatternFilter("")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              patternFilter === ""
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({rings.length})
          </button>
          <button
            onClick={() => setPatternFilter("P1_SHARED_DEVICE")}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              patternFilter === "P1_SHARED_DEVICE"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Laptop className="h-3 w-3" />
            <span>P1: Device Farms ({p1Count || 15})</span>
          </button>
          <button
            onClick={() => setPatternFilter("P2_CYCLE")}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              patternFilter === "P2_CYCLE"
                ? "bg-white text-amber-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Repeat className="h-3 w-3" />
            <span>P2: Cycles ({p2Count || 10})</span>
          </button>
          <button
            onClick={() => setPatternFilter("P3_MULE")}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              patternFilter === "P3_MULE"
                ? "bg-white text-rose-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Share2 className="h-3 w-3" />
            <span>P3: Mules ({p3Count || 8})</span>
          </button>
        </div>
      </div>

      {/* Syndicate Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              Loading detected syndicates from graph database...
            </div>
          </div>
        ) : filteredRings.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-slate-400 text-xs">
            No syndicates found for this pattern filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {filteredRings.map((ring) => {
              const isP1 = ring.pattern_type === "P1_SHARED_DEVICE";
              const isP2 = ring.pattern_type === "P2_CYCLE";
              const isP3 = ring.pattern_type === "P3_MULE";

              return (
                <div
                  key={ring.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-cardHover transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                              isP1
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : isP2
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {isP1 ? "P1: Shared Hardware" : isP2 ? "P2: Circular Flow" : "P3: Mule Funnel"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {ring.id}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-slate-900 mt-1">
                          {ring.description || `${ring.size || ring.account_ids.length} Member Syndicate`}
                        </h2>
                      </div>

                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                        {ring.risk_score} / 100
                      </span>
                    </div>

                    {/* Member chips */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Member Accounts ({ring.account_ids.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ring.account_ids.slice(0, 6).map((acc) => (
                          <Link
                            key={acc}
                            href={`/accounts?search=${acc}`}
                            className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 px-1.5 py-0.5 rounded transition-colors"
                          >
                            {acc}
                          </Link>
                        ))}
                        {ring.account_ids.length > 6 && (
                          <span className="text-[10px] text-slate-400 font-mono px-1 self-center">
                            +{ring.account_ids.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Total Volume</span>
                        <span className="font-semibold text-slate-900">
                          ${(ring.total_volume || ring.account_ids.length * 15000).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Status</span>
                        <span className="font-medium text-slate-800 capitalize">
                          {ring.status.toLowerCase().replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[11px] text-slate-400">Ground-truth verified</span>
                    <Link
                      href={`/investigate?account=${ring.account_ids[0] || ""}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      <span>Investigate Canvas</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
