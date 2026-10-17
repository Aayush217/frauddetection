"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
  ArrowRight,
} from "lucide-react";
import { api, Account } from "@/lib/api";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reviewState, setReviewState] = useState<string>("");
  const [minRisk, setMinRisk] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const limit = 25;

  // Selected account for right drawer
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.getAccounts({
        limit,
        skip: page * limit,
        search: search.trim() || undefined,
        review_state: reviewState || undefined,
        min_risk: minRisk,
      });
      setAccounts(res.accounts || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [page, reviewState, minRisk]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchAccounts();
  };

  const handleReviewAction = async (newState: string) => {
    if (!selectedAccount) return;
    try {
      setUpdating(true);
      const updated = await api.updateAccountReview(selectedAccount.id, newState, reviewNotes);
      setSelectedAccount(updated);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setReviewNotes("");
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-2.5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-dark-text">
            Accounts Registry ({total.toLocaleString()})
          </span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-dark-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ACC_ID or user hash..."
              className="h-7 w-60 rounded border border-dark-border bg-dark-bg pl-8 pr-2.5 font-mono text-xs text-dark-text outline-none focus:border-brand"
            />
          </div>

          <select
            value={reviewState}
            onChange={(e) => {
              setReviewState(e.target.value);
              setPage(0);
            }}
            className="h-7 rounded border border-dark-border bg-dark-bg px-2 font-mono text-xs text-dark-text outline-none focus:border-brand"
          >
            <option value="">All Review States</option>
            <option value="PENDING">PENDING</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>

          <select
            value={minRisk === undefined ? "" : minRisk.toString()}
            onChange={(e) => {
              setMinRisk(e.target.value ? Number(e.target.value) : undefined);
              setPage(0);
            }}
            className="h-7 rounded border border-dark-border bg-dark-bg px-2 font-mono text-xs text-dark-text outline-none focus:border-brand"
          >
            <option value="">All Risk Tiers</option>
            <option value="70">Risk ≥ 70 (High)</option>
            <option value="40">Risk ≥ 40 (Medium)</option>
            <option value="20">Risk ≥ 20</option>
          </select>

          <button
            type="submit"
            className="h-7 rounded bg-brand/15 border border-brand/30 px-2.5 font-mono text-xs text-brand hover:bg-brand/25"
          >
            Filter
          </button>

          <button
            type="button"
            onClick={fetchAccounts}
            className="flex h-7 w-7 items-center justify-center rounded border border-dark-border bg-dark-panelElevated text-dark-muted hover:text-dark-text"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      {/* Main Table + Drawer Container */}
      <div className="relative flex flex-1 overflow-hidden rounded border border-dark-border bg-dark-panel">
        {/* Dense Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 z-10 border-b border-dark-border bg-dark-panelElevated shadow-sm">
              <tr className="dense-th text-dark-muted">
                <th className="px-3">Account ID</th>
                <th className="px-3">Owner Hash</th>
                <th className="px-3">Type</th>
                <th className="px-3">Risk Score</th>
                <th className="px-3">Status</th>
                <th className="px-3">Balance</th>
                <th className="px-3">Audit Reasons</th>
                <th className="px-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-dark-muted">
                    {loading ? "Loading accounts..." : "No matching accounts found."}
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const isSelected = selectedAccount?.id === acc.id;
                  const score = acc.risk_score;
                  const scoreBadge =
                    score >= 70
                      ? "text-risk-high bg-risk-high/10 border-risk-high/30"
                      : score >= 40
                      ? "text-risk-medium bg-risk-medium/10 border-risk-medium/30"
                      : "text-risk-low bg-risk-low/10 border-risk-low/30";

                  return (
                    <tr
                      key={acc.id}
                      onClick={() => setSelectedAccount(acc)}
                      className={`dense-tr cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-brand/10 border-l-2 border-brand"
                          : "hover:bg-dark-panelElevated/50"
                      }`}
                    >
                      <td className="px-3 font-semibold text-dark-text">{acc.id}</td>
                      <td className="px-3 text-xxs text-dark-muted truncate max-w-[130px]">
                        {acc.user_id}
                      </td>
                      <td className="px-3 text-xxs uppercase text-dark-muted">{acc.account_type}</td>
                      <td className="px-3">
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.2 text-xxs font-bold ${scoreBadge}`}>
                          {score}
                        </span>
                      </td>
                      <td className="px-3 text-xxs">
                        <span
                          className={`font-semibold ${
                            acc.review_state === "BLOCKED"
                              ? "text-risk-high"
                              : acc.review_state === "APPROVED"
                              ? "text-emerald-400"
                              : "text-dark-muted"
                          }`}
                        >
                          {acc.review_state}
                        </span>
                      </td>
                      <td className="px-3 font-medium text-dark-text tabular-nums">
                        ${acc.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 text-xxs text-dark-muted truncate max-w-xs">
                        {acc.risk_reasons?.join(", ") || "-"}
                      </td>
                      <td className="px-3 text-right text-xxs text-dark-dim">
                        {acc.created_at?.slice(0, 10)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Inspection Drawer */}
        {selectedAccount && (
          <aside className="w-96 border-l border-dark-border bg-dark-panelElevated flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-150">
            {/* Drawer Header */}
            <div className="flex h-11 items-center justify-between border-b border-dark-border px-3 bg-dark-panel">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-dark-text">
                  {selectedAccount.id}
                </span>
                <span className="text-[10px] text-dark-muted font-mono uppercase">
                  Account Dossier
                </span>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="rounded p-1 text-dark-muted hover:text-dark-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
              {/* Risk Score Spotlight */}
              <div className="rounded border border-dark-border bg-dark-panel p-3">
                <div className="flex items-center justify-between text-dark-muted text-xxs uppercase tracking-wider">
                  <span>Graph Risk Assessment</span>
                  <span
                    className={`font-bold text-xs ${
                      selectedAccount.risk_score >= 70
                        ? "text-risk-high"
                        : selectedAccount.risk_score >= 40
                        ? "text-risk-medium"
                        : "text-risk-low"
                    }`}
                  >
                    {selectedAccount.risk_score} / 100
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-dark-border rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      selectedAccount.risk_score >= 70
                        ? "bg-risk-high"
                        : selectedAccount.risk_score >= 40
                        ? "bg-risk-medium"
                        : "bg-risk-low"
                    }`}
                    style={{ width: `${selectedAccount.risk_score}%` }}
                  />
                </div>
                <div className="mt-2 text-xxs text-dark-muted space-y-1">
                  <div className="font-semibold text-dark-text">Audit Explanations:</div>
                  {selectedAccount.risk_reasons && selectedAccount.risk_reasons.length > 0 ? (
                    selectedAccount.risk_reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-1 text-risk-medium">
                        <span>•</span>
                        <span>{r}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-dark-dim">Normal transaction baseline; no syndicate pattern flagged.</div>
                  )}
                </div>
              </div>

              {/* Account Meta */}
              <div className="rounded border border-dark-border bg-dark-panel p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-dark-muted">User SHA256 Hash:</span>
                  <span className="text-dark-text font-bold truncate max-w-[180px]">{selectedAccount.user_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-muted">Current Balance:</span>
                  <span className="text-dark-text font-bold tabular-nums">
                    ${selectedAccount.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-muted">Account Type:</span>
                  <span className="text-dark-text uppercase">{selectedAccount.account_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-muted">Current State:</span>
                  <span className="text-brand font-semibold">{selectedAccount.review_state}</span>
                </div>
              </div>

              {/* Review Actions */}
              <div className="rounded border border-dark-border bg-dark-panel p-3 space-y-2.5">
                <div className="font-mono text-xxs uppercase tracking-wider text-dark-muted">
                  Analyst Disposition
                </div>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Optional audit notes / SAR filing notes..."
                  className="w-full rounded border border-dark-border bg-dark-bg p-2 text-xxs text-dark-text outline-none focus:border-brand"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    disabled={updating}
                    onClick={() => handleReviewAction("APPROVED")}
                    className="flex items-center justify-center gap-1 rounded bg-emerald-950/60 border border-emerald-800/60 py-1 text-[10px] text-emerald-400 hover:bg-emerald-900/50"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>APPROVE</span>
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleReviewAction("UNDER_REVIEW")}
                    className="flex items-center justify-center gap-1 rounded bg-amber-950/60 border border-amber-800/60 py-1 text-[10px] text-amber-400 hover:bg-amber-900/50"
                  >
                    <Clock className="h-3 w-3" />
                    <span>REVIEW</span>
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleReviewAction("BLOCKED")}
                    className="flex items-center justify-center gap-1 rounded bg-rose-950/60 border border-rose-800/60 py-1 text-[10px] text-rose-400 hover:bg-rose-900/50"
                  >
                    <Ban className="h-3 w-3" />
                    <span>BLOCK</span>
                  </button>
                </div>
              </div>

              {/* Direct Canvas Pivot */}
              <Link
                href={`/investigate?account=${selectedAccount.id}`}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-brand/40 bg-brand/10 py-2 font-mono text-xs font-semibold text-brand hover:bg-brand/20 transition-colors"
              >
                <span>OPEN IN GRAPH CANVAS</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between font-mono text-xs text-dark-muted px-1">
        <span>
          Showing {accounts.length} of {total.toLocaleString()} accounts
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-dark-border bg-dark-panel px-2 py-0.5 text-dark-text hover:bg-dark-panelElevated disabled:opacity-40"
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-dark-border bg-dark-panel px-2 py-0.5 text-dark-text hover:bg-dark-panelElevated disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
