"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { CanvasNode, GoalStatus, STATUS_CONFIG, TECHNICAL_ADMINS } from "../lib/store";
import { useChatMessages } from "../lib/hooks";
import ChatBubble from "../components/ChatBubble";
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
  id: string; type: string; title: string; sourceId: string | null;
  sourcePage: string | null; fromUser: string | null; read: boolean; createdAt: string;
}

interface UndoAction {
  type: "create_node" | "delete_node" | "update_node" | "create_stroke" | "delete_stroke" | "create_arrow" | "delete_arrow";
  data: Record<string, unknown>;
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
  const { messages: chatMsgs, sendMessage: chatSend, clearChat } = useChatMessages("technical");
  const chatSendMessage = useCallback(async (content: string) => {
    const r = await chatSend(content); mutateNodes(); return r;
  }, [chatSend, mutateNodes]);

  const isAdmin = TECHNICAL_ADMINS.includes(session?.user?.email ?? "");
  const unreadCount = notifs.filter((n) => !n.read).length;

  // UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [tool, setTool] = useState<"select" | "draw" | "eraser">("select");
  const [showTimeline, setShowTimeline] = useState(true);
  const [timelineWeeks, setTimelineWeeks] = useState(12);
  const [confirmClear, setConfirmClear] = useState(false);

  // Arrow drawing: drag from connector dot
  const [arrowDrag, setArrowDrag] = useState<{ fromId: string; mx: number; my: number } | null>(null);

