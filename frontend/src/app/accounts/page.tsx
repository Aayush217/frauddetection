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
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Globe,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { api, Account } from "@/lib/api";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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
      setTotalPages(res.total_pages || 1);
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
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, review_state: newState as any } : a)));
      setReviewNotes("");
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Accounts Directory ({total.toLocaleString()} Records)
            </h1>
            <p className="text-xs text-slate-500">
              Direct access to account identities, linked devices, and risk scores
            </p>
          </div>
        </div>

        {/* Search & Filter Form */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ID (acc_...) or Name..."
              className="h-9 w-60 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <select
            value={reviewState}
            onChange={(e) => {
              setReviewState(e.target.value);
              setPage(0);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
          >
            <option value="">All Review States</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="under_review">Under Review</option>
            <option value="confirmed">Confirmed Fraud</option>
            <option value="false_positive">False Positive</option>
          </select>

          <select
            value={minRisk === undefined ? "" : minRisk.toString()}
            onChange={(e) => {
              const val = e.target.value;
              setMinRisk(val === "" ? undefined : Number(val));
              setPage(0);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
          >
            <option value="">All Risk Tiers</option>
            <option value="70">High Risk (≥ 70)</option>
            <option value="40">Medium Risk (≥ 40)</option>
            <option value="0">All Scores (≥ 0)</option>
          </select>

          <button
            type="submit"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            Filter
          </button>

          <button
            type="button"
            onClick={fetchAccounts}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      {/* Main Table + Slide-over Drawer Container */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card">
        {/* Table View */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Account ID</th>
                <th className="py-3 px-4">Owner Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Review State</th>
                <th className="py-3 px-4">Connections</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Loading accounts from graph...
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No accounts matching query filters.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const isHigh = acc.risk_score >= 70;
                  const isMed = acc.risk_score >= 40;
                  return (
                    <tr
                      key={acc.id}
                      onClick={() => setSelectedAccount(acc)}
                      className={`cursor-pointer transition-colors ${
                        selectedAccount?.id === acc.id ? "bg-indigo-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {acc.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {acc.user_name || "Unknown Identity"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 capitalize">
                          {acc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                            isHigh
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : isMed
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {acc.risk_score}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 capitalize">
                          {acc.review_state.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span title="Devices">{acc.device_count || 1} dev</span>
                          <span>•</span>
                          <span title="Transfers sent">{acc.sent_count || 0} sent</span>
                          <span>•</span>
                          <span title="Transfers received">{acc.received_count || 0} recv</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/investigate?account=${acc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-2xs"
                        >
                          Canvas
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Slide-over Investigation Dossier Drawer */}
        {selectedAccount && (
          <div className="w-96 border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col justify-between shadow-elevated z-20 animate-in slide-in-from-right-4 duration-150">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Account Dossier
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                    {selectedAccount.id}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Risk Score Pill */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Fraud Risk Score</span>
                  <span
                    className={`text-base font-bold px-2 py-0.5 rounded-full ${
                      selectedAccount.risk_score >= 70
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {selectedAccount.risk_score} / 100
                  </span>
                </div>
                {selectedAccount.risk_reasons && selectedAccount.risk_reasons.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Risk Drivers:</span>
                    {selectedAccount.risk_reasons.map((r, i) => (
                      <div key={i} className="text-xs font-medium text-rose-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ownership & Identity */}
              <div className="space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Legal Ownership
                </span>
                <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Legal Name:</span>
                    <span className="font-semibold text-slate-900">{selectedAccount.user_name || "Verified Individual"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">User ID:</span>
                    <span className="font-mono text-slate-700">{selectedAccount.user_id || "usr_synthetic"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Type:</span>
                    <span className="font-medium text-slate-900">{selectedAccount.account_type || "CHECKING"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estimated Balance:</span>
                    <span className="font-semibold text-emerald-600">${Number(selectedAccount.balance || 25000).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Review Decision Controls */}
              <div className="space-y-2 text-xs pt-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Analyst Review Action
                </span>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter audit rationale for review decision..."
                  className="w-full h-16 rounded-lg border border-slate-200 p-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleReviewAction("confirmed")}
                    disabled={updating}
                    className="flex items-center justify-center gap-1 rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    Confirm Fraud
                  </button>
                  <button
                    onClick={() => handleReviewAction("false_positive")}
                    disabled={updating}
                    className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    Clear (False +)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                href={`/investigate?account=${selectedAccount.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <span>Open in Investigation Canvas</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-card text-xs text-slate-600">
        <div>
          Showing page <span className="font-semibold text-slate-900">{page + 1}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalPages}</span> ({total.toLocaleString()} accounts)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page + 1 >= totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
