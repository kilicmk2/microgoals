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

interface Stroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  createdBy: string | null;
}

export default function TechnicalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const authenticated = status === "authenticated";
  const { data: nodes = [], mutate: mutateNodes } = useSWR<CanvasNode[]>(
    authenticated ? "/api/canvas" : null, fetcher
  );
  const { data: strokes = [], mutate: mutateStrokes } = useSWR<Stroke[]>(
    authenticated ? "/api/canvas/strokes" : null, fetcher
  );

  const isAdmin = TECHNICAL_ADMINS.includes(session?.user?.email ?? "");

  // UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "draw">("select");

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

  // Drawing state
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
  const isDrawing = useRef(false);

  const CARD_W = 180;
  const CARD_H = 50;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Convert screen coords to canvas coords
  function toCanvas(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  // Find which node a point is inside
  function nodeAtPoint(cx: number, cy: number): string | null {
    for (const n of nodes) {
      if (cx >= n.x && cx <= n.x + CARD_W && cy >= n.y && cy <= n.y + CARD_H) {
        return n.id;
      }
    }
    return null;
  }

  // API helpers
  const createNode = useCallback(async (x: number, y: number) => {
    const res = await fetch("/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New task", x, y }),
    });
    const node = await res.json();
    mutateNodes();
    setEditingId(node.id);
    setEditTitle(node.title);
    setEditDesc(""); setEditOwner(""); setEditHours("");
    setEditStatus("not_started");
    setTool("select");
  }, [mutateNodes]);

  const updateNode = useCallback(async (id: string, updates: Partial<CanvasNode>) => {
    await fetch(`/api/canvas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutateNodes();
  }, [mutateNodes]);

  const deleteNode = useCallback(async (id: string) => {
    await fetch(`/api/canvas/${id}`, { method: "DELETE" });
    for (const n of nodes) {
      if (n.connectedTo.includes(id)) {
        await fetch(`/api/canvas/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectedTo: n.connectedTo.filter((c) => c !== id) }),
        });
      }
    }
    mutateNodes();
    setSelectedId(null);
    setConfirmDeleteId(null);
  }, [mutateNodes, nodes]);

  const saveStroke = useCallback(async (points: { x: number; y: number }[]) => {
    await fetch("/api/canvas/strokes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, color: "#000000", width: 2 }),
    });
    mutateStrokes();
  }, [mutateStrokes]);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    updateNode(editingId, {
      title: editTitle, description: editDesc, owner: editOwner,
      estimatedHours: editHours ? parseInt(editHours) : null, status: editStatus,
    });
    setEditingId(null);
  }, [editingId, editTitle, editDesc, editOwner, editHours, editStatus, updateNode]);

  // Canvas mouse handlers
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.target !== canvasRef.current) return;

    if (tool === "draw") {
      const pt = toCanvas(e.clientX, e.clientY);
      isDrawing.current = true;
      setCurrentStroke([pt]);
      return;
    }

    // Pan mode
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    // Drawing
    if (isDrawing.current && currentStroke) {
      const pt = toCanvas(e.clientX, e.clientY);
      setCurrentStroke([...currentStroke, pt]);
      return;
    }

    // Panning
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }

    // Dragging node
    if (draggingNode.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      mutateNodes(
        nodes.map((n) => n.id === draggingNode.current ? { ...n, x: Math.round(x), y: Math.round(y) } : n),
        false
      );
    }
  }

  function handleCanvasMouseUp(e: React.MouseEvent) {
    // Finish drawing
    if (isDrawing.current && currentStroke && currentStroke.length > 1) {
      isDrawing.current = false;
      const startPt = currentStroke[0];
      const endPt = currentStroke[currentStroke.length - 1];
      const startNode = nodeAtPoint(startPt.x, startPt.y);
      const endNode = nodeAtPoint(endPt.x, endPt.y);

      if (startNode && endNode && startNode !== endNode) {
        // Stroke connects two cards — create arrow connection instead of freehand
        const from = nodes.find((n) => n.id === startNode);
        if (from && !from.connectedTo.includes(endNode)) {
          updateNode(startNode, { connectedTo: [...from.connectedTo, endNode] });
        }
      } else {
        // Save as freehand stroke
        saveStroke(currentStroke);
      }
      setCurrentStroke(null);
      return;
    }
    isDrawing.current = false;
    setCurrentStroke(null);

    // Finish panning
    isPanning.current = false;

    // Finish dragging
    if (draggingNode.current) {
      const node = nodes.find((n) => n.id === draggingNode.current);
      if (node) updateNode(draggingNode.current, { x: node.x, y: node.y });
      draggingNode.current = null;
    }
  }

  function handleCanvasDoubleClick(e: React.MouseEvent) {
    if (e.target !== canvasRef.current) return;
    const pt = toCanvas(e.clientX, e.clientY);
    createNode(Math.round(pt.x), Math.round(pt.y));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    if (tool === "draw") {
      // Start drawing from this node
      const pt = toCanvas(e.clientX, e.clientY);
      isDrawing.current = true;
      setCurrentStroke([pt]);
      return;
    }
    // Drag node
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
    setEditTitle(node.title); setEditDesc(node.description);
    setEditOwner(node.owner); setEditHours(node.estimatedHours?.toString() || "");
    setEditStatus(node.status);
  }

  // Arrows from connectedTo
  const arrows: { from: CanvasNode; to: CanvasNode }[] = [];
  for (const n of nodes) {
    for (const tid of n.connectedTo) {
      const t = nodes.find((x) => x.id === tid);
      if (t) arrows.push({ from: n, to: t });
    }
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

  // SVG path from points
  function pointsToPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <nav className="w-full border-b border-neutral-100 shrink-0 z-20 bg-white">
        <div className="max-w-full mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[10px] font-mono text-neutral-400 hover:text-black flex items-center gap-1">
              &larr; Back
            </Link>
            <span className="text-neutral-200">|</span>
            <Link href="/" className="text-base tracking-tight"><Logo /></Link>
            <span className="text-xs font-mono uppercase tracking-widest text-black border-b border-black pb-0.5">Technical</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Tool selector */}
            <div className="flex border border-neutral-200 rounded overflow-hidden">
              <button
                onClick={() => setTool("select")}
                className={`text-[10px] font-mono px-3 py-1 transition-colors ${
                  tool === "select" ? "bg-black text-white" : "bg-transparent text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                Select
              </button>
              <button
                onClick={() => setTool("draw")}
                className={`text-[10px] font-mono px-3 py-1 transition-colors ${
                  tool === "draw" ? "bg-black text-white" : "bg-transparent text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                Draw
              </button>
            </div>
            <button onClick={() => setShowLog(!showLog)}
              className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${
                showLog ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"
              }`}>Log</button>
            <span className="text-[10px] font-mono text-neutral-400">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(1)} className="text-[10px] font-mono text-neutral-400 hover:text-black">Reset</button>
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
          className={`flex-1 relative overflow-hidden ${
            tool === "draw" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
          }`}
          style={{ background: "#fafafa" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => { isPanning.current = false; isDrawing.current = false; setCurrentStroke(null); if (draggingNode.current) { const n = nodes.find((x) => x.id === draggingNode.current); if (n) updateNode(draggingNode.current, { x: n.x, y: n.y }); draggingNode.current = null; } }}
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
            {/* SVG layer: arrows + strokes */}
            <svg className="absolute" style={{ width: "10000px", height: "10000px", pointerEvents: "none" }}>
              <defs>
                <marker id="canvas-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>
              {/* Connection arrows */}
              {arrows.map(({ from, to }) => {
                const x1 = from.x + CARD_W / 2;
                const y1 = from.y + CARD_H / 2;
                const x2 = to.x + CARD_W / 2;
                const y2 = to.y + CARD_H / 2;
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2 - 30;
                return (
                  <path key={`${from.id}-${to.id}`}
                    d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                    fill="none" stroke="#9ca3af" strokeWidth={2}
                    markerEnd="url(#canvas-arrow)" />
                );
              })}
              {/* Saved freehand strokes */}
              {strokes.map((s) => (
                <path key={s.id} d={pointsToPath(s.points)}
                  fill="none" stroke={s.color || "#000"} strokeWidth={s.width || 2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
              ))}
              {/* Current drawing stroke */}
              {currentStroke && currentStroke.length > 1 && (
                <path d={pointsToPath(currentStroke)}
                  fill="none" stroke="#000" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
              )}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedId === node.id;
              const isEditing = editingId === node.id;

              return (
                <div key={node.id}
                  className="absolute select-none"
                  style={{ left: node.x, top: node.y, width: CARD_W, zIndex: isSelected ? 20 : 1 }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                >
                  <div className={`border rounded-lg transition-all ${
                    isSelected ? "bg-white border-black shadow-md" : "bg-white border-neutral-200 hover:border-neutral-400 shadow-sm"
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
                        {node.estimatedHours != null && <span className="text-[8px] font-mono text-neutral-400">~{node.estimatedHours}h</span>}
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

          {/* Empty state */}
          {nodes.length === 0 && strokes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm font-mono text-neutral-400">Double-click to add a task</p>
                <p className="text-[10px] font-mono text-neutral-300 mt-1">Switch to Draw to freehand &middot; Lines between cards become arrows</p>
              </div>
            </div>
          )}
        </div>

        {/* Activity log */}
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
                      <p className="text-[9px] font-mono text-neutral-400">Edited by {node.lastEditedBy}</p>
                    )}
                    <p className="text-[8px] font-mono text-neutral-300 mt-0.5">
                      {new Date(node.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
                {logEntries.length === 0 && <p className="text-[10px] font-mono text-neutral-300">No activity yet</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
