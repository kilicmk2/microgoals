"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { CanvasNode, GoalStatus, STATUS_CONFIG, TECHNICAL_ADMINS } from "../lib/store";
import Logo from "../components/Logo";
import Link from "next/link";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
};

const STATUS_OPTIONS: GoalStatus[] = ["not_started", "in_progress", "done", "blocked"];

export default function TechnicalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: nodes = [], mutate } = useSWR<CanvasNode[]>(
    status === "authenticated" ? "/api/canvas" : null,
    fetcher
  );

  const isAdmin = TECHNICAL_ADMINS.includes(session?.user?.email ?? "");

  // Canvas state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawFrom, setDrawFrom] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Edit fields
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editStatus, setEditStatus] = useState<GoalStatus>("not_started");

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Drag node
  const draggingNode = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // API helpers
  const createNode = useCallback(async (x: number, y: number) => {
    const res = await fetch("/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New task", x, y }),
    });
    const node = await res.json();
    mutate();
    setEditingId(node.id);
    setEditTitle(node.title);
    setEditDesc("");
    setEditOwner("");
    setEditHours("");
    setEditStatus("not_started");
  }, [mutate]);

  const updateNode = useCallback(async (id: string, updates: Partial<CanvasNode>) => {
    await fetch(`/api/canvas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutate();
  }, [mutate]);

  const deleteNode = useCallback(async (id: string) => {
    await fetch(`/api/canvas/${id}`, { method: "DELETE" });
    // Also remove this ID from any connectedTo arrays
    for (const n of nodes) {
      if (n.connectedTo.includes(id)) {
        await fetch(`/api/canvas/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectedTo: n.connectedTo.filter((c) => c !== id) }),
        });
      }
    }
    mutate();
    setSelectedId(null);
    setConfirmDeleteId(null);
  }, [mutate, nodes]);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    updateNode(editingId, {
      title: editTitle,
      description: editDesc,
      owner: editOwner,
      estimatedHours: editHours ? parseInt(editHours) : null,
      status: editStatus,
    });
    setEditingId(null);
  }, [editingId, editTitle, editDesc, editOwner, editHours, editStatus, updateNode]);

  // Canvas interactions
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.target !== canvasRef.current) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    if (draggingNode.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      // Optimistic local update
      mutate(
        nodes.map((n) => n.id === draggingNode.current ? { ...n, x: Math.round(x), y: Math.round(y) } : n),
        false
      );
    }
  }

  function handleCanvasMouseUp() {
    isPanning.current = false;
    if (draggingNode.current) {
      const node = nodes.find((n) => n.id === draggingNode.current);
      if (node) {
        updateNode(draggingNode.current, { x: node.x, y: node.y });
      }
      draggingNode.current = null;
    }
  }

  function handleCanvasDoubleClick(e: React.MouseEvent) {
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    createNode(Math.round(x), Math.round(y));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    if (drawMode) {
      if (!drawFrom) {
        setDrawFrom(nodeId);
      } else if (drawFrom !== nodeId) {
        // Create connection
        const from = nodes.find((n) => n.id === drawFrom);
        if (from && !from.connectedTo.includes(nodeId)) {
          updateNode(drawFrom, { connectedTo: [...from.connectedTo, nodeId] });
        }
        setDrawFrom(null);
      }
      return;
    }
    // Start drag
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    draggingNode.current = nodeId;
    dragOffset.current = {
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y,
    };
    setSelectedId(nodeId);
  }

  function startEdit(node: CanvasNode) {
    setEditingId(node.id);
    setEditTitle(node.title);
    setEditDesc(node.description);
    setEditOwner(node.owner);
    setEditHours(node.estimatedHours?.toString() || "");
    setEditStatus(node.status);
  }

  // Compute arrow paths
  function getArrows(): { from: CanvasNode; to: CanvasNode }[] {
    const arrows: { from: CanvasNode; to: CanvasNode }[] = [];
    for (const n of nodes) {
      for (const targetId of n.connectedTo) {
        const target = nodes.find((t) => t.id === targetId);
        if (target) arrows.push({ from: n, to: target });
      }
    }
    return arrows;
  }

  // Activity log
  const logEntries = [...nodes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-xs font-mono text-neutral-400">Loading...</span>
      </div>
    );
  }

  const arrows = getArrows();
  const CARD_W = 180;
  const CARD_H = 40;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <nav className="w-full border-b border-neutral-100 shrink-0 z-20 bg-white">
        <div className="max-w-full mx-auto px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-base tracking-tight"><Logo /></Link>
            <span className="text-xs font-mono uppercase tracking-widest text-black border-b border-black pb-0.5">Technical</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Draw mode toggle */}
            <button
              onClick={() => { setDrawMode(!drawMode); setDrawFrom(null); }}
              className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${
                drawMode
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"
              }`}
            >
              {drawMode ? (drawFrom ? "Click target..." : "Draw arrows") : "Draw mode"}
            </button>
            {/* Log toggle */}
            <button
              onClick={() => setShowLog(!showLog)}
              className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${
                showLog
                  ? "bg-black text-white border-black"
                  : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"
              }`}
            >
              Log
            </button>
            {/* Zoom */}
            <span className="text-[10px] font-mono text-neutral-400">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(1)} className="text-[10px] font-mono text-neutral-400 hover:text-black">Reset</button>
            {/* User */}
            {session?.user && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-200">
                <span className="text-[10px] font-mono text-neutral-400">{session.user.email}</span>
                <button onClick={() => signOut()} className="text-[10px] font-mono text-neutral-400 hover:text-black">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className={`flex-1 relative overflow-hidden ${drawMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          style={{ background: "#fafafa" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onDoubleClick={handleCanvasDoubleClick}
          onWheel={handleWheel}
        >
          {/* Grid dots */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
            backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }} />

          {/* Transform layer */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            {/* SVG arrows */}
            <svg className="absolute" style={{ width: "10000px", height: "10000px", pointerEvents: "none" }}>
              <defs>
                <marker id="canvas-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>
              {arrows.map(({ from, to }, i) => {
                const x1 = from.x + CARD_W / 2;
                const y1 = from.y + CARD_H / 2;
                const x2 = to.x + CARD_W / 2;
                const y2 = to.y + CARD_H / 2;
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2 - 30;
                return (
                  <path
                    key={`${from.id}-${to.id}`}
                    d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={2}
                    markerEnd="url(#canvas-arrow)"
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const cfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.not_started;
              const isSelected = selectedId === node.id;
              const isEditing = editingId === node.id;

              return (
                <div
                  key={node.id}
                  className={`absolute select-none transition-shadow ${
                    drawMode && drawFrom === node.id ? "ring-2 ring-blue-400" : ""
                  }`}
                  style={{ left: node.x, top: node.y, width: CARD_W, zIndex: isSelected ? 20 : 1 }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                >
                  <div className={`border rounded-lg transition-all ${
                    isSelected
                      ? "bg-white border-black shadow-md"
                      : "bg-white border-neutral-200 hover:border-neutral-400 shadow-sm"
                  }`}>
                    {isEditing ? (
                      <div className="p-3 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
                        <input className="w-full text-xs font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
                          value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
                        <textarea className="w-full text-[10px] bg-transparent border border-neutral-200 rounded p-1.5 outline-none focus:border-black resize-none"
                          value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={2} />
                        <input className="w-full text-[10px] bg-transparent border-b border-neutral-200 pb-0.5 outline-none focus:border-black"
                          value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" />
                        <div className="flex gap-2">
                          <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as GoalStatus)}
                            className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>
                          <input type="number" min="0" className="text-[10px] border border-neutral-200 rounded px-1 py-0.5 outline-none w-14"
                            value={editHours} onChange={(e) => setEditHours(e.target.value)} placeholder="Hours" />
                        </div>
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="text-[9px] font-mono px-2 py-0.5 bg-black text-white rounded hover:bg-neutral-800">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-[9px] font-mono text-neutral-400 hover:text-black px-1">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            node.status === "done" ? "bg-green-500" : node.status === "in_progress" ? "bg-blue-500" : node.status === "blocked" ? "bg-red-500" : "bg-neutral-300"
                          }`} />
                          <span className="text-[10px] font-medium text-black truncate">{node.title}</span>
                        </div>
                        {node.owner && <p className="text-[9px] font-mono text-neutral-400 mt-0.5">{node.owner}</p>}
                        {node.estimatedHours && <span className="text-[8px] font-mono text-neutral-400">~{node.estimatedHours}h</span>}

                        {/* Controls — show on select */}
                        {isSelected && (
                          <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-neutral-100" onMouseDown={(e) => e.stopPropagation()}>
                            <select value={node.status}
                              onChange={(e) => updateNode(node.id, { status: e.target.value as GoalStatus })}
                              className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                            </select>
                            <button onClick={() => startEdit(node)} className="text-[9px] font-mono text-neutral-400 hover:text-black px-1">Edit</button>
                            {isAdmin && (
                              confirmDeleteId === node.id ? (
                                <div className="flex gap-0.5">
                                  <button onClick={() => deleteNode(node.id)} className="text-[9px] font-mono text-red-500 hover:text-red-700 px-1">Del</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] font-mono text-neutral-400 px-1">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(node.id)} className="text-[9px] font-mono text-neutral-400 hover:text-red-500 px-1">Del</button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm font-mono text-neutral-400">Double-click to add a task</p>
                <p className="text-[10px] font-mono text-neutral-300 mt-1">Drag to move &middot; Click to select &middot; Draw mode for arrows</p>
              </div>
            </div>
          )}
        </div>

        {/* Activity log panel */}
        {showLog && (
          <div className="w-72 border-l border-neutral-100 bg-white overflow-y-auto shrink-0">
            <div className="p-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4">Activity Log</h3>
              <div className="space-y-3">
                {logEntries.map((node) => (
                  <div key={node.id} className="border-b border-neutral-50 pb-2">
                    <p className="text-[10px] font-medium text-black">{node.title}</p>
                    <p className="text-[9px] font-mono text-neutral-400 mt-0.5">
                      Created by {node.createdBy || "unknown"}
                    </p>
                    {node.lastEditedBy && node.lastEditedBy !== node.createdBy && (
                      <p className="text-[9px] font-mono text-neutral-400">
                        Last edited by {node.lastEditedBy}
                      </p>
                    )}
                    <p className="text-[8px] font-mono text-neutral-300 mt-0.5">
                      {new Date(node.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
                {logEntries.length === 0 && (
                  <p className="text-[10px] font-mono text-neutral-300">No activity yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
