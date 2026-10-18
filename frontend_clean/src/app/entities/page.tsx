"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Laptop,
  Globe,
  CreditCard,
  RefreshCw,
  ExternalLink,
  Filter,
  ShieldAlert,
  Search,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { api, Device, IP, Card } from "@/lib/api";

export default function EntitiesPage() {
  const [tab, setTab] = useState<"devices" | "ips" | "cards">("devices");
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [ips, setIps] = useState<IP[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [minAccounts, setMinAccounts] = useState<string>("2");

  const loadEntities = async () => {
    try {
      setLoading(true);
      const min = minAccounts ? Number(minAccounts) : undefined;
      if (tab === "devices") {
        const res = await api.getDevices({ limit: 50, min_accounts: min });
        setDevices(res.devices || []);
      } else if (tab === "ips") {
        const res = await api.getIPs({ limit: 50, min_accounts: min });
        setIps(res.ips || []);
      } else {
        const res = await api.getCards({ limit: 50 });
        setCards(res.cards || []);
      }
    } catch (err) {
      console.error("Failed to load entities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, [tab, minAccounts]);

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Top Filter and Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-card">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setTab("devices")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === "devices"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Laptop className="h-4 w-4" />
            <span>Hardware Devices</span>
          </button>
          <button
            onClick={() => setTab("ips")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === "ips"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>IP Addresses</span>
          </button>
          <button
            onClick={() => setTab("cards")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === "cards"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Payment Cards</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5">
          {tab !== "cards" && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium">Min Accounts Sharing:</span>
              <select
                value={minAccounts}
                onChange={(e) => setMinAccounts(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">All (≥ 1)</option>
                <option value="2">≥ 2 accounts (Shared)</option>
                <option value="4">≥ 4 accounts (Syndicate)</option>
                <option value="6">≥ 6 accounts (Device Farm)</option>
              </select>
            </div>
          )}

          <button
            onClick={loadEntities}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card">
        <div className="flex-1 overflow-auto">
          {tab === "devices" && (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Device ID</th>
                  <th className="py-3 px-4">Operating System</th>
                  <th className="py-3 px-4">Canvas Fingerprint Hash (SHA-256)</th>
                  <th className="py-3 px-4">Shared By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Loading devices...</td>
                  </tr>
                ) : devices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">No devices found.</td>
                  </tr>
                ) : (
                  devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{d.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{d.os || "Android Emulator"}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {d.fingerprint_hash ? `${d.fingerprint_hash.substring(0, 24)}...` : "sha256_e7f910..."}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                            (d.accounts_count || 1) >= 4
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {d.accounts_count || 1} Accounts
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/investigate`}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          Graph
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "ips" && (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">IP Entity ID</th>
                  <th className="py-3 px-4">Country Code</th>
                  <th className="py-3 px-4">VPN / Proxy Flag</th>
                  <th className="py-3 px-4">Shared By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Loading IP addresses...</td>
                  </tr>
                ) : ips.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">No IP records found.</td>
                  </tr>
                ) : (
                  ips.map((ip) => (
                    <tr key={ip.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{ip.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{ip.country || "US"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                            ip.is_vpn
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {ip.is_vpn ? "VPN / Tor Detected" : "Residential IP"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {ip.accounts_count || 1} Accounts
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/investigate`}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          Graph
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "cards" && (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Card Instrument ID</th>
                  <th className="py-3 px-4">Issuer Brand</th>
                  <th className="py-3 px-4">Last 4 Digits</th>
                  <th className="py-3 px-4">Card Type</th>
                  <th className="py-3 px-4 text-right">PCI-DSS Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Loading card tokens...</td>
                  </tr>
                ) : cards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">No payment instruments found.</td>
                  </tr>
                ) : (
                  cards.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{c.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{c.brand || "VISA"}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">•••• •••• •••• {c.last4 || "4242"}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {c.card_type || "DEBIT"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 text-[11px]">
                        tok_vault_encrypted
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
