"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Laptop, Globe, CreditCard, RefreshCw, ExternalLink, Filter, ShieldAlert } from "lucide-react";
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
    <div className="flex h-full flex-col space-y-3 font-mono">
      {/* Top Filter and Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-2.5">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded border border-dark-border bg-dark-bg p-0.5">
          <button
            onClick={() => setTab("devices")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors ${
              tab === "devices"
                ? "bg-dark-panelElevated text-brand font-semibold shadow-sm"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            <Laptop className="h-3.5 w-3.5" />
            <span>Devices (Hardware)</span>
          </button>
          <button
            onClick={() => setTab("ips")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors ${
              tab === "ips"
                ? "bg-dark-panelElevated text-brand font-semibold shadow-sm"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>IP Addresses</span>
          </button>
          <button
            onClick={() => setTab("cards")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors ${
              tab === "cards"
                ? "bg-dark-panelElevated text-brand font-semibold shadow-sm"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {tab !== "cards" && (
            <div className="flex items-center gap-1.5 text-xs text-dark-muted">
              <span>Min Shared Accounts:</span>
              <select
                value={minAccounts}
                onChange={(e) => setMinAccounts(e.target.value)}
                className="h-7 rounded border border-dark-border bg-dark-bg px-2 text-xs text-dark-text outline-none focus:border-brand"
              >
                <option value="1">≥ 1 (All)</option>
                <option value="2">≥ 2 (Shared)</option>
                <option value="4">≥ 4 (Syndicate Tier)</option>
                <option value="6">≥ 6 (Heavy Syndicate)</option>
              </select>
            </div>
          )}

          <button
            onClick={loadEntities}
            className="flex h-7 w-7 items-center justify-center rounded border border-dark-border bg-dark-panelElevated text-dark-muted hover:text-dark-text"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto rounded border border-dark-border bg-dark-panel">
        {tab === "devices" && (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-dark-border bg-dark-panelElevated">
              <tr className="dense-th text-dark-muted">
                <th className="px-3">Device Fingerprint ID</th>
                <th className="px-3">Device Type</th>
                <th className="px-3">Operating System</th>
                <th className="px-3">Browser Engine</th>
                <th className="px-3">Connected Accounts</th>
                <th className="px-3">Syndicate Risk</th>
                <th className="px-3 text-right">Pivot Canvas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {devices.map((d) => {
                const count = d.accounts_count || 1;
                const isSyndicate = count >= 4;

                return (
                  <tr key={d.id} className="dense-tr hover:bg-dark-panelElevated/50 transition-colors">
                    <td className="px-3 font-semibold text-dark-text">{d.id}</td>
                    <td className="px-3 uppercase text-dark-muted">{d.device_type}</td>
                    <td className="px-3 text-dark-text">{d.os}</td>
                    <td className="px-3 text-dark-muted">{d.browser || "Chrome / Safari"}</td>
                    <td className="px-3 font-bold tabular-nums">
                      <span className={isSyndicate ? "text-risk-high" : "text-dark-text"}>{count}</span>
                    </td>
                    <td className="px-3">
                      {isSyndicate ? (
                        <span className="inline-flex items-center gap-1 rounded bg-risk-high/10 border border-risk-high/30 px-1.5 py-0.5 text-xxs font-bold text-risk-high">
                          <ShieldAlert className="h-3 w-3" />
                          P1 SYNDICATE
                        </span>
                      ) : count > 1 ? (
                        <span className="rounded bg-dark-panelElevated border border-dark-border px-1.5 py-0.5 text-xxs text-amber-400">
                          BENIGN SHARE
                        </span>
                      ) : (
                        <span className="text-xxs text-dark-dim">SOLO</span>
                      )}
                    </td>
                    <td className="px-3 text-right">
                      <Link
                        href={`/investigate?device=${d.id}`}
                        className="rounded border border-dark-border bg-dark-panel px-1.5 py-0.5 text-[10px] text-brand hover:border-brand/40"
                      >
                        Inspect Ring
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "ips" && (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-dark-border bg-dark-panelElevated">
              <tr className="dense-th text-dark-muted">
                <th className="px-3">IP Address Identifier</th>
                <th className="px-3">Autonomous System (ASN)</th>
                <th className="px-3">VPN / Proxy Flag</th>
                <th className="px-3">Connected Accounts</th>
                <th className="px-3">Risk Assessment</th>
                <th className="px-3 text-right">Pivot Canvas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {ips.map((ip) => {
                const count = ip.accounts_count || 1;
                return (
                  <tr key={ip.id} className="dense-tr hover:bg-dark-panelElevated/50 transition-colors">
                    <td className="px-3 font-semibold text-dark-text">{ip.id}</td>
                    <td className="px-3 text-dark-muted">{ip.asn || "AS15169 Google Cloud"}</td>
                    <td className="px-3">
                      {ip.is_vpn ? (
                        <span className="rounded bg-risk-medium/10 border border-risk-medium/30 px-1.5 py-0.5 text-xxs text-risk-medium font-bold">
                          VPN DETECTED
                        </span>
                      ) : (
                        <span className="text-xxs text-dark-dim">RESIDENTIAL</span>
                      )}
                    </td>
                    <td className="px-3 font-bold tabular-nums text-dark-text">{count}</td>
                    <td className="px-3">
                      {count >= 4 ? (
                        <span className="text-risk-high text-xxs font-bold">SHARED IP RING</span>
                      ) : (
                        <span className="text-dark-dim text-xxs">LOW</span>
                      )}
                    </td>
                    <td className="px-3 text-right">
                      <Link
                        href={`/investigate?ip=${ip.id}`}
                        className="rounded border border-dark-border bg-dark-panel px-1.5 py-0.5 text-[10px] text-brand hover:border-brand/40"
                      >
                        Inspect IP
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "cards" && (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-dark-border bg-dark-panelElevated">
              <tr className="dense-th text-dark-muted">
                <th className="px-3">Hashed Card Token</th>
                <th className="px-3">Brand</th>
                <th className="px-3">Card Type</th>
                <th className="px-3">Expiration</th>
                <th className="px-3">Linked Account</th>
                <th className="px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {cards.map((card) => (
                <tr key={card.id} className="dense-tr hover:bg-dark-panelElevated/50 transition-colors">
                  <td className="px-3 font-semibold text-dark-text">{card.id}</td>
                  <td className="px-3 text-dark-text">{card.brand}</td>
                  <td className="px-3 uppercase text-dark-muted">{card.card_type}</td>
                  <td className="px-3 tabular-nums text-dark-muted">
                    {card.exp_month?.toString().padStart(2, "0")}/{card.exp_year}
                  </td>
                  <td className="px-3 text-brand">
                    {card.account_id ? (
                      <Link href={`/investigate?account=${card.account_id}`} className="hover:underline">
                        {card.account_id}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 text-right">
                    {card.account_id && (
                      <Link
                        href={`/investigate?account=${card.account_id}`}
                        className="rounded border border-dark-border bg-dark-panel px-1.5 py-0.5 text-[10px] text-brand hover:border-brand/40"
                      >
                        Canvas
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
