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

interface Notification {
  id: string;
  type: string;
  title: string;
  sourceId: string | null;
  sourcePage: string | null;
  fromUser: string | null;
  read: boolean;
  createdAt: string;
}

const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='none' stroke='%23666' stroke-width='2'/%3E%3C/svg%3E") 12 12, auto`;

export default function TechnicalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const authenticated = status === "authenticated";
  const { data: nodes = [], mutate: mutateNodes } = useSWR<CanvasNode[]>(authenticated ? "/api/canvas" : null, fetcher);
  const { data: strokes = [], mutate: mutateStrokes } = useSWR<Stroke[]>(authenticated ? "/api/canvas/strokes" : null, fetcher);
  const { data: team = [] } = useSWR<string[]>(authenticated ? "/api/team" : null, fetcher);
  const { data: notifs = [], mutate: mutateNotifs } = useSWR<Notification[]>(authenticated ? "/api/notifications" : null, fetcher);

  const isAdmin = TECHNICAL_ADMINS.includes(session?.user?.email ?? "");
  const unreadCount = notifs.filter((n) => !n.read).length;

  // UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "draw" | "eraser" | "arrow">("select");
  const [arrowFrom, setArrowFrom] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineWeeks, setTimelineWeeks] = useState(12);

  // Edit fields
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editStatus, setEditStatus] = useState<GoalStatus>("not_started");

  // Canvas
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingNode = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const erasedIds = useRef(new Set<string>());

  const CARD_W = 180;
  const CARD_H = 50;

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  function toCanvas(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }

  function nodeAtPoint(cx: number, cy: number): string | null {
    for (const n of nodes) {
      if (cx >= n.x && cx <= n.x + CARD_W && cy >= n.y && cy <= n.y + CARD_H) return n.id;
    }
    return null;
  }

  function isNearCard(cx: number, cy: number): boolean {
    for (const n of nodes) {
      if (cx >= n.x - 30 && cx <= n.x + CARD_W + 30 && cy >= n.y - 30 && cy <= n.y + CARD_H + 30) return true;
    }
    return false;
  }

  function strokesNearPoint(cx: number, cy: number): string[] {
    const R = 20, ids: string[] = [];
    for (const s of strokes) {
      if (erasedIds.current.has(s.id)) continue;
      for (const pt of s.points) { if ((pt.x - cx) ** 2 + (pt.y - cy) ** 2 < R * R) { ids.push(s.id); break; } }
    }
    return ids;
  }

  // --- API ---
  const deleteStroke = useCallback(async (id: string) => {
    await fetch("/api/canvas/strokes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }, []);

  const createNode = useCallback(async (x: number, y: number) => {
    const res = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New task", x, y }) });
    const node = await res.json();
    mutateNodes();
    setEditingId(node.id); setEditTitle(node.title); setEditDesc(""); setEditOwner(""); setEditHours(""); setEditStatus("not_started");
  }, [mutateNodes]);

  const updateNode = useCallback(async (id: string, updates: Partial<CanvasNode>) => {
    await fetch(`/api/canvas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    mutateNodes();
  }, [mutateNodes]);

  const deleteNode = useCallback(async (id: string) => {
    await fetch(`/api/canvas/${id}`, { method: "DELETE" });
    for (const n of nodes) {
      if (n.connectedTo.includes(id)) {
        await fetch(`/api/canvas/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectedTo: n.connectedTo.filter((c) => c !== id) }) });
      }
    }
    mutateNodes(); setSelectedId(null); setConfirmDeleteId(null);
  }, [mutateNodes, nodes]);

  const saveStroke = useCallback(async (points: { x: number; y: number }[]) => {
    if (points.length < 2) return;
    await fetch("/api/canvas/strokes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points, color: "#000000", width: 2 }) });
    mutateStrokes();
  }, [mutateStrokes]);

  const assignOwner = useCallback(async (nodeId: string, ownerEmail: string) => {
    await updateNode(nodeId, { owner: ownerEmail });
    // Send notification
    if (ownerEmail && ownerEmail !== session?.user?.email) {
      const node = nodes.find((n) => n.id === nodeId);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerEmail, type: "task_assigned", title: node?.title || "Task", sourceId: nodeId, sourcePage: "technical" }),
      });
    }
  }, [updateNode, session?.user?.email, nodes]);

  const markNotifRead = useCallback(async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    mutateNotifs();
  }, [mutateNotifs]);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const prev = nodes.find((n) => n.id === editingId);
    const ownerChanged = prev && editOwner !== prev.owner;
    updateNode(editingId, {
      title: editTitle, description: editDesc, owner: editOwner,
      estimatedHours: editHours ? parseInt(editHours) : null, status: editStatus,
    });
    // Notify if owner changed
    if (ownerChanged && editOwner && editOwner !== session?.user?.email) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editOwner, type: "task_assigned", title: editTitle, sourceId: editingId, sourcePage: "technical" }),
      });
    }
    setEditingId(null);
  }, [editingId, editTitle, editDesc, editOwner, editHours, editStatus, updateNode, nodes, session?.user?.email]);

  // --- Arrows ---
  const arrows: { from: CanvasNode; to: CanvasNode; key: string }[] = [];
  for (const n of nodes) {
    for (const tid of n.connectedTo) {
      const t = nodes.find((x) => x.id === tid);
      if (t) arrows.push({ from: n, to: t, key: `${n.id}-${tid}` });
    }
  }

  function deleteArrow(fromId: string, toId: string) {
    const from = nodes.find((n) => n.id === fromId);
    if (from) updateNode(fromId, { connectedTo: from.connectedTo.filter((c) => c !== toId) });
  }

  function arrowNearPoint(cx: number, cy: number): { fromId: string; toId: string } | null {
    for (const { from, to } of arrows) {
      const x1 = from.x + CARD_W / 2, y1 = from.y + CARD_H / 2, x2 = to.x + CARD_W / 2, y2 = to.y + CARD_H / 2;
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        if (((x1 + (x2 - x1) * t - cx) ** 2 + (y1 + (y2 - y1) * t - cy) ** 2) < 400) return { fromId: from.id, toId: to.id };
      }
    }
    return null;
  }

  // --- Mouse handlers ---
  function handleMouseDown(e: React.MouseEvent) {
    // Only handle clicks on the canvas background (not on cards)
    const target = e.target as HTMLElement;
    if (target.closest("[data-card]")) return;
    if (!canvasRef.current?.contains(target)) return;

    const pt = toCanvas(e.clientX, e.clientY);

    if (tool === "eraser") {
      isErasing.current = true; erasedIds.current = new Set();
      const hits = strokesNearPoint(pt.x, pt.y);
      if (hits.length) { hits.forEach((id) => { erasedIds.current.add(id); deleteStroke(id); }); mutateStrokes(strokes.filter((s) => !hits.includes(s.id)), false); }
      const ah = arrowNearPoint(pt.x, pt.y);
      if (ah) deleteArrow(ah.fromId, ah.toId);
      return;
    }

    if (tool === "draw") {
      if (isNearCard(pt.x, pt.y)) {
        const nodeId = nodeAtPoint(pt.x, pt.y);
        if (nodeId) { const node = nodes.find((n) => n.id === nodeId); if (node) { draggingNode.current = nodeId; dragOffset.current = { x: pt.x - node.x, y: pt.y - node.y }; setSelectedId(nodeId); } }
        return;
      }
      isDrawing.current = true; setCurrentStroke([pt]); return;
    }

    // select/arrow: pan
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    setSelectedId(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isErasing.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      const hits = strokesNearPoint(pt.x, pt.y);
      if (hits.length) { hits.forEach((id) => { erasedIds.current.add(id); deleteStroke(id); }); mutateStrokes(strokes.filter((s) => !hits.includes(s.id) && !erasedIds.current.has(s.id)), false); }
      const ah = arrowNearPoint(pt.x, pt.y);
      if (ah) deleteArrow(ah.fromId, ah.toId);
      return;
    }
    if (isDrawing.current && currentStroke) { setCurrentStroke((p) => p ? [...p, toCanvas(e.clientX, e.clientY)] : null); return; }
    if (isPanning.current) { setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); return; }
    if (draggingNode.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      mutateNodes(nodes.map((n) => n.id === draggingNode.current ? { ...n, x: Math.round(pt.x - dragOffset.current.x), y: Math.round(pt.y - dragOffset.current.y) } : n), false);
    }
  }

  function handleMouseUp() {
    if (isErasing.current) { isErasing.current = false; mutateStrokes(); return; }
    if (isDrawing.current && currentStroke && currentStroke.length > 1) {
      isDrawing.current = false;
      const sn = nodeAtPoint(currentStroke[0].x, currentStroke[0].y);
      const en = nodeAtPoint(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
      if (sn && en && sn !== en) { const f = nodes.find((n) => n.id === sn); if (f && !f.connectedTo.includes(en)) updateNode(sn, { connectedTo: [...f.connectedTo, en] }); }
      else saveStroke(currentStroke);
      setCurrentStroke(null); return;
    }
    isDrawing.current = false; setCurrentStroke(null); isPanning.current = false;
    if (draggingNode.current) { const n = nodes.find((x) => x.id === draggingNode.current); if (n) updateNode(draggingNode.current, { x: n.x, y: n.y }); draggingNode.current = null; }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    // Allow double-click anywhere on canvas (not on cards)
    const target = e.target as HTMLElement;
    if (target.closest("[data-card]")) return;
    const pt = toCanvas(e.clientX, e.clientY);
    createNode(Math.round(pt.x), Math.round(pt.y));
  }

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    if (tool === "eraser") return;
    if (tool === "arrow") {
      if (!arrowFrom) { setArrowFrom(nodeId); setSelectedId(nodeId); }
      else if (arrowFrom !== nodeId) {
        const f = nodes.find((n) => n.id === arrowFrom);
        if (f && !f.connectedTo.includes(nodeId)) updateNode(arrowFrom, { connectedTo: [...f.connectedTo, nodeId] });
        setArrowFrom(null); setSelectedId(null);
      }
      return;
    }
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    draggingNode.current = nodeId;
    const pt = toCanvas(e.clientX, e.clientY);
    dragOffset.current = { x: pt.x - node.x, y: pt.y - node.y };
    setSelectedId(nodeId);
  }

  function startEdit(node: CanvasNode) {
    setEditingId(node.id); setEditTitle(node.title); setEditDesc(node.description);
    setEditOwner(node.owner); setEditHours(node.estimatedHours?.toString() || ""); setEditStatus(node.status);
  }

  function pointsToPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
    }
    return d + ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  }

  // Timeline
  const timelineStart = new Date();
  const timelineEnd = new Date(timelineStart.getTime() + timelineWeeks * 7 * 86400000);

  const logEntries = [...nodes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 30);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="h-full flex items-center justify-center"><span className="text-xs font-mono text-neutral-400">Loading...</span></div>;
  }

  const cursorStyle = tool === "eraser" ? ERASER_CURSOR : tool === "draw" || tool === "arrow" ? "crosshair" : undefined;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <nav className="w-full border-b border-neutral-100 shrink-0 z-20 bg-white">
        <div className="max-w-full mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[10px] font-mono text-neutral-400 hover:text-black">&larr; Back</Link>
            <span className="text-neutral-200">|</span>
            <Link href="/" className="text-base tracking-tight"><Logo /></Link>
            <span className="text-xs font-mono uppercase tracking-widest text-black border-b border-black pb-0.5">Technical</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Tools */}
            <div className="flex border border-neutral-200 rounded overflow-hidden">
              {([
                { key: "select" as const, label: "Select", icon: "↖" },
                { key: "arrow" as const, label: arrowFrom ? "Target..." : "Arrow", icon: "→" },
                { key: "draw" as const, label: "Draw", icon: "✎" },
                { key: "eraser" as const, label: "Eraser", icon: "◯" },
              ]).map(({ key: t, label, icon }) => (
                <button key={t} onClick={() => { setTool(t); if (t !== "arrow") setArrowFrom(null); }}
                  className={`text-[10px] font-mono px-2 py-1 transition-colors flex items-center gap-1 ${
                    tool === t ? (t === "eraser" ? "bg-red-500 text-white" : t === "arrow" && arrowFrom ? "bg-blue-500 text-white" : "bg-black text-white")
                    : "bg-transparent text-neutral-500 hover:bg-neutral-50"
                  }`}><span className="text-[11px]">{icon}</span><span>{label}</span></button>
              ))}
            </div>
            <span className="text-neutral-200">|</span>
            {/* Timeline toggle */}
            <button onClick={() => setShowTimeline(!showTimeline)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${
                showTimeline ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"
              }`}>Timeline</button>
            {showTimeline && (
              <select value={timelineWeeks} onChange={(e) => setTimelineWeeks(parseInt(e.target.value))}
                className="text-[10px] font-mono border border-neutral-200 rounded px-1.5 py-0.5 outline-none">
                <option value="4">4 weeks</option>
                <option value="8">8 weeks</option>
                <option value="12">12 weeks</option>
                <option value="26">6 months</option>
                <option value="52">1 year</option>
              </select>
            )}
            <span className="text-neutral-200">|</span>
            <button onClick={() => setShowLog(!showLog)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${
                showLog ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"
              }`}>Log</button>
            <span className="text-[10px] font-mono text-neutral-400">{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="text-[10px] font-mono text-neutral-400 hover:text-black">Reset</button>
            {/* Notifications */}
            <div className="relative ml-1">
              <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markNotifRead("all"); }}
                className="text-[10px] font-mono text-neutral-400 hover:text-black relative px-1.5 py-0.5 border border-neutral-200 rounded">
                Inbox
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-8 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-neutral-100">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Notifications</span>
                  </div>
                  {notifs.length === 0 ? (
                    <p className="p-3 text-[10px] font-mono text-neutral-300">No notifications</p>
                  ) : (
                    notifs.map((n) => (
                      <button key={n.id} onClick={() => { if (n.sourceId && n.sourcePage === "technical") { setSelectedId(n.sourceId); const node = nodes.find((x) => x.id === n.sourceId); if (node) setPan({ x: -node.x * zoom + 400, y: -node.y * zoom + 300 }); } setShowNotifs(false); }}
                        className={`w-full text-left p-3 border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${n.read ? "opacity-50" : ""}`}>
                        <p className="text-[10px] font-medium text-black">{n.title}</p>
                        <p className="text-[9px] font-mono text-neutral-400 mt-0.5">from {n.fromUser?.split("@")[0] || "unknown"}</p>
                        <p className="text-[8px] font-mono text-neutral-300">{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {session?.user && (
              <div className="flex items-center gap-2 ml-1 pl-2 border-l border-neutral-200">
                <span className="text-[10px] font-mono text-neutral-400">{session.user.email?.split("@")[0]}</span>
                <button onClick={() => signOut()} className="text-[10px] font-mono text-neutral-400 hover:text-black">Out</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <div ref={canvasRef} className="flex-1 relative overflow-hidden"
          style={{ background: "#fafafa", cursor: cursorStyle }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={() => { isPanning.current = false; isErasing.current = false; isDrawing.current = false; setCurrentStroke(null);
            if (draggingNode.current) { const n = nodes.find((x) => x.id === draggingNode.current); if (n) updateNode(draggingNode.current, { x: n.x, y: n.y }); draggingNode.current = null; } }}
          onDoubleClick={handleDoubleClick}
          onWheel={(e) => { e.preventDefault(); setZoom((z) => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }}>

          {/* Grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
            backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }} />

          {/* Timeline overlay */}
          {showTimeline && (
            <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${pan.y + 40 * zoom}px`, zIndex: 5 }}>
              <div className="h-px bg-neutral-300 mx-8" style={{ opacity: 0.5 }} />
              {Array.from({ length: timelineWeeks + 1 }).map((_, i) => {
                const d = new Date(timelineStart.getTime() + i * 7 * 86400000);
                const pct = (i / timelineWeeks) * 100;
                return (
                  <div key={i} className="absolute" style={{ left: `${Math.max(2, Math.min(98, pct))}%`, top: "-8px" }}>
                    <div className="w-px h-4 bg-neutral-300" style={{ opacity: 0.5 }} />
                    <span className="text-[8px] font-mono text-neutral-400 block mt-1 whitespace-nowrap" style={{ opacity: 0.7 }}>
                      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Transform */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            <svg className="absolute" style={{ width: "10000px", height: "10000px" }}>
              <defs>
                <marker id="canvas-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>
              {arrows.map(({ from, to, key }) => {
                const x1 = from.x + CARD_W / 2, y1 = from.y + CARD_H / 2, x2 = to.x + CARD_W / 2, y2 = to.y + CARD_H / 2;
                const dx = x2 - x1, dy = y2 - y1;
                const cx = (x1 + x2) / 2 - dy * 0.15, cy = (y1 + y2) / 2 + dx * 0.15;
                const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
                return (
                  <g key={key}>
                    <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: "pointer", pointerEvents: "stroke" }}
                      onClick={(e) => { e.stopPropagation(); deleteArrow(from.id, to.id); }} />
                    <path d={pathD} fill="none" stroke="#b0b0b0" strokeWidth={1.5} markerEnd="url(#canvas-arrow)" style={{ pointerEvents: "none" }} />
                  </g>
                );
              })}
              {strokes.map((s) => (
                <path key={s.id} d={pointsToPath(s.points)} fill="none" stroke={s.color || "#000"} strokeWidth={s.width || 2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.5} style={{ pointerEvents: "none" }} />
              ))}
              {currentStroke && currentStroke.length > 1 && (
                <path d={pointsToPath(currentStroke)} fill="none" stroke="#000" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.35} style={{ pointerEvents: "none" }} />
              )}
            </svg>

            {/* Cards */}
            {nodes.map((node) => {
              const sel = selectedId === node.id;
              const editing = editingId === node.id;
              return (
                <div key={node.id} data-card className="absolute select-none"
                  style={{ left: node.x, top: node.y, width: CARD_W, zIndex: sel ? 20 : 1 }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}>
                  <div className={`border rounded-lg transition-all ${
                    arrowFrom === node.id ? "bg-blue-50 border-blue-400 shadow-md ring-2 ring-blue-200"
                    : sel ? "bg-white border-black shadow-md"
                    : "bg-white border-neutral-200 hover:border-neutral-400 shadow-sm"
                  }`}>
                    {editing ? (
                      <div className="p-3 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
                        <input className="w-full text-xs font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
                          value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
                        <textarea className="w-full text-[10px] bg-transparent border border-neutral-200 rounded p-1.5 outline-none focus:border-black resize-none"
                          value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={2} />
                        {/* Owner dropdown */}
                        <select value={editOwner} onChange={(e) => setEditOwner(e.target.value)}
                          className="w-full text-[10px] font-mono bg-transparent border border-neutral-200 rounded p-1.5 outline-none focus:border-black">
                          <option value="">Assign owner...</option>
                          {team.map((email) => (
                            <option key={email} value={email}>{email.split("@")[0]}</option>
                          ))}
                        </select>
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
                        {node.owner && <p className="text-[9px] font-mono text-blue-500 mt-0.5">@{node.owner.split("@")[0]}</p>}
                        {node.estimatedHours != null && node.estimatedHours > 0 && <span className="text-[8px] font-mono text-neutral-400">~{node.estimatedHours}h</span>}
                        {sel && (
                          <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-neutral-100 flex-wrap" onMouseDown={(e) => e.stopPropagation()}>
                            <select value={node.status} onChange={(e) => updateNode(node.id, { status: e.target.value as GoalStatus })}
                              className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                            </select>
                            {/* Quick assign */}
                            <select value={node.owner || ""} onChange={(e) => assignOwner(node.id, e.target.value)}
                              className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                              <option value="">Assign</option>
                              {team.map((email) => <option key={email} value={email}>{email.split("@")[0]}</option>)}
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

          {nodes.length === 0 && strokes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm font-mono text-neutral-400">Double-click anywhere to add a task</p>
                <p className="text-[10px] font-mono text-neutral-300 mt-1">Draw to sketch &middot; Lines between cards become arrows</p>
              </div>
            </div>
          )}
        </div>

        {showLog && (
          <div className="w-72 border-l border-neutral-100 bg-white overflow-y-auto shrink-0">
            <div className="p-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4">Activity Log</h3>
              {logEntries.map((node) => (
                <div key={node.id} className="border-b border-neutral-50 pb-2 mb-2">
                  <p className="text-[10px] font-medium text-black">{node.title}</p>
                  <p className="text-[9px] font-mono text-neutral-400 mt-0.5">By {node.createdBy?.split("@")[0] || "unknown"}</p>
                  {node.lastEditedBy && node.lastEditedBy !== node.createdBy && (
                    <p className="text-[9px] font-mono text-neutral-400">Edited {node.lastEditedBy?.split("@")[0]}</p>
                  )}
                  {node.owner && <p className="text-[9px] font-mono text-blue-500">@{node.owner.split("@")[0]}</p>}
                  <p className="text-[8px] font-mono text-neutral-300 mt-0.5">
                    {new Date(node.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
              {logEntries.length === 0 && <p className="text-[10px] font-mono text-neutral-300">No activity yet</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
