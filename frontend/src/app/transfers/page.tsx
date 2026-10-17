"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { api, Transaction } from "@/lib/api";

export default function TransfersPage() {
  const searchParams = useSearchParams();
  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 30;

  // Filters
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [minAmount, setMinAmount] = useState<string>("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [newFrom, setNewFrom] = useState("ACC_000001");
  const [newTo, setNewTo] = useState("ACC_000002");
  const [newAmount, setNewAmount] = useState("2500");
  const [newChannel, setNewChannel] = useState("WIRE");
  const [newNotes, setNewNotes] = useState("Layering test payment");
  const [submitting, setSubmitting] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

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
    } catch (err) {
      console.error("Failed to fetch transfers:", err);
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
      const res = await api.createTransfer({
        from_account_id: newFrom.trim(),
        to_account_id: newTo.trim(),
        amount: Number(newAmount),
        channel: newChannel,
        notes: newNotes,
      });
      setModalSuccess(`Transfer executed: ${res.id} for $${res.amount}`);
      fetchTransfers();
      setTimeout(() => {
        setModalOpen(false);
        setModalSuccess(null);
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-3 font-mono">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-2.5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-wider text-dark-text">
            Transaction Ledger ({total.toLocaleString()} Directed Edges)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleFilterSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              placeholder="From ACC_..."
              className="h-7 w-28 rounded border border-dark-border bg-dark-bg px-2 text-xs text-dark-text outline-none focus:border-brand"
            />
            <input
              type="text"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              placeholder="To ACC_..."
              className="h-7 w-28 rounded border border-dark-border bg-dark-bg px-2 text-xs text-dark-text outline-none focus:border-brand"
            />
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="Min $"
              className="h-7 w-24 rounded border border-dark-border bg-dark-bg px-2 text-xs text-dark-text outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="h-7 rounded bg-brand/15 border border-brand/30 px-2.5 text-xs text-brand hover:bg-brand/25"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={fetchTransfers}
              className="flex h-7 w-7 items-center justify-center rounded border border-dark-border bg-dark-panelElevated text-dark-muted hover:text-dark-text"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </form>

          <button
            onClick={() => setModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded bg-brand px-3 text-xs font-medium text-dark-bg hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Transfer</span>
          </button>
        </div>
      </div>

      {/* Dense Ledger Table */}
      <div className="flex-1 overflow-auto rounded border border-dark-border bg-dark-panel">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-dark-border bg-dark-panelElevated shadow-sm">
            <tr className="dense-th text-dark-muted">
              <th className="px-3">Transfer ID</th>
              <th className="px-3">From Account</th>
              <th className="px-3">To Account</th>
              <th className="px-3">Amount (USD)</th>
              <th className="px-3">Channel</th>
              <th className="px-3">Timestamp (UTC)</th>
              <th className="px-3">Notes</th>
              <th className="px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-dark-muted">
                  {loading ? "Loading ledger..." : "No matching transactions found."}
                </td>
              </tr>
            ) : (
              transfers.map((tx) => (
                <tr key={tx.id} className="dense-tr hover:bg-dark-panelElevated/50 transition-colors">
                  <td className="px-3 font-semibold text-dark-text truncate max-w-[120px]">{tx.id}</td>
                  <td className="px-3 text-brand">
                    <Link href={`/investigate?account=${tx.from_account_id}`} className="hover:underline">
                      {tx.from_account_id}
                    </Link>
                  </td>
                  <td className="px-3 text-brand">
                    <Link href={`/investigate?account=${tx.to_account_id}`} className="hover:underline">
                      {tx.to_account_id}
                    </Link>
                  </td>
                  <td className="px-3 font-bold text-dark-text tabular-nums">
                    ${tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3">
                    <span className="rounded bg-dark-panelElevated border border-dark-border px-1.5 py-0.5 text-xxs text-dark-muted">
                      {tx.channel || "WIRE"}
                    </span>
                  </td>
                  <td className="px-3 text-xxs text-dark-muted">
                    {tx.ts ? tx.ts.replace("T", " ").slice(0, 19) : "-"}
                  </td>
                  <td className="px-3 text-xxs text-dark-dim truncate max-w-xs">{tx.notes || "-"}</td>
                  <td className="px-3 text-right">
                    <Link
                      href={`/investigate?from=${tx.from_account_id}&to=${tx.to_account_id}`}
                      className="rounded border border-dark-border bg-dark-panel px-1.5 py-0.5 text-[10px] text-brand hover:border-brand/40"
                    >
                      Canvas
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-dark-muted px-1">
        <span>
          Showing {transfers.length} of {total.toLocaleString()} transactions
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

      {/* New Transfer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded border border-dark-border bg-dark-panel p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-brand" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-dark-text">
                  Execute Atomic Directed Transfer
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-dark-muted hover:text-dark-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-3 flex items-center gap-2 rounded border border-risk-high/40 bg-risk-high/10 p-2 text-xxs text-risk-high">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-3 flex items-center gap-2 rounded border border-emerald-800/40 bg-emerald-950/40 p-2 text-xxs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="space-y-3">
              <div>
                <label className="block text-xxs font-semibold uppercase text-dark-muted mb-1">
                  Origin Account ID
                </label>
                <input
                  type="text"
                  required
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  className="w-full rounded border border-dark-border bg-dark-bg px-2.5 py-1.5 text-xs text-dark-text outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xxs font-semibold uppercase text-dark-muted mb-1">
                  Beneficiary Account ID
                </label>
                <input
                  type="text"
                  required
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  className="w-full rounded border border-dark-border bg-dark-bg px-2.5 py-1.5 text-xs text-dark-text outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs font-semibold uppercase text-dark-muted mb-1">
                    Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full rounded border border-dark-border bg-dark-bg px-2.5 py-1.5 text-xs text-dark-text outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-semibold uppercase text-dark-muted mb-1">
                    Channel
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    className="w-full rounded border border-dark-border bg-dark-bg px-2 py-1.5 text-xs text-dark-text outline-none focus:border-brand"
                  >
                    <option value="WIRE">WIRE</option>
                    <option value="ACH">ACH</option>
                    <option value="P2P">P2P</option>
                    <option value="ATM">ATM</option>
                    <option value="CRYPTO">CRYPTO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xxs font-semibold uppercase text-dark-muted mb-1">
                  Audit Notes
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded border border-dark-border bg-dark-bg px-2.5 py-1.5 text-xs text-dark-text outline-none focus:border-brand"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-dark-border bg-dark-panelElevated px-3 py-1.5 text-xs text-dark-muted hover:text-dark-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded bg-brand px-4 py-1.5 text-xs font-semibold text-dark-bg hover:bg-brand-hover disabled:opacity-50"
                >
                  {submitting ? "EXECUTING..." : "COMMIT TRANSFER"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