  // Canvas
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingNode = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const erasedIds = useRef(new Set<string>());
  const eraseQueue = useRef<string[]>([]);

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  const CARD_W = 180;
  const CARD_H = 44;
  const ERASE_R = 20;
  const MIN_POINT_DIST = 4;

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  // Prevent browser zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => { e.preventDefault(); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  function pushUndo(action: UndoAction) {
    setUndoStack((s) => [...s.slice(-30), action]);
    setRedoStack([]);
  }

  function handleUndo() {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const action = stack[stack.length - 1];
      setRedoStack((r) => [...r, action]);
      // Execute undo
      if (action.type === "create_node") {
        fetch(`/api/canvas/${action.data.id}`, { method: "DELETE" }).then(() => mutateNodes());
      } else if (action.type === "delete_node") {
        const d = action.data as Record<string, unknown>;
        fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(() => mutateNodes());
      }
      return stack.slice(0, -1);
    });
  }

  function handleRedo() {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const action = stack[stack.length - 1];
      setUndoStack((u) => [...u, action]);
      if (action.type === "create_node") {
        const d = action.data as Record<string, unknown>;
        fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(() => mutateNodes());
      } else if (action.type === "delete_node") {
        fetch(`/api/canvas/${action.data.id}`, { method: "DELETE" }).then(() => mutateNodes());
      }
      return stack.slice(0, -1);
    });
  }

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
      if (cx >= n.x - 20 && cx <= n.x + CARD_W + 20 && cy >= n.y - 20 && cy <= n.y + CARD_H + 20) return true;
    }
    return false;
  }

  function eraseAt(cx: number, cy: number) {
    const R2 = ERASE_R * ERASE_R;
    for (const s of strokes) {
      if (erasedIds.current.has(s.id)) continue;
      for (let i = 0; i < s.points.length; i += 3) {
        if ((s.points[i].x - cx) ** 2 + (s.points[i].y - cy) ** 2 < R2) {
          erasedIds.current.add(s.id); eraseQueue.current.push(s.id); break;
        }
      }
    }
    for (const { from, to } of arrows) {
      const x1 = from.x + CARD_W / 2, y1 = from.y + CARD_H / 2, x2 = to.x + CARD_W / 2, y2 = to.y + CARD_H / 2;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        if (((x1 + (x2 - x1) * t - cx) ** 2 + (y1 + (y2 - y1) * t - cy) ** 2) < R2) { deleteArrow(from.id, to.id); break; }
      }
    }
  }

  function flushErase() {
    const ids = [...eraseQueue.current]; eraseQueue.current = [];
    ids.forEach((id) => fetch("/api/canvas/strokes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }));
    mutateStrokes(); erasedIds.current = new Set();
  }

  // --- API ---
  const createNode = useCallback(async (x: number, y: number) => {
    // Optimistic: add temp node immediately
    const tempId = `temp-${Date.now()}`;
    const tempNode: CanvasNode = { id: tempId, userId: null, title: "New task", description: "", status: "not_started", owner: "", estimatedHours: null, x, y, connectedTo: [], createdBy: null, lastEditedBy: null, createdAt: "", updatedAt: "" };
    mutateNodes([...nodes, tempNode], false);

    const res = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New task", x, y }) });
    const node = await res.json();
    mutateNodes();
    setRenamingId(node.id);
    setRenameValue(node.title);
    pushUndo({ type: "create_node", data: { id: node.id } });
  }, [mutateNodes, nodes]);

  const updateNode = useCallback(async (id: string, updates: Partial<CanvasNode>) => {
    await fetch(`/api/canvas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    mutateNodes();
  }, [mutateNodes]);

  const deleteNode = useCallback(async (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (node) pushUndo({ type: "delete_node", data: { ...node } });
    await fetch(`/api/canvas/${id}`, { method: "DELETE" });
    for (const n of nodes) {
      if (n.connectedTo.includes(id)) {
        fetch(`/api/canvas/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectedTo: n.connectedTo.filter((c) => c !== id) }) });
      }
    }
    mutateNodes(); setSelectedId(null);
  }, [mutateNodes, nodes]);

  const saveStroke = useCallback(async (points: { x: number; y: number }[]) => {
    if (points.length < 2) return;
    await fetch("/api/canvas/strokes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points, color: "#000000", width: 2 }) });
    mutateStrokes();
  }, [mutateStrokes]);

  const assignOwner = useCallback(async (nodeId: string, ownerEmail: string) => {
    await updateNode(nodeId, { owner: ownerEmail });
    if (ownerEmail && ownerEmail !== session?.user?.email) {
      const node = nodes.find((n) => n.id === nodeId);
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerEmail, type: "task_assigned", title: node?.title || "Task", sourceId: nodeId, sourcePage: "technical" }) });
    }
  }, [updateNode, session?.user?.email, nodes]);

  const markNotifRead = useCallback(async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    mutateNotifs();
  }, [mutateNotifs]);

  function saveRename(id: string) {
    if (renameValue.trim()) updateNode(id, { title: renameValue.trim() });
    setRenamingId(null);
  }

  async function clearAll() {
    await Promise.all([
      ...nodes.map((n) => fetch(`/api/canvas/${n.id}`, { method: "DELETE" })),
      ...strokes.map((s) => fetch("/api/canvas/strokes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id }) })),
    ]);
    mutateNodes(); mutateStrokes(); setSelectedId(null); setConfirmClear(false);
  }

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

  function connectNodes(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = nodes.find((n) => n.id === fromId);
    if (from && !from.connectedTo.includes(toId)) {
      updateNode(fromId, { connectedTo: [...from.connectedTo, toId] });
      pushUndo({ type: "create_arrow", data: { fromId, toId } });
    }
  }

  // --- Mouse handlers ---
  function handleMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-card]") || target.closest("[data-connector]")) return;
    if (!canvasRef.current?.contains(target)) return;
    const pt = toCanvas(e.clientX, e.clientY);

    if (tool === "eraser") {
      isErasing.current = true; erasedIds.current = new Set(); eraseQueue.current = [];
      eraseAt(pt.x, pt.y);
      mutateStrokes(strokes.filter((s) => !erasedIds.current.has(s.id)), false);
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
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    setSelectedId(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    // Arrow drag preview
    if (arrowDrag) {
      const pt = toCanvas(e.clientX, e.clientY);
      setArrowDrag({ ...arrowDrag, mx: pt.x, my: pt.y });
      return;
    }
    if (isErasing.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      const prevSize = erasedIds.current.size;
      eraseAt(pt.x, pt.y);
      if (erasedIds.current.size > prevSize) mutateStrokes(strokes.filter((s) => !erasedIds.current.has(s.id)), false);
      return;
    }
    if (isDrawing.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      setCurrentStroke((prev) => {
        const last = prev[prev.length - 1];
        if (last && (pt.x - last.x) ** 2 + (pt.y - last.y) ** 2 > MIN_POINT_DIST * MIN_POINT_DIST) return [...prev, pt];
        return prev;
      });
      return;
    }
    if (isPanning.current) { setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); return; }
    if (draggingNode.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      mutateNodes(nodes.map((n) => n.id === draggingNode.current ? { ...n, x: Math.round(pt.x - dragOffset.current.x), y: Math.round(pt.y - dragOffset.current.y) } : n), false);
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    // Arrow drag complete
    if (arrowDrag) {
      const pt = toCanvas(e.clientX, e.clientY);
      const targetId = nodeAtPoint(pt.x, pt.y);
      if (targetId) connectNodes(arrowDrag.fromId, targetId);
      setArrowDrag(null);
      return;
    }
    if (isErasing.current) { isErasing.current = false; flushErase(); return; }
    if (isDrawing.current) {
      isDrawing.current = false;
      setCurrentStroke((pts) => {
        if (pts.length > 1) {
          const sn = nodeAtPoint(pts[0].x, pts[0].y);
          const en = nodeAtPoint(pts[pts.length - 1].x, pts[pts.length - 1].y);
          if (sn && en && sn !== en) connectNodes(sn, en);
          else saveStroke(pts);
        }
        return [];
      });
      return;
    }
    isPanning.current = false;
    if (draggingNode.current) {
      const n = nodes.find((x) => x.id === draggingNode.current);
      if (n) updateNode(draggingNode.current, { x: n.x, y: n.y });
      draggingNode.current = null;
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-card]")) return;
    const pt = toCanvas(e.clientX, e.clientY);
    createNode(Math.round(pt.x), Math.round(pt.y));
  }

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    if (tool === "eraser") return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    draggingNode.current = nodeId;
    const pt = toCanvas(e.clientX, e.clientY);
    dragOffset.current = { x: pt.x - node.x, y: pt.y - node.y };
    setSelectedId(nodeId);
  }

  // Connector dot mousedown — starts arrow drag
  function handleConnectorDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setArrowDrag({ fromId: nodeId, mx: node.x + CARD_W, my: node.y + CARD_H / 2 });
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

  // Keyboard shortcuts — after all fn declarations
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest("input,textarea,select")) return;
      if (e.key === "Escape") { setRenamingId(null); setSelectedId(null); setZoom(1); setPan({ x: 50, y: 50 }); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && isAdmin) deleteNode(selectedId);
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const timelineStart = new Date();
  const logEntries = [...nodes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 30);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="h-full flex items-center justify-center"><span className="text-xs font-mono text-neutral-400">Loading...</span></div>;
  }

  const cursorStyle = tool === "eraser" ? ERASER_CURSOR : tool === "draw" ? "crosshair" : arrowDrag ? "crosshair" : undefined;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <nav className="w-full border-b border-neutral-100 shrink-0 bg-white" style={{ position: "relative", zIndex: 50 }}>
        <div className="max-w-full mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[10px] font-mono text-neutral-400 hover:text-black">&larr; Back</Link>
            <span className="text-neutral-200">|</span>
            <Link href="/" className="text-base tracking-tight"><Logo /></Link>
            <span className="text-xs font-mono uppercase tracking-widest text-black border-b border-black pb-0.5">Technical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-neutral-200 rounded overflow-hidden">
              {([
                { key: "select" as const, label: "Select", icon: "↖" },
                { key: "draw" as const, label: "Draw", icon: "✎" },
                { key: "eraser" as const, label: "Eraser", icon: "◯" },
              ]).map(({ key: t, label, icon }) => (
                <button key={t} onClick={() => setTool(t)}
                  className={`text-[10px] font-mono px-2 py-1 transition-colors flex items-center gap-1 ${
                    tool === t ? (t === "eraser" ? "bg-red-500 text-white" : "bg-black text-white") : "bg-transparent text-neutral-500 hover:bg-neutral-50"
                  }`}><span className="text-[11px]">{icon}</span><span>{label}</span></button>
              ))}
            </div>
            <span className="text-neutral-200">|</span>
            <button onClick={() => setShowTimeline(!showTimeline)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${showTimeline ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"}`}>Timeline</button>
            {showTimeline && (
              <select value={timelineWeeks} onChange={(e) => {
                const w = parseInt(e.target.value); setTimelineWeeks(w);
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) { setZoom(Math.max(0.2, Math.min((rect.width - 100) / (w * 120), 2))); setPan({ x: 50, y: 50 }); }
              }} className="text-[10px] font-mono border border-neutral-200 rounded px-1.5 py-0.5 outline-none">
                <option value="4">4w</option><option value="8">8w</option><option value="12">12w</option><option value="26">6m</option><option value="52">1y</option>
              </select>
            )}
            <span className="text-neutral-200">|</span>
            <button onClick={() => setShowLog(!showLog)} className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${showLog ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200 hover:border-black"}`}>Log</button>
            {isAdmin && (
              confirmClear ? (
                <div className="flex items-center gap-1 border border-red-300 rounded px-2 py-0.5 bg-red-50">
                  <span className="text-[9px] font-mono text-red-600">Clear all?</span>
                  <button onClick={clearAll} className="text-[9px] font-mono text-red-600 font-bold px-1">Yes</button>
                  <button onClick={() => setConfirmClear(false)} className="text-[9px] font-mono text-neutral-400 px-1">No</button>
                </div>
              ) : <button onClick={() => setConfirmClear(true)} className="text-[10px] font-mono px-2.5 py-1 rounded border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-300">Clear</button>
            )}
            <div className="flex items-center border border-neutral-200 rounded overflow-hidden">
              <button onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))} className="text-[10px] font-mono px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-50">−</button>
              <span className="text-[10px] font-mono text-neutral-400 px-1 border-x border-neutral-200">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="text-[10px] font-mono px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-50">+</button>
            </div>
            <button onClick={() => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) { setZoom(1); setPan({ x: 50, y: 50 }); return; }
              setZoom(Math.max(0.2, Math.min((rect.width - 100) / (timelineWeeks * 120), 2)));
              setPan({ x: 50, y: 50 });
            }} className="text-[10px] font-mono text-neutral-400 hover:text-black px-1">Reset</button>
            {/* Undo/Redo indicators */}
            <span className="text-[9px] font-mono text-neutral-300">{undoStack.length > 0 ? `⌘Z(${undoStack.length})` : ""}</span>
            <div className="relative ml-1">
              <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markNotifRead("all"); }}
                className="text-[10px] font-mono text-neutral-400 hover:text-black relative px-1.5 py-0.5 border border-neutral-200 rounded">
                Inbox{unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-8 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-neutral-100"><span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Notifications</span></div>
                  {notifs.length === 0 ? <p className="p-3 text-[10px] font-mono text-neutral-300">No notifications</p>
                  : notifs.map((n) => (
                    <button key={n.id} onClick={() => { if (n.sourceId) { setSelectedId(n.sourceId); const nd = nodes.find((x) => x.id === n.sourceId); if (nd) setPan({ x: -nd.x * zoom + 400, y: -nd.y * zoom + 300 }); } setShowNotifs(false); }}
                      className={`w-full text-left p-3 border-b border-neutral-50 hover:bg-neutral-50 ${n.read ? "opacity-50" : ""}`}>
                      <p className="text-[10px] font-medium text-black">{n.title}</p>
                      <p className="text-[9px] font-mono text-neutral-400 mt-0.5">from {n.fromUser?.split("@")[0] || "?"}</p>
                    </button>
                  ))}
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
          onMouseLeave={() => { isPanning.current = false; setArrowDrag(null); if (isErasing.current) { isErasing.current = false; flushErase(); } if (isDrawing.current) { isDrawing.current = false; setCurrentStroke([]); }
            if (draggingNode.current) { const n = nodes.find((x) => x.id === draggingNode.current); if (n) updateNode(draggingNode.current, { x: n.x, y: n.y }); draggingNode.current = null; } }}
          onDoubleClick={handleDoubleClick}
          onWheel={(e) => {
            e.preventDefault();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const factor = e.deltaY > 0 ? 0.95 : 1.05;
            const newZoom = Math.max(0.2, Math.min(4, zoom * factor));
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            setPan({ x: mx - (mx - pan.x) * (newZoom / zoom), y: my - (my - pan.y) * (newZoom / zoom) });
            setZoom(newZoom);
          }}>

          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
            backgroundSize: `${30 * zoom}px ${30 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px`,
          }} />

          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            {showTimeline && (
              <div className="absolute pointer-events-none" style={{ left: 0, top: 20, width: `${timelineWeeks * 120}px`, zIndex: 5 }}>
                <div className="h-px bg-neutral-300 w-full" style={{ opacity: 0.4 }} />
                {Array.from({ length: timelineWeeks + 1 }).map((_, i) => {
                  const d = new Date(timelineStart.getTime() + i * 7 * 86400000);
                  return (
                    <div key={i} className="absolute" style={{ left: i * 120, top: -6 }}>
                      <div className="w-px h-3 bg-neutral-300" style={{ opacity: 0.4 }} />
                      <span className="text-[9px] font-mono text-neutral-400 block mt-1 whitespace-nowrap" style={{ opacity: 0.6 }}>
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <svg className="absolute" style={{ width: "10000px", height: "10000px" }}>
              <defs>
                <marker id="canvas-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                </marker>
              </defs>
              {/* Arrows */}
              {arrows.map(({ from, to, key }) => {
                const x1 = from.x + CARD_W, y1 = from.y + CARD_H / 2;
                const x2 = to.x, y2 = to.y + CARD_H / 2;
                const dx = x2 - x1;
                const cx1 = x1 + dx * 0.4, cx2 = x2 - dx * 0.4;
                const pathD = `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;
                return (
                  <g key={key}>
                    <path d={pathD} fill="none" stroke="transparent" strokeWidth={Math.max(24, 24 / zoom)} style={{ cursor: "pointer", pointerEvents: "stroke" }}
                      onClick={(e) => { e.stopPropagation(); deleteArrow(from.id, to.id); }} />
                    <path d={pathD} fill="none" stroke="#9ca3af" strokeWidth={1.5} markerEnd="url(#canvas-arrow)" style={{ pointerEvents: "none" }} />
                  </g>
                );
              })}
              {/* Arrow drag preview */}
              {arrowDrag && (() => {
                const from = nodes.find((n) => n.id === arrowDrag.fromId);
                if (!from) return null;
                const x1 = from.x + CARD_W, y1 = from.y + CARD_H / 2;
                return <line x1={x1} y1={y1} x2={arrowDrag.mx} y2={arrowDrag.my} stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#canvas-arrow)" style={{ pointerEvents: "none" }} />;
              })()}
              {/* Strokes */}
              {strokes.map((s) => (
                <path key={s.id} d={pointsToPath(s.points)} fill="none" stroke={s.color || "#000"} strokeWidth={s.width || 2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.5} style={{ pointerEvents: "none" }} />
              ))}
              {currentStroke.length > 1 && (
                <path d={pointsToPath(currentStroke)} fill="none" stroke="#000" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.35} style={{ pointerEvents: "none" }} />
              )}
            </svg>

            {/* Cards */}
            {nodes.map((node) => {
              const sel = selectedId === node.id;
              const renaming = renamingId === node.id;
              return (
                <div key={node.id} data-card className="absolute select-none"
                  style={{ left: node.x, top: node.y, width: CARD_W, zIndex: sel ? 20 : 1 }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}>
                  <div className={`border rounded-lg transition-all ${
                    sel ? "bg-white border-black shadow-md" : "bg-white border-neutral-200 hover:border-neutral-400 shadow-sm"
                  }`}>
                    <div className="p-2.5">
                      {/* Status dot + title (click to rename) */}
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          node.status === "done" ? "bg-green-500" : node.status === "in_progress" ? "bg-blue-500" : node.status === "blocked" ? "bg-red-500" : "bg-neutral-300"
                        }`} />
                        {renaming ? (
                          <input className="text-[10px] font-medium text-black bg-transparent border-b border-black outline-none w-full"
                            value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => saveRename(node.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveRename(node.id); if (e.key === "Escape") setRenamingId(null); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus />
                        ) : (
                          <span className="text-[10px] font-medium text-black truncate cursor-text"
                            onClick={(e) => { e.stopPropagation(); setRenamingId(node.id); setRenameValue(node.title); }}>
                            {node.title}
                          </span>
                        )}
                      </div>
                      {/* Description hidden — uncomment to re-enable:
                      {node.description && <p className="text-[9px] text-neutral-500 mt-0.5 truncate">{node.description}</p>}
                      */}
                      {node.owner && <p className="text-[9px] font-mono text-blue-500 mt-0.5">@{node.owner.split("@")[0]}</p>}
                      {node.estimatedHours != null && node.estimatedHours > 0 && <span className="text-[8px] font-mono text-neutral-400">~{node.estimatedHours}h</span>}

                      {/* Controls when selected */}
                      {sel && (
                        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-neutral-100 flex-wrap" onMouseDown={(e) => e.stopPropagation()}>
                          <select value={node.status} onChange={(e) => updateNode(node.id, { status: e.target.value as GoalStatus })}
                            className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>
                          <select value={node.owner || ""} onChange={(e) => assignOwner(node.id, e.target.value)}
                            className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                            <option value="">Assign</option>
                            {team.map((email) => <option key={email} value={email}>{email.split("@")[0]}</option>)}
                          </select>
                          {isAdmin && (
                            <button onClick={() => deleteNode(node.id)} className="text-[9px] font-mono text-neutral-400 hover:text-red-500 px-1">Del</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Right-side connector dot for arrows — visible on hover/select */}
                  <div data-connector
                    className={`absolute w-3 h-3 rounded-full border-2 border-neutral-300 bg-white hover:bg-blue-400 hover:border-blue-400 cursor-crosshair transition-all ${sel ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    style={{ right: -6, top: CARD_H / 2 - 6 }}
                    onMouseDown={(e) => handleConnectorDown(e, node.id)} />
                  {/* Left-side connector (target) */}
                  <div data-connector
                    className={`absolute w-3 h-3 rounded-full border-2 border-neutral-300 bg-white transition-all ${arrowDrag ? "opacity-100 hover:bg-green-400 hover:border-green-400" : sel ? "opacity-100" : "opacity-0"}`}
                    style={{ left: -6, top: CARD_H / 2 - 6 }} />
                </div>
              );
            })}
          </div>

          {nodes.length === 0 && strokes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm font-mono text-neutral-400">Double-click to add a task</p>
                <p className="text-[10px] font-mono text-neutral-300 mt-1">Drag connector dots to link &middot; Click title to rename &middot; Del to delete</p>
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
                  <p className="text-[9px] font-mono text-neutral-400">By {node.createdBy?.split("@")[0] || "?"}</p>
                  {node.owner && <p className="text-[9px] font-mono text-blue-500">@{node.owner.split("@")[0]}</p>}
                  <p className="text-[8px] font-mono text-neutral-300">{new Date(node.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
              {logEntries.length === 0 && <p className="text-[10px] font-mono text-neutral-300">No activity</p>}
            </div>
          </div>
        )}
      </div>

      <ChatBubble initialMessages={chatMsgs} onSendMessage={chatSendMessage} onClearChat={clearChat} page="technical" />
    </div>
  );
}
