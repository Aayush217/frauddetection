"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
  Panel,
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
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";

// Custom Account Node
function AccountNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  const score = data.risk_score || 0;
  const isHighRisk = score >= 70;
  const isMediumRisk = score >= 40;

  const borderColor = isHighRisk
    ? "border-risk-high"
    : isMediumRisk
    ? "border-risk-medium"
    : "border-brand/40";

  const glowClass = selected ? "ring-2 ring-brand ring-offset-2 ring-offset-dark-bg" : "";

  return (
    <div
      className={`relative min-w-[130px] rounded border bg-dark-panel p-2 font-mono shadow-md transition-all ${borderColor} ${glowClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-brand !h-1.5 !w-1.5" />
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] font-bold text-dark-text truncate">{data.label}</span>
        <span
          className={`rounded px-1 text-[9px] font-bold ${
            isHighRisk
              ? "bg-risk-high/20 text-risk-high"
              : isMediumRisk
              ? "bg-risk-medium/20 text-risk-medium"
              : "bg-brand/10 text-brand"
          }`}
        >
          {score}
        </span>
      </div>
      <div className="text-[10px] text-dark-muted flex justify-between tabular-nums">
        <span>Bal:</span>
        <span className="text-dark-text font-semibold">
          ${Number(data.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-brand !h-1.5 !w-1.5" />
    </div>
  );
}

// Custom Device Node
function DeviceNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={`min-w-[120px] rounded border border-purple-500/40 bg-purple-950/20 p-2 font-mono shadow-md ${
        selected ? "ring-2 ring-purple-400" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-400 !h-1.5 !w-1.5" />
      <div className="flex items-center gap-1.5 text-purple-300 mb-0.5">
        <Laptop className="h-3 w-3" />
        <span className="text-[10px] font-bold truncate">{data.label}</span>
      </div>
      <div className="text-[9px] text-purple-200/70 truncate">{data.device_type || "HARDWARE"}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !h-1.5 !w-1.5" />
    </div>
  );
}

// Custom IP Node
function IPNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      className={`min-w-[120px] rounded border border-blue-500/40 bg-blue-950/20 p-2 font-mono shadow-md ${
        selected ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !h-1.5 !w-1.5" />
      <div className="flex items-center gap-1.5 text-blue-300 mb-0.5">
        <Globe className="h-3 w-3" />
        <span className="text-[10px] font-bold truncate">{data.label}</span>
      </div>
      <div className="text-[9px] text-blue-200/70">{data.is_vpn ? "VPN NODE" : "RESIDENTIAL"}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !h-1.5 !w-1.5" />
    </div>
  );
}

const nodeTypes = {
  account: AccountNodeComponent,
  device: DeviceNodeComponent,
  ip: IPNodeComponent,
};

export default function InvestigatePage() {
  const searchParams = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);
  const [cypherQuery, setCypherQuery] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Search input
  const [searchTarget, setSearchTarget] = useState("");
  const [activePreset, setActivePreset] = useState<string>("p1");

  // Load preset graphs
  const loadPreset = async (presetType: string) => {
    setActivePreset(presetType);
    setLoading(true);
    setSelectedElement(null);

    try {
      if (presetType === "p1") {
        // Shared Hardware Ring
        const res = await api.detectSharedDevices(4);
        const ring = res.items[0];
        setCypherQuery(res.cypher_executed);

        if (ring) {
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];

          // Center Device Node
          newNodes.push({
            id: ring.device_id,
            type: "device",
            position: { x: 350, y: 150 },
            data: { label: ring.device_id, device_type: ring.device_type, accounts_count: ring.account_count },
          });

          // Surrounding Account Nodes in a radial circle
          const count = ring.account_ids.length;
          const radius = 200;
          ring.account_ids.forEach((accId, i) => {
            const angle = (i / count) * 2 * Math.PI;
            const x = 350 + radius * Math.cos(angle);
            const y = 150 + radius * Math.sin(angle);

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
              style: { stroke: "#A855F7", strokeWidth: 1.5 },
              label: ":USED_DEVICE",
              labelStyle: { fill: "#A855F7", fontSize: 9, fontFamily: "monospace" },
            });
          });

          setNodes(newNodes);
          setEdges(newEdges);
        }
      } else if (presetType === "p2") {
        // Closed Transfer Cycle
        const res = await api.detectCycles({ min_len: 3, max_len: 4 });
        const cycle = res.items[0];
        setCypherQuery(res.cypher_executed);

        if (cycle) {
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];

          const accounts = cycle.accounts;
          const count = accounts.length;
          const radius = 180;

          accounts.forEach((accId, i) => {
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
            const x = 350 + radius * Math.cos(angle);
            const y = 200 + radius * Math.sin(angle);

            newNodes.push({
              id: accId,
              type: "account",
              position: { x, y },
              data: { label: accId, risk_score: 95, balance: 25000 },
            });
          });

          cycle.transactions.forEach((tx, i) => {
            newEdges.push({
              id: `cycle-tx-${i}`,
              source: tx.from,
              target: tx.to,
              animated: true,
              style: { stroke: "#F59E0B", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#F59E0B" },
              label: `$${tx.amount?.toLocaleString()}`,
              labelStyle: { fill: "#F59E0B", fontSize: 10, fontWeight: 700, fontFamily: "monospace" },
            });
          });

          setNodes(newNodes);
          setEdges(newEdges);
        }
      } else if (presetType === "p3") {
        // Mule Account Fan-In / Fan-Out
        const res = await api.detectMules({ min_fan_in: 4 });
        const mule = res.items[0];
        setCypherQuery(res.cypher_executed);

        if (mule) {
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];

          // Center Mule
          newNodes.push({
            id: mule.account_id,
            type: "account",
            position: { x: 350, y: 200 },
            data: { label: mule.account_id, risk_score: mule.risk_score || 90, balance: 45000, isMule: true },
          });

          // Sources on the left
          for (let i = 0; i < mule.fan_in_count; i++) {
            const srcId = `ACC_INFLOW_${i + 1}`;
            newNodes.push({
              id: srcId,
              type: "account",
              position: { x: 100, y: 80 + i * 70 },
              data: { label: srcId, risk_score: 45, balance: 8000 },
            });
            newEdges.push({
              id: `inflow-${i}`,
              source: srcId,
              target: mule.account_id,
              animated: true,
              style: { stroke: "#2DD4BF", strokeWidth: 1.5 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#2DD4BF" },
              label: ":SENT",
            });
          }

          // Sinks on the right
          for (let j = 0; j < Math.max(2, mule.fan_out_count); j++) {
            const sinkId = `ACC_OUTFLOW_${j + 1}`;
            newNodes.push({
              id: sinkId,
              type: "account",
              position: { x: 600, y: 120 + j * 100 },
              data: { label: sinkId, risk_score: 65, balance: 35000 },
            });
            newEdges.push({
              id: `outflow-${j}`,
              source: mule.account_id,
              target: sinkId,
              animated: true,
              style: { stroke: "#EF4444", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#EF4444" },
              label: ":DISSIPATED",
            });
          }

          setNodes(newNodes);
          setEdges(newEdges);
        }
      }
    } catch (err: any) {
      console.error("Failed to load preset graph:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const accParam = searchParams.get("account");
    if (accParam) {
      setSearchTarget(accParam);
      // load default cycle or targeted subgraph
      loadPreset("p2");
    } else {
      loadPreset("p1");
    }
  }, []);

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
    <div className="flex h-full flex-col space-y-3 font-mono">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dark-border bg-dark-panel p-2.5">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-wider text-dark-text">
            Investigation Canvas (Interactive Graph)
          </span>
        </div>

        {/* Typology Presets */}
        <div className="flex items-center gap-1 rounded border border-dark-border bg-dark-bg p-0.5">
          <button
            onClick={() => loadPreset("p1")}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              activePreset === "p1"
                ? "bg-dark-panelElevated text-brand font-semibold"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            P1: Shared Hardware
          </button>
          <button
            onClick={() => loadPreset("p2")}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              activePreset === "p2"
                ? "bg-dark-panelElevated text-amber-400 font-semibold"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            P2: Circular Flow
          </button>
          <button
            onClick={() => loadPreset("p3")}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              activePreset === "p3"
                ? "bg-dark-panelElevated text-rose-400 font-semibold"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            P3: Mule Accounts
          </button>
        </div>

        {/* Target search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-dark-muted" />
            <input
              type="text"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              placeholder="Query Node ID..."
              className="h-7 w-40 rounded border border-dark-border bg-dark-bg pl-8 pr-2 text-xs text-dark-text outline-none focus:border-brand"
            />
          </div>
          <button
            onClick={() => loadPreset(activePreset)}
            className="flex h-7 w-7 items-center justify-center rounded border border-dark-border bg-dark-panelElevated text-dark-muted hover:text-dark-text"
            title="Refresh graph"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Canvas + Right Inspector Split */}
      <div className="relative flex flex-1 overflow-hidden rounded border border-dark-border bg-dark-panel">
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
            className="bg-dark-bg"
          >
            <Background color="#1B1F24" gap={16} size={1} />
            <Controls className="!bg-dark-panel !border-dark-border !fill-dark-muted" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === "device") return "#A855F7";
                if (n.type === "ip") return "#3B82F6";
                return "#2DD4BF";
              }}
              maskColor="rgba(14, 16, 19, 0.8)"
              className="!bg-dark-panel !border-dark-border !rounded"
            />

            {/* Quick Legend Panel */}
            <Panel position="top-left" className="rounded border border-dark-border bg-dark-panel/90 p-2 shadow-lg backdrop-blur">
              <div className="text-[10px] uppercase font-bold text-dark-muted mb-1">Graph Legend</div>
              <div className="space-y-1 text-xxs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded border border-brand bg-brand/20" />
                  <span className="text-dark-text">(:Account)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded border border-purple-500 bg-purple-950/40" />
                  <span className="text-purple-300">(:Device)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded border border-blue-500 bg-blue-950/40" />
                  <span className="text-blue-300">(:IP)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-amber-400" />
                  <span className="text-amber-400">[:SENT] Transfer</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Selected Node / Edge Inspector Drawer */}
        {selectedElement && (
          <aside className="w-80 border-l border-dark-border bg-dark-panelElevated flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-100">
            <div className="flex h-10 items-center justify-between border-b border-dark-border px-3 bg-dark-panel">
              <span className="text-xs font-bold text-dark-text uppercase">
                {selectedElement.type === "node" ? "Node Inspector" : "Edge Inspector"}
              </span>
              <button
                onClick={() => setSelectedElement(null)}
                className="rounded p-1 text-dark-muted hover:text-dark-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto text-xs">
              <div className="rounded border border-dark-border bg-dark-panel p-2.5 space-y-1">
                <div className="text-xxs uppercase tracking-wider text-dark-muted">Identifier</div>
                <div className="text-sm font-bold text-brand truncate">{selectedElement.id}</div>
                <div className="text-xxs text-dark-muted">
                  Type: <span className="text-dark-text uppercase font-semibold">{selectedElement.type || "Element"}</span>
                </div>
              </div>

              {selectedElement.data && (
                <div className="rounded border border-dark-border bg-dark-panel p-2.5 space-y-2">
                  <div className="text-xxs uppercase tracking-wider text-dark-muted">Attributes</div>
                  <div className="space-y-1 text-xxs">
                    {Object.entries(selectedElement.data).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-dark-muted capitalize">{k.replace("_", " ")}:</span>
                        <span className="text-dark-text font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedElement.type === "node" && (
                <div className="rounded border border-dark-border bg-dark-panel p-2.5 space-y-2">
                  <div className="text-xxs uppercase tracking-wider text-dark-muted">Topological Actions</div>
                  <button
                    onClick={() => alert(`Expanding 1-hop subgraph for ${selectedElement.id}`)}
                    className="w-full rounded border border-brand/40 bg-brand/10 py-1 text-xxs font-semibold text-brand hover:bg-brand/20"
                  >
                    Expand 1-Hop Neighbors
                  </button>
                  <button
                    onClick={() => alert(`Finding shortest paths through ${selectedElement.id}`)}
                    className="w-full rounded border border-dark-border bg-dark-panelElevated py-1 text-xxs text-dark-text hover:text-brand"
                  >
                    Trace Shortest Paths
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Parameterized Cypher Query Drawer at Bottom */}
      <div className="rounded border border-dark-border bg-dark-panel p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xxs font-bold text-dark-muted uppercase tracking-wider">
            <Code className="h-3.5 w-3.5 text-brand" />
            <span>Cypher Query Generating On-Screen Subgraph</span>
          </div>
          <button
            onClick={copyCypher}
            className="flex items-center gap-1 text-[10px] text-dark-muted hover:text-brand transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "COPIED" : "COPY CYPHER"}</span>
          </button>
        </div>
        <pre className="rounded bg-dark-bg p-2 text-xxs text-emerald-400 overflow-x-auto border border-dark-border leading-relaxed font-mono">
          {cypherQuery ||
            `MATCH (d:Device)<-[:USED_DEVICE]-(a:Account)
WITH d, collect(a) AS accounts, count(a) AS count
WHERE count >= 4
RETURN d.id, [a IN accounts | a.id] AS ring_accounts;`}
        </pre>
      </div>
    </div>
  );
}
