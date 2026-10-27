"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Search,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Send,
  X,
} from "lucide-react";
import { api, Transaction } from "@/lib/api";

export default function TransfersPage() {
  const searchParams = useSearchParams();
  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 35;

  // Filters
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [minAmount, setMinAmount] = useState<string>("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [newFrom, setNewFrom] = useState("acc_00083");
  const [newTo, setNewTo] = useState("acc_00084");
  const [newAmount, setNewAmount] = useState("14500");
  const [newNotes, setNewNotes] = useState("High-value suspicious wire transfer simulation");
  const [submitting, setSubmitting] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any>(null);

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setModalOpen(true);
    }
  }, [searchParams]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await api.getTransfers({
        limit,
        skip: page * limit,
        from_account: fromAccount.trim() || undefined,
        to_account: toAccount.trim() || undefined,
        min_amount: minAmount ? Number(minAmount) : undefined,
      });
      setTransfers(res.transfers || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error("Failed to load transfers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [page]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchTransfers();
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const res: any = await api.createTransfer({
        from_account_id: newFrom.trim(),
        to_account_id: newTo.trim(),
        amount: Number(newAmount),
        channel: "WIRE",
        notes: newNotes,
      });

      setCreatedResult(res);
      const isSuspicious = res.flagged ? " [SUSPICIOUS FLAGGED]" : " [NORMAL]";
      setModalSuccess(`Transfer ${res.transfer?.txn_id || ""} committed atomically to Neo4j${isSuspicious}.`);
      fetchTransfers();
    } catch (err: any) {
      setModalError(err.message || "Failed to commit transfer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Network Transfers Ledger ({total.toLocaleString()} Records)
            </h1>
            <p className="text-xs text-slate-500">
              Live transactional financial flow edges (:SENT) across the banking network
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              placeholder="Sender (acc_...)"
              className="h-9 w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white"
            />
            <input
              type="text"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              placeholder="Receiver (acc_...)"
              className="h-9 w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white"
            />
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="Min $ Amount"
              className="h-9 w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white"
            />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Filter
            </button>
          </form>

          <button
            onClick={() => setModalOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Simulate Transfer</span>
          </button>

          <button
            onClick={fetchTransfers}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Origin Account</th>
                <th className="py-3 px-4">Destination Account</th>
                <th className="py-3 px-4">Amount ($ USD)</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Loading transfer edges from graph...
                    </div>
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No transactions matching specified criteria.
                  </td>
                </tr>
              ) : (
                transfers.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {tx.id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                        {tx.from_account_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                        {tx.to_account_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold tabular-nums ${
                          tx.amount >= 10000 ? "text-rose-700 font-bold" : "text-slate-900"
                        }`}
                      >
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {tx.channel || "WIRE"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {tx.ts ? tx.ts.replace("T", " ").substring(0, 19) : "2026-10-18 12:00:00"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/investigate?account=${tx.from_account_id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-2xs"
                      >
                        Trace
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-card text-xs text-slate-600">
        <div>
          Showing page <span className="font-semibold text-slate-900">{page + 1}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalPages}</span> ({total.toLocaleString()} transactions)
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

      {/* New Transfer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Simulate Network Transfer</h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {modalError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Simulation Scenarios */}
            <div className="mt-4 border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Quick Simulation Scenarios (Existing Accounts)
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNewFrom("acc_00083");
                    setNewTo("acc_00084");
                    setNewAmount("15000");
                    setNewNotes("High-value suspicious wire transfer simulation");
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                >
                  High-Value ($15k)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewFrom("acc_00084");
                    setNewTo("acc_00083");
                    setNewAmount("4500");
                    setNewNotes("Rapid bounce-back reciprocation simulation");
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                >
                  Reciprocation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewFrom("acc_00085");
                    setNewTo("acc_00086");
                    setNewAmount("250");
                    setNewNotes("Routine retail checking transfer");
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Routine ($250)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTransfer} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Account ID</label>
                <input
                  type="text"
                  required
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  placeholder="e.g. acc_00083"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Account ID</label>
                <input
                  type="text"
                  required
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  placeholder="e.g. acc_00084"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Amount ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Notes / Rationale</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Forensic simulation notes"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              {createdResult && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-900">Neo4j Real-Time Evaluation:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        createdResult.flagged
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}
                    >
                      {createdResult.flagged ? "SUSPICIOUS FLAGGED" : "CLEAN TRANSFER"}
                    </span>
                  </div>
                  {createdResult.flag_reasons?.length > 0 && (
                    <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5">
                      {createdResult.flag_reasons.map((r: string, idx: number) => (
                        <li key={idx} className="text-rose-700 font-medium">{r}</li>
                      ))}
                    </ul>
                  )}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-500">ID: {createdResult.transfer?.txn_id}</span>
                    <Link
                      href={`/investigate?account=${createdResult.transfer?.from_account_id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      <span>Investigate in Canvas</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setCreatedResult(null);
                  }}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? "Committing..." : "Commit Transfer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
