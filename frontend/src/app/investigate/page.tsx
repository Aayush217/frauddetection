"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Network,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  X,
  Code,
  Laptop,
  Globe,
  CreditCard,
  User,
  Info,
  Maximize2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";

// Custom Light-Theme Account Node
function AccountNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  const score = data.risk_score || 0;
  const isHighRisk = score >= 70;
  const isMediumRisk = score >= 40;

  const borderColor = isHighRisk
    ? "border-rose-400"
    : isMediumRisk
    ? "border-amber-400"
    : "border-slate-200";

  const glowClass = selected ? "ring-2 ring-indigo-600 ring-offset-2" : "";

  return (
    <div
      className={`relative min-w-[140px] rounded-xl border bg-white p-3 shadow-card hover:shadow-cardHover transition-all ${borderColor} ${glowClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-600 !h-2 !w-2 !border-white" />
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="font-mono text-xs font-bold text-slate-900 truncate">{data.label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isHighRisk
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : isMediumRisk
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {score}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 flex justify-between tabular-nums border-t border-slate-100 pt-1">
        <span>Balance:</span>
        <span className="text-slate-800 font-semibold">
          ${Number(data.balance || 25000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-600 !h-2 !w-2 !border-white" />
    </div>
  );
}

// Custom Light-Theme Device Node
function DeviceNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={`min-w-[130px] rounded-xl border border-indigo-200 bg-indigo-50/90 p-3 shadow-card ${
        selected ? "ring-2 ring-indigo-600 ring-offset-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !h-2 !w-2 !border-white" />
      <div className="flex items-center gap-1.5 text-indigo-900 mb-1">
        <Laptop className="h-3.5 w-3.5 text-indigo-600" />
        <span className="font-mono text-xs font-bold truncate">{data.label}</span>
      </div>
      <div className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">
        {data.device_type || "HARDWARE"}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !h-2 !w-2 !border-white" />
    </div>
  );
}

// Custom Light-Theme IP Node
function IPNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={`min-w-[120px] rounded-xl border border-sky-200 bg-sky-50/90 p-3 shadow-card ${
        selected ? "ring-2 ring-sky-600 ring-offset-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-sky-500 !h-2 !w-2 !border-white" />
      <div className="flex items-center gap-1.5 text-sky-900 mb-1">
        <Globe className="h-3.5 w-3.5 text-sky-600" />
        <span className="font-mono text-xs font-bold truncate">{data.label}</span>
      </div>
      <div className="text-[10px] font-semibold text-sky-700">
        Country: {data.country || "US"}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !h-2 !w-2 !border-white" />
    </div>
  );
}

// Custom Light-Theme User Node
function UserNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={`min-w-[130px] rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 shadow-card ${
        selected ? "ring-2 ring-emerald-600 ring-offset-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-emerald-500 !h-2 !w-2 !border-white" />
      <div className="flex items-center gap-1.5 text-emerald-900 mb-1">
        <User className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-bold truncate">{data.label}</span>
      </div>
      <div className="text-[10px] font-mono text-emerald-700 truncate">{data.user_id || "LEGAL_OWNER"}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !h-2 !w-2 !border-white" />
    </div>
  );
}

export default function InvestigatePage() {
  const searchParams = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [cypherQuery, setCypherQuery] = useState<string>("");
  const [showCypherModal, setShowCypherModal] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [searchTarget, setSearchTarget] = useState("");
  const [activePreset, setActivePreset] = useState<string>("p1");

  const nodeTypes = useMemo(
    () => ({
      account: AccountNodeComponent,
      device: DeviceNodeComponent,
      ip: IPNodeComponent,
      user: UserNodeComponent,
    }),
    []
  );

  // Load preset graphs
  const loadPreset = async (presetType: string) => {
    setActivePreset(presetType);
    setLoading(true);
    setSelectedElement(null);

    try {
      if (presetType === "p1") {
        // Shared Hardware Ring
        let ring: any;
        try {
          const res = await api.detectSharedDevices(4);
          ring = res.items?.[0];
          setCypherQuery(res.cypher_executed || "MATCH (a:Account)-[ud:USED_DEVICE]->(d:Device) RETURN a, ud, d LIMIT 25");
        } catch (e) {
          console.warn("Failed to fetch P1 detection, using topology preset fallback:", e);
        }

        if (!ring) {
          ring = {
            device_id: "dev_04982",
            device_type: "iOS / Safari",
            account_count: 5,
            account_ids: ["acc_00083", "acc_00084", "acc_00085", "acc_00086", "acc_00087"],
          };
        }

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // Center Device Node
        newNodes.push({
          id: ring.device_id,
          type: "device",
          position: { x: 380, y: 160 },
          data: { label: ring.device_id, device_type: ring.device_type, accounts_count: ring.account_count },
        });

        // Surrounding Account Nodes in a radial circle
        const accounts = ring.account_ids?.length ? ring.account_ids : (ring.member_account_ids || ["acc_00083", "acc_00084", "acc_00085"]);
        const count = accounts.length || 1;
        const radius = 220;

        accounts.forEach((accId: string, i: number) => {
          const angle = (i / count) * 2 * Math.PI;
          const x = 380 + radius * Math.cos(angle);
          const y = 160 + radius * Math.sin(angle);

          newNodes.push({
            id: accId,
            type: "account",
            position: { x, y },
            data: { label: accId, risk_score: 85, balance: 14500 },
          });

          newEdges.push({
            id: `${accId}-${ring.device_id}`,
            source: accId,
            target: ring.device_id,
            animated: true,
            style: { stroke: "#4F46E5", strokeWidth: 2 },
            label: ":USED_DEVICE",
            labelStyle: { fill: "#4F46E5", fontSize: 10, fontWeight: 600 },
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } else if (presetType === "p2") {
        // Closed Transfer Cycle
        let cycle: any;
        try {
          const res = await api.detectCycles({ min_len: 3, max_len: 4 });
          cycle = res.items?.[0];
          setCypherQuery(res.cypher_executed || "MATCH path = (start:Account)-[r:SENT*3..6]->(start) RETURN path LIMIT 25");
        } catch (e) {
          console.warn("Failed to fetch P2 detection, using topology preset fallback:", e);
        }

        if (!cycle) {
          cycle = {
            cycle_length: 4,
            accounts: ["acc_00083", "acc_00084", "acc_00085", "acc_00086"],
            transactions: [
              { from: "acc_00083", to: "acc_00084", amount: 14500 },
              { from: "acc_00084", to: "acc_00085", amount: 14000 },
              { from: "acc_00085", to: "acc_00086", amount: 13500 },
              { from: "acc_00086", to: "acc_00083", amount: 13000 },
            ],
          };
        }

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        const accounts = cycle.accounts?.length ? cycle.accounts : (cycle.member_account_ids || ["acc_00083", "acc_00084", "acc_00085"]);
        const count = accounts.length || 1;
        const radius = 200;

        accounts.forEach((accId: string, i: number) => {
          const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
          const x = 380 + radius * Math.cos(angle);
          const y = 200 + radius * Math.sin(angle);

          newNodes.push({
            id: accId,
            type: "account",
            position: { x, y },
            data: { label: accId, risk_score: 95, balance: 25000 },
          });
        });

        (cycle.transactions || []).forEach((tx: any, i: number) => {
          newEdges.push({
            id: `cycle-tx-${i}`,
            source: tx.from,
            target: tx.to,
            animated: true,
            style: { stroke: "#D97706", strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#D97706" },
            label: `$${tx.amount?.toLocaleString()}`,
            labelStyle: { fill: "#D97706", fontSize: 11, fontWeight: 700 },
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } else if (presetType === "p3") {
        // Mule Account Fan-In / Fan-Out
        let mule: any;
        try {
          const res = await api.detectMules({ min_fan_in: 4 });
          mule = res.items?.[0];
          setCypherQuery(res.cypher_executed || "MATCH (in:Account)-[:SENT]->(m:Account)-[:SENT]->(out:Account) RETURN in, m, out LIMIT 25");
        } catch (e) {
          console.warn("Failed to fetch P3 detection, using topology preset fallback:", e);
        }

        if (!mule) {
          mule = {
            account_id: "acc_00083",
            feeders: ["acc_00084", "acc_00085", "acc_00086", "acc_00087"],
            sinks: ["acc_00088", "acc_00089"],
          };
        }

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // Center Mule
        const muleId = mule.account_id || mule.mule_account_id || "acc_00083";
        newNodes.push({
          id: muleId,
          type: "account",
          position: { x: 380, y: 220 },
          data: { label: muleId, risk_score: 95, balance: 45000, isMule: true },
        });

        // Feeders on the left
        const feeders = mule.feeders?.length ? mule.feeders : ["acc_feed_1", "acc_feed_2", "acc_feed_3", "acc_feed_4"];
        feeders.slice(0, 5).forEach((srcId: string, i: number) => {
          newNodes.push({
            id: srcId,
            type: "account",
            position: { x: 120, y: 80 + i * 75 },
            data: { label: srcId, risk_score: 45, balance: 8000 },
          });
          newEdges.push({
            id: `inflow-${i}`,
            source: srcId,
            target: muleId,
            animated: true,
            style: { stroke: "#059669", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#059669" },
            label: ":FEED",
          });
        });

        // Sinks on the right
        const sinks = mule.sinks?.length ? mule.sinks : ["acc_sink_1", "acc_sink_2"];
        sinks.slice(0, 3).forEach((sinkId: string, j: number) => {
          newNodes.push({
            id: sinkId,
            type: "account",
            position: { x: 640, y: 130 + j * 100 },
            data: { label: sinkId, risk_score: 75, balance: 35000 },
          });
          newEdges.push({
            id: `outflow-${j}`,
            source: muleId,
            target: sinkId,
            animated: true,
            style: { stroke: "#DC2626", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#DC2626" },
            label: ":DISSIPATE",
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
      }
    } catch (err: any) {
      console.error("Failed to load preset graph:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAccountGraph = async (accId: string) => {
    if (!accId.trim()) return;
    setLoading(true);
    setSelectedElement(null);
    try {
      const res = await api.getAccountGraph(accId.trim());
      if (res && res.nodes) {
        setNodes(res.nodes);
        setEdges(res.edges);
        setCypherQuery(res.cypher_query || `MATCH (a:Account {id: '${accId}'})-[r]-(n) RETURN a, r, n`);
      }
    } catch (err: any) {
      alert(`Could not load subgraph for ${accId}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const accParam = searchParams.get("account");
    if (accParam) {
      setSearchTarget(accParam);
      handleSearchAccountGraph(accParam);
    } else {
      loadPreset("p1");
    }
  }, [searchParams]);

  const onNodeClick = (_: any, node: Node) => {
    setSelectedElement({ type: "node", ...node });
  };

  const onEdgeClick = (_: any, edge: Edge) => {
    setSelectedElement({ type: "edge", ...edge });
  };

  const copyCypher = () => {
    navigator.clipboard.writeText(cypherQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Forensic Graph Canvas
            </h1>
            <p className="text-xs text-slate-500">
              Interactive topological subgraph inspection with real-time Neo4j Cypher bindings
            </p>
          </div>
        </div>

        {/* Typology Presets */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => loadPreset("p1")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activePreset === "p1"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            P1: Shared Hardware
          </button>
          <button
            onClick={() => loadPreset("p2")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activePreset === "p2"
                ? "bg-white text-amber-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            P2: Circular Flow
          </button>
          <button
            onClick={() => loadPreset("p3")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activePreset === "p3"
                ? "bg-white text-rose-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            P3: Mule Accounts
          </button>
        </div>

        {/* Targeted Account Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchAccountGraph(searchTarget)}
              placeholder="e.g. acc_00083"
              className="h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
            />
          </div>
          <button
            onClick={() => handleSearchAccountGraph(searchTarget)}
            className="flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            Trace
          </button>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <span>Try:</span>
            {["acc_00083", "acc_00084", "acc_00085"].map((acc) => (
              <button
                key={acc}
                type="button"
                onClick={() => {
                  setSearchTarget(acc);
                  handleSearchAccountGraph(acc);
                }}
                className="font-mono text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-indigo-100"
              >
                {acc}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCypherModal(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Inspect Cypher Query"
          >
            <Code className="h-3.5 w-3.5 text-indigo-600" />
            <span>Cypher</span>
          </button>
        </div>
      </div>

      {/* Main Canvas + Right Inspector Split */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card">
        {/* React Flow Canvas */}
        <div className="flex-1 h-full w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
            className="bg-slate-50/50"
          >
            <Background color="#CBD5E1" gap={18} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === "device") return "#6366F1";
                if (n.type === "ip") return "#0EA5E9";
                if (n.type === "user") return "#10B981";
                return "#F59E0B";
              }}
            />
          </ReactFlow>

          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-2xs">
              <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-4 shadow-elevated text-xs font-semibold text-slate-800">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                Querying Neo4j Subgraph...
              </div>
            </div>
          )}
        </div>

        {/* Selected Element Inspector Drawer */}
        {selectedElement && (
          <div className="w-80 border-l border-slate-200 bg-white p-5 overflow-y-auto space-y-4 shadow-elevated z-10 animate-in slide-in-from-right-4 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Info className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedElement.type === "node" ? "Node Attributes" : "Relationship Details"}
                </h2>
              </div>
              <button
                onClick={() => setSelectedElement(null)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">ID / Identifier:</span>
                <span className="font-mono font-bold text-slate-900">{selectedElement.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type:</span>
                <span className="font-semibold text-indigo-700 uppercase">
                  {selectedElement.type || selectedElement.data?.label || "EDGE"}
                </span>
              </div>
            </div>

            {selectedElement.data && (
              <div className="space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Graph Properties
                </span>
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  {Object.entries(selectedElement.data).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-slate-500 capitalize">{k.replace("_", " ")}:</span>
                      <span className="font-mono font-medium text-slate-800 truncate max-w-[150px]">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedElement.type === "node" && selectedElement.data?.risk_score !== undefined && (
              <Link
                href={`/accounts?search=${selectedElement.id}`}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <span>View Full Account Dossier</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Cypher Query Modal */}
      {showCypherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Code className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Executed Cypher Graph Query</h2>
              </div>
              <button
                onClick={() => setShowCypherModal(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <pre className="rounded-lg bg-slate-900 p-4 font-mono text-xs text-indigo-300 overflow-x-auto whitespace-pre-wrap border border-slate-800">
                {cypherQuery || "MATCH (n) RETURN n LIMIT 25"}
              </pre>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">Explainable Cypher AST generated natively by FraudGraph</span>
              <button
                onClick={copyCypher}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied!" : "Copy Cypher"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
