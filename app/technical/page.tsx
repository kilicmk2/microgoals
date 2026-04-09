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

const fetcher = async (url: string) => { const r = await fetch(url); if (!r.ok) return []; return r.json(); };
const STATUS_OPTIONS: GoalStatus[] = ["not_started", "in_progress", "done", "blocked"];

interface Stroke { id: string; points: { x: number; y: number }[]; color: string; width: number; createdBy: string | null; }
interface Notification { id: string; type: string; title: string; sourceId: string | null; sourcePage: string | null; fromUser: string | null; read: boolean; createdAt: string; }
interface UndoAction { type: string; data: Record<string, unknown>; }

const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='none' stroke='%23666' stroke-width='2'/%3E%3C/svg%3E") 12 12, auto`;

// Compute card dimensions (auto-width based on title)
const MIN_W = 120;
const MAX_W = 300;
const CARD_H = 44;
function cardW(title: string): number {
  // Rough: 6px per char + padding
  return Math.max(MIN_W, Math.min(MAX_W, title.length * 6.5 + 50));
}

// Edge point with outward direction normal
interface EdgePoint { x: number; y: number; nx: number; ny: number }

function edgePoints(from: CanvasNode, to: CanvasNode): { p1: EdgePoint; p2: EdgePoint } {
  const fw = cardW(from.title), tw = cardW(to.title);
  const fcx = from.x + fw / 2, fcy = from.y + CARD_H / 2;
  const tcx = to.x + tw / 2, tcy = to.y + CARD_H / 2;

  // 4 edge midpoints with outward normals for each card
  const fromEdges: EdgePoint[] = [
    { x: from.x + fw, y: fcy, nx: 1, ny: 0 },      // right
    { x: from.x, y: fcy, nx: -1, ny: 0 },            // left
    { x: fcx, y: from.y + CARD_H, nx: 0, ny: 1 },   // bottom
    { x: fcx, y: from.y, nx: 0, ny: -1 },             // top
  ];
  const toEdges: EdgePoint[] = [
    { x: to.x, y: tcy, nx: -1, ny: 0 },               // left
    { x: to.x + tw, y: tcy, nx: 1, ny: 0 },           // right
    { x: tcx, y: to.y, nx: 0, ny: -1 },                // top
    { x: tcx, y: to.y + CARD_H, nx: 0, ny: 1 },      // bottom
  ];

  // Pick pair with shortest distance
  let best = { p1: fromEdges[0], p2: toEdges[0] };
  let bestDist = Infinity;
  for (const fe of fromEdges) {
    for (const te of toEdges) {
      const d = (fe.x - te.x) ** 2 + (fe.y - te.y) ** 2;
      if (d < bestDist) { bestDist = d; best = { p1: fe, p2: te }; }
    }
  }
  return best;
}

export default function TechnicalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const authenticated = status === "authenticated";
  const { data: nodes = [], mutate: mutateNodes } = useSWR<CanvasNode[]>(authenticated ? "/api/canvas" : null, fetcher);
  const { data: strokes = [], mutate: mutateStrokes } = useSWR<Stroke[]>(authenticated ? "/api/canvas/strokes" : null, fetcher);
  const { data: team = [] } = useSWR<string[]>(authenticated ? "/api/team" : null, fetcher);
  const { data: notifs = [], mutate: mutateNotifs } = useSWR<Notification[]>(authenticated ? "/api/notifications" : null, fetcher);
  const { data: snapshots = [], mutate: mutateSnapshots } = useSWR<{ id: string; label: string; createdBy: string; createdAt: string }[]>(authenticated ? "/api/canvas/snapshots" : null, fetcher);
  const { messages: chatMsgs, sendMessage: chatSend, clearChat } = useChatMessages("technical");
  const chatSendMessage = useCallback(async (c: string) => { const r = await chatSend(c); mutateNodes(); return r; }, [chatSend, mutateNodes]);

  const isAdmin = TECHNICAL_ADMINS.includes(session?.user?.email ?? "");
  const unreadCount = notifs.filter((n) => !n.read).length;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [tool, setTool] = useState<"select" | "draw" | "eraser">("select");
  const [showTimeline, setShowTimeline] = useState(true);
  const [timelineWeeks, setTimelineWeeks] = useState(12);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshotIndex, setSnapshotIndex] = useState(-1); // -1 = current live state
  const [isRestoring, setIsRestoring] = useState(false);
  const [arrowDrag, setArrowDrag] = useState<{ fromId: string; mx: number; my: number } | null>(null);
  // Selection rectangle
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selRectStart = useRef<{ x: number; y: number } | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  // Keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
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
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  const ERASE_R = 20;
  const MIN_POINT_DIST = 4;

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    // Canvas zoom handler — works for mouse wheel AND trackpad pinch
    const h = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      // ctrlKey = trackpad pinch (smaller deltaY, multiply for sensitivity)
      // no ctrlKey = mouse wheel (larger deltaY)
      const sensitivity = e.ctrlKey ? 0.01 : 0.002;
      const nz = Math.max(0.15, Math.min(5, zoomRef.current * (1 - e.deltaY * sensitivity)));
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const p = panRef.current;
      setPan({ x: mx - (mx - p.x) * (nz / zoomRef.current), y: my - (my - p.y) * (nz / zoomRef.current) });
      setZoom(nz);
    };
    el.addEventListener("wheel", h, { passive: false });
    // Block browser zoom globally while on this page
    const docH = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    document.addEventListener("wheel", docH, { passive: false });
    // Also block gesturestart/gesturechange for Safari pinch
    const gestureH = (e: Event) => { e.preventDefault(); };
    document.addEventListener("gesturestart", gestureH);
    document.addEventListener("gesturechange", gestureH);
    return () => {
      el.removeEventListener("wheel", h);
      document.removeEventListener("wheel", docH);
      document.removeEventListener("gesturestart", gestureH);
      document.removeEventListener("gesturechange", gestureH);
    };
  }, []);

  function pushUndo(a: UndoAction) { setUndoStack((s) => [...s.slice(-30), a]); setRedoStack([]); }
  function handleUndo() {
    setUndoStack((s) => {
      if (!s.length) return s;
      const a = s[s.length - 1]; setRedoStack((r) => [...r, a]);
      if (a.type === "create_node") fetch(`/api/canvas/${a.data.id}`, { method: "DELETE" }).then(() => mutateNodes());
      else if (a.type === "delete_node") fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a.data) }).then(() => mutateNodes());
      return s.slice(0, -1);
    });
  }
  function handleRedo() {
    setRedoStack((s) => {
      if (!s.length) return s;
      const a = s[s.length - 1]; setUndoStack((u) => [...u, a]);
      if (a.type === "create_node") fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a.data) }).then(() => mutateNodes());
      else if (a.type === "delete_node") fetch(`/api/canvas/${a.data.id}`, { method: "DELETE" }).then(() => mutateNodes());
      return s.slice(0, -1);
    });
  }

  function toCanvas(cx: number, cy: number) {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  }

  function nodeAtPoint(cx: number, cy: number): string | null {
    for (const n of nodes) { if (cx >= n.x && cx <= n.x + cardW(n.title) && cy >= n.y && cy <= n.y + CARD_H) return n.id; }
    return null;
  }

  function isNearCard(cx: number, cy: number): boolean {
    for (const n of nodes) { if (cx >= n.x - 20 && cx <= n.x + cardW(n.title) + 20 && cy >= n.y - 20 && cy <= n.y + CARD_H + 20) return true; }
    return false;
  }

  function eraseAt(cx: number, cy: number) {
    const R2 = ERASE_R * ERASE_R;
    for (const s of strokes) {
      if (erasedIds.current.has(s.id)) continue;
      for (let i = 0; i < s.points.length; i += 3) {
        if ((s.points[i].x - cx) ** 2 + (s.points[i].y - cy) ** 2 < R2) { erasedIds.current.add(s.id); eraseQueue.current.push(s.id); break; }
      }
    }
    // Also erase arrows
    for (const { from, to } of arrows) {
      const { p1, p2 } = edgePoints(from, to);
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        if (((p1.x + (p2.x - p1.x) * t - cx) ** 2 + (p1.y + (p2.y - p1.y) * t - cy) ** 2) < R2) { deleteArrow(from.id, to.id); break; }
      }
    }
  }

  function flushErase() {
    const ids = [...eraseQueue.current]; eraseQueue.current = [];
    ids.forEach((id) => fetch("/api/canvas/strokes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }));
    mutateStrokes(); erasedIds.current = new Set();
  }

  const createNode = useCallback(async (x: number, y: number) => {
    const tempId = `temp-${Date.now()}`;
    const tempNode: CanvasNode = { id: tempId, userId: null, title: "New task", description: "", status: "not_started", owner: "", estimatedHours: null, x, y, connectedTo: [], createdBy: null, lastEditedBy: null, createdAt: "", updatedAt: "" };
    mutateNodes([...nodes, tempNode], false);
    // Auto-snapshot before change
    fetch("/api/canvas/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "auto" }) });
    const res = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New task", x, y }) });
    const node = await res.json();
    mutateNodes();
    setRenamingId(node.id); setRenameValue(node.title);
    setSelectedIds(new Set([node.id]));
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
      if (n.connectedTo.includes(id)) fetch(`/api/canvas/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectedTo: n.connectedTo.filter((c) => c !== id) }) });
    }
    mutateNodes(); setSelectedIds((s) => { const ns = new Set(s); ns.delete(id); return ns; });
  }, [mutateNodes, nodes]);

  const deleteSelected = useCallback(async () => {
    for (const id of selectedIds) await deleteNode(id);
  }, [selectedIds, deleteNode]);

  const saveStroke = useCallback(async (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    await fetch("/api/canvas/strokes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: pts, color: "#000000", width: 2 }) });
    mutateStrokes();
  }, [mutateStrokes]);

  const assignOwner = useCallback(async (nodeId: string, email: string) => {
    await updateNode(nodeId, { owner: email });
    if (email && email !== session?.user?.email) {
      const node = nodes.find((n) => n.id === nodeId);
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: email, type: "task_assigned", title: node?.title || "Task", sourceId: nodeId, sourcePage: "technical" }) });
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

  // Save a snapshot of current canvas state
  async function saveSnapshot(label = "auto") {
    await fetch("/api/canvas/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    mutateSnapshots();
  }

  // Restore a snapshot
  async function restoreSnapshot(snapshotId: string) {
    setIsRestoring(true);
    await fetch("/api/canvas/snapshots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId }) });
    await mutateNodes(); await mutateStrokes(); await mutateSnapshots();
    setSelectedIds(new Set()); setShowHistory(false); setIsRestoring(false);
  }

  // Back: go to previous snapshot (older)
  async function goBack() {
    if (isRestoring) return;
    const newIdx = snapshotIndex + 1;
    if (newIdx >= snapshots.length) return;
    // If at live state (-1), save current state first
    if (snapshotIndex === -1) {
      await saveSnapshot("before-navigate");
      await mutateSnapshots();
    }
    // snapshots are newest-first, so index 0 = most recent, 1 = older, etc.
    const snap = snapshots[newIdx];
    if (!snap) return;
    setSnapshotIndex(newIdx);
    setIsRestoring(true);
    await fetch("/api/canvas/snapshots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId: snap.id }) });
    await mutateNodes(); await mutateStrokes(); await mutateSnapshots();
    setSelectedIds(new Set()); setIsRestoring(false);
  }

  // Forward: go to newer snapshot
  async function goForward() {
    if (isRestoring) return;
    if (snapshotIndex <= 0) { setSnapshotIndex(-1); return; }
    const newIdx = snapshotIndex - 1;
    // snapshots[0] is newest
    // But after navigating, new "pre-restore" snapshots were created
    // So we need to re-fetch and go to the right one
    const snap = snapshots[newIdx];
    if (!snap) { setSnapshotIndex(-1); return; }
    setSnapshotIndex(newIdx);
    setIsRestoring(true);
    await fetch("/api/canvas/snapshots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId: snap.id }) });
    await mutateNodes(); await mutateStrokes(); await mutateSnapshots();
    setSelectedIds(new Set()); setIsRestoring(false);
  }

  async function clearAll() {
    // Auto-snapshot before clear so we can revert
    await saveSnapshot("pre-clear");
    await Promise.all([
      ...nodes.map((n) => fetch(`/api/canvas/${n.id}`, { method: "DELETE" })),
      ...strokes.map((s) => fetch("/api/canvas/strokes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id }) })),
    ]);
    mutateNodes(); mutateStrokes(); setSelectedIds(new Set()); setConfirmClear(false);
  }

  const arrows: { from: CanvasNode; to: CanvasNode; key: string }[] = [];
  for (const n of nodes) { for (const tid of n.connectedTo) { const t = nodes.find((x) => x.id === tid); if (t) arrows.push({ from: n, to: t, key: `${n.id}-${tid}` }); } }

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

  // --- Mouse ---
  function handleMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-card]") || target.closest("[data-connector]")) return;
    if (!canvasRef.current?.contains(target)) return;
    const pt = toCanvas(e.clientX, e.clientY);

    if (tool === "eraser") {
      isErasing.current = true; erasedIds.current = new Set(); eraseQueue.current = [];
      eraseAt(pt.x, pt.y); mutateStrokes(strokes.filter((s) => !erasedIds.current.has(s.id)), false);
      return;
    }
    if (tool === "draw") {
      if (isNearCard(pt.x, pt.y)) {
        const nid = nodeAtPoint(pt.x, pt.y);
        if (nid) { const nd = nodes.find((n) => n.id === nid); if (nd) { draggingNode.current = nid; dragOffset.current = { x: pt.x - nd.x, y: pt.y - nd.y }; setSelectedIds(new Set([nid])); } }
        return;
      }
      isDrawing.current = true; setCurrentStroke([pt]); return;
    }
    // Select tool: start selection rectangle or pan
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Start selection rectangle
      selRectStart.current = pt;
      setSelRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    if (!e.ctrlKey && !e.metaKey) setSelectedIds(new Set());
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (arrowDrag) { const pt = toCanvas(e.clientX, e.clientY); setArrowDrag({ ...arrowDrag, mx: pt.x, my: pt.y }); return; }
    // Selection rectangle
    if (selRectStart.current && selRect) {
      const pt = toCanvas(e.clientX, e.clientY);
      const sx = Math.min(selRectStart.current.x, pt.x), sy = Math.min(selRectStart.current.y, pt.y);
      const w = Math.abs(pt.x - selRectStart.current.x), h = Math.abs(pt.y - selRectStart.current.y);
      setSelRect({ x: sx, y: sy, w, h });
      // Select nodes inside rect
      const inside = new Set<string>();
      for (const n of nodes) {
        const cw = cardW(n.title);
        if (n.x + cw > sx && n.x < sx + w && n.y + CARD_H > sy && n.y < sy + h) inside.add(n.id);
      }
      setSelectedIds(inside);
      return;
    }
    if (isErasing.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      const prev = erasedIds.current.size;
      eraseAt(pt.x, pt.y);
      if (erasedIds.current.size > prev) mutateStrokes(strokes.filter((s) => !erasedIds.current.has(s.id)), false);
      return;
    }
    if (isDrawing.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      setCurrentStroke((p) => { const l = p[p.length - 1]; if (l && (pt.x - l.x) ** 2 + (pt.y - l.y) ** 2 > MIN_POINT_DIST ** 2) return [...p, pt]; return p; });
      return;
    }
    if (isPanning.current) { setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); return; }
    if (draggingNode.current) {
      const pt = toCanvas(e.clientX, e.clientY);
      const dx = pt.x - dragOffset.current.x, dy = pt.y - dragOffset.current.y;
      // Move all selected nodes if dragging one of them
      if (selectedIds.has(draggingNode.current) && selectedIds.size > 1) {
        const orig = nodes.find((n) => n.id === draggingNode.current);
        if (orig) {
          const ox = Math.round(dx) - orig.x, oy = Math.round(dy) - orig.y;
          mutateNodes(nodes.map((n) => selectedIds.has(n.id) ? { ...n, x: n.x + ox, y: n.y + oy } : n), false);
        }
      } else {
        mutateNodes(nodes.map((n) => n.id === draggingNode.current ? { ...n, x: Math.round(dx), y: Math.round(dy) } : n), false);
      }
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (arrowDrag) {
      const pt = toCanvas(e.clientX, e.clientY);
      const tid = nodeAtPoint(pt.x, pt.y);
      if (tid) connectNodes(arrowDrag.fromId, tid);
      setArrowDrag(null); return;
    }
    if (selRectStart.current) { selRectStart.current = null; setSelRect(null); return; }
    if (isErasing.current) { isErasing.current = false; flushErase(); return; }
    if (isDrawing.current) {
      isDrawing.current = false;
      setCurrentStroke((pts) => {
        if (pts.length > 1) {
          const sn = nodeAtPoint(pts[0].x, pts[0].y), en = nodeAtPoint(pts[pts.length - 1].x, pts[pts.length - 1].y);
          if (sn && en && sn !== en) connectNodes(sn, en); else saveStroke(pts);
        }
        return [];
      });
      return;
    }
    isPanning.current = false;
    if (draggingNode.current) {
      // Save all moved nodes
      if (selectedIds.has(draggingNode.current) && selectedIds.size > 1) {
        for (const id of selectedIds) { const n = nodes.find((x) => x.id === id); if (n) updateNode(id, { x: n.x, y: n.y }); }
      } else {
        const n = nodes.find((x) => x.id === draggingNode.current); if (n) updateNode(draggingNode.current, { x: n.x, y: n.y });
      }
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

    // Ctrl/Cmd+click: toggle multi-select
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((s) => { const ns = new Set(s); if (ns.has(nodeId)) ns.delete(nodeId); else ns.add(nodeId); return ns; });
      return;
    }

    if (!selectedIds.has(nodeId)) setSelectedIds(new Set([nodeId]));
    draggingNode.current = nodeId;
    const pt = toCanvas(e.clientX, e.clientY);
    dragOffset.current = { x: pt.x - node.x, y: pt.y - node.y };
  }

  function handleConnectorDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const cw = cardW(node.title);
    setArrowDrag({ fromId: nodeId, mx: node.x + cw / 2, my: node.y + CARD_H / 2 });
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest("input,textarea,select")) return;
      if (e.key === "Escape") { setRenamingId(null); setSelectedIds(new Set()); setZoom(1); setPan({ x: 50, y: 50 }); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0 && isAdmin) deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
      // Ctrl+A select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); setSelectedIds(new Set(nodes.map((n) => n.id))); }
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
      <nav className="w-full border-b border-neutral-100 bg-white" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 48 }}>
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
            {/* Back / Forward */}
            <div className="flex items-center border border-neutral-200 rounded overflow-hidden">
              <button onClick={goBack} disabled={isRestoring || snapshots.length === 0}
                className="text-[11px] px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-50 disabled:opacity-20 disabled:cursor-default" title="Undo (go back)">←</button>
              <button onClick={goForward} disabled={isRestoring || snapshotIndex <= 0}
                className="text-[11px] px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-50 disabled:opacity-20 disabled:cursor-default" title="Redo (go forward)">→</button>
            </div>
            <span className="text-neutral-200">|</span>
            <button onClick={() => setShowTimeline(!showTimeline)} className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${showTimeline ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200"}`}>Timeline</button>
            {showTimeline && (
              <select value={timelineWeeks} onChange={(e) => { const w = parseInt(e.target.value); setTimelineWeeks(w); const r = canvasRef.current?.getBoundingClientRect(); if (r) { setZoom(Math.max(0.2, Math.min((r.width - 100) / (w * 120), 2))); setPan({ x: 50, y: 50 }); } }}
                className="text-[10px] font-mono border border-neutral-200 rounded px-1.5 py-0.5 outline-none">
                <option value="4">4w</option><option value="8">8w</option><option value="12">12w</option><option value="26">6m</option><option value="52">1y</option>
              </select>
            )}
            <span className="text-neutral-200">|</span>
            <button onClick={() => setShowLog(!showLog)} className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${showLog ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200"}`}>Log</button>
            <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) mutateSnapshots(); }} className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${showHistory ? "bg-black text-white border-black" : "bg-transparent text-neutral-500 border-neutral-200"}`}>History</button>
            {isAdmin && (confirmClear
              ? <div className="flex items-center gap-1 border border-red-300 rounded px-2 py-0.5 bg-red-50"><span className="text-[9px] font-mono text-red-600">Clear all?</span><button onClick={clearAll} className="text-[9px] font-mono text-red-600 font-bold px-1">Yes</button><button onClick={() => setConfirmClear(false)} className="text-[9px] font-mono text-neutral-400 px-1">No</button></div>
              : <button onClick={() => setConfirmClear(true)} className="text-[10px] font-mono px-2.5 py-1 rounded border border-neutral-200 text-neutral-400 hover:text-red-500">Clear</button>
            )}
            <div className="flex items-center border border-neutral-200 rounded overflow-hidden">
              <button onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))} className="text-[10px] font-mono px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-50">−</button>
              <span className="text-[10px] font-mono text-neutral-400 px-1 border-x border-neutral-200">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="text-[10px] font-mono px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-50">+</button>
            </div>
            <button onClick={() => { const r = canvasRef.current?.getBoundingClientRect(); if (!r) { setZoom(1); setPan({ x: 50, y: 50 }); return; } setZoom(Math.max(0.2, Math.min((r.width - 100) / (timelineWeeks * 120), 2))); setPan({ x: 50, y: 50 }); }}
              className="text-[10px] font-mono text-neutral-400 hover:text-black px-1">Reset</button>
            {selectedIds.size > 0 && <span className="text-[9px] font-mono text-blue-500">{selectedIds.size} selected</span>}
            <div className="relative ml-1">
              <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markNotifRead("all"); }}
                className="text-[10px] font-mono text-neutral-400 hover:text-black relative px-1.5 py-0.5 border border-neutral-200 rounded">
                Inbox{unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-8 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-neutral-100"><span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Notifications</span></div>
                  {notifs.length === 0 ? <p className="p-3 text-[10px] font-mono text-neutral-300">None</p>
                  : notifs.map((n) => (
                    <button key={n.id} onClick={() => { if (n.sourceId) { setSelectedIds(new Set([n.sourceId])); const nd = nodes.find((x) => x.id === n.sourceId); if (nd) setPan({ x: -nd.x * zoom + 400, y: -nd.y * zoom + 300 }); } setShowNotifs(false); }}
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

      <div style={{ height: 48 }} /> {/* spacer for fixed nav */}
      <div className="flex-1 flex overflow-hidden">
        <div ref={canvasRef} className="flex-1 relative overflow-hidden"
          style={{ background: "#fafafa", cursor: cursorStyle }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={() => { isPanning.current = false; setArrowDrag(null); selRectStart.current = null; setSelRect(null); if (isErasing.current) { isErasing.current = false; flushErase(); } if (isDrawing.current) { isDrawing.current = false; setCurrentStroke([]); }
            if (draggingNode.current) { for (const id of selectedIds) { const n = nodes.find((x) => x.id === id); if (n) updateNode(id, { x: n.x, y: n.y }); } draggingNode.current = null; } }}
          onDoubleClick={handleDoubleClick}>

          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #e5e5e5 1px, transparent 1px)", backgroundSize: `${30 * zoom}px ${30 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />

          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            {showTimeline && (
              <div className="absolute pointer-events-none" style={{ left: 0, top: 20, width: `${timelineWeeks * 120}px`, zIndex: 5 }}>
                <div className="h-px bg-neutral-300 w-full" style={{ opacity: 0.4 }} />
                {Array.from({ length: timelineWeeks + 1 }).map((_, i) => {
                  const d = new Date(timelineStart.getTime() + i * 7 * 86400000);
                  return <div key={i} className="absolute" style={{ left: i * 120, top: -6 }}>
                    <div className="w-px h-3 bg-neutral-300" style={{ opacity: 0.4 }} />
                    <span className="text-[9px] font-mono text-neutral-400 block mt-1 whitespace-nowrap" style={{ opacity: 0.6 }}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>;
                })}
              </div>
            )}

            <svg className="absolute" style={{ width: "10000px", height: "10000px" }}>
              <defs>
                <marker id="canvas-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                </marker>
              </defs>
              {arrows.map(({ from, to, key }) => {
                const { p1, p2 } = edgePoints(from, to);
                // Control points extend outward from each edge, proportional to distance
                const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                const offset = Math.min(dist * 0.4, 80); // how far control points extend
                const cx1 = p1.x + p1.nx * offset, cy1 = p1.y + p1.ny * offset;
                const cx2 = p2.x + p2.nx * offset, cy2 = p2.y + p2.ny * offset;
                const pathD = `M ${p1.x} ${p1.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${p2.x} ${p2.y}`;
                return (
                  <g key={key}>
                    <path d={pathD} fill="none" stroke="#9ca3af" strokeWidth={1.5} markerEnd="url(#canvas-arrow)" style={{ pointerEvents: "none" }} />
                  </g>
                );
              })}
              {arrowDrag && (() => {
                const from = nodes.find((n) => n.id === arrowDrag.fromId);
                if (!from) return null;
                const cw = cardW(from.title);
                const x1 = from.x + cw / 2, y1 = from.y + CARD_H / 2;
                return <line x1={x1} y1={y1} x2={arrowDrag.mx} y2={arrowDrag.my} stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#canvas-arrow)" style={{ pointerEvents: "none" }} />;
              })()}
              {/* Selection rectangle */}
              {selRect && selRect.w > 2 && (
                <rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
                  fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 2" style={{ pointerEvents: "none" }} />
              )}
              {strokes.map((s) => (
                <path key={s.id} d={pointsToPath(s.points)} fill="none" stroke={s.color || "#000"} strokeWidth={s.width || 2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.5} style={{ pointerEvents: "none" }} />
              ))}
              {currentStroke.length > 1 && (
                <path d={pointsToPath(currentStroke)} fill="none" stroke="#000" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.35} style={{ pointerEvents: "none" }} />
              )}
            </svg>

            {nodes.map((node) => {
              const sel = selectedIds.has(node.id);
              const renaming = renamingId === node.id;
              const cw = cardW(node.title);
              return (
                <div key={node.id} data-card className="absolute select-none group"
                  style={{ left: node.x, top: node.y, zIndex: sel ? 20 : 1 }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}>
                  <div className={`border rounded-lg transition-all inline-block ${
                    sel ? "bg-white border-black shadow-md" : "bg-white border-neutral-200 hover:border-neutral-400 shadow-sm"
                  }`} style={{ minWidth: MIN_W, maxWidth: MAX_W }}>
                    <div className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          node.status === "done" ? "bg-green-500" : node.status === "in_progress" ? "bg-blue-500" : node.status === "blocked" ? "bg-red-500" : "bg-neutral-300"
                        }`} />
                        {renaming ? (
                          <input className="text-[10px] font-medium text-black bg-transparent border-b border-black outline-none"
                            style={{ width: Math.max(60, renameValue.length * 6.5 + 10) }}
                            value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => saveRename(node.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveRename(node.id); if (e.key === "Escape") setRenamingId(null); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => e.target.select()}
                            autoFocus />
                        ) : (
                          <span className="text-[10px] font-medium text-black cursor-text whitespace-nowrap"
                            onClick={(e) => { e.stopPropagation(); setRenamingId(node.id); setRenameValue(node.title); }}>
                            {node.title}
                          </span>
                        )}
                      </div>
                      {node.owner && <p className="text-[9px] font-mono text-blue-500 mt-0.5">@{node.owner.split("@")[0]}</p>}
                      {node.estimatedHours != null && node.estimatedHours > 0 && <span className="text-[8px] font-mono text-neutral-400">~{node.estimatedHours}h</span>}
                      {sel && (
                        <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-neutral-100 flex-wrap" onMouseDown={(e) => e.stopPropagation()}>
                          <select value={node.status} onChange={(e) => updateNode(node.id, { status: e.target.value as GoalStatus })}
                            className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>
                          <select value={node.owner || ""} onChange={(e) => assignOwner(node.id, e.target.value)}
                            className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 py-0.5 outline-none cursor-pointer">
                            <option value="">Assign</option>
                            {team.map((em) => <option key={em} value={em}>{em.split("@")[0]}</option>)}
                          </select>
                          {isAdmin && <button onClick={() => deleteNode(node.id)} className="text-[9px] font-mono text-neutral-400 hover:text-red-500 px-1">Del</button>}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Connector dots on all 4 sides */}
                  {[
                    { cx: cw, cy: CARD_H / 2, side: "right" },
                    { cx: 0, cy: CARD_H / 2, side: "left" },
                    { cx: cw / 2, cy: 0, side: "top" },
                    { cx: cw / 2, cy: CARD_H, side: "bottom" },
                  ].map(({ cx: dotX, cy: dotY, side }) => (
                    <div key={side} data-connector
                      className={`absolute w-3 h-3 rounded-full border-2 border-neutral-300 bg-white hover:bg-blue-400 hover:border-blue-400 cursor-crosshair transition-all ${
                        sel || arrowDrag ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ left: dotX - 6, top: dotY - 6 }}
                      onMouseDown={(e) => handleConnectorDown(e, node.id)} />
                  ))}
                </div>
              );
            })}
          </div>

          {nodes.length === 0 && strokes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm font-mono text-neutral-400">Double-click to add a task</p>
                <p className="text-[10px] font-mono text-neutral-300 mt-1">Drag connector dots to link &middot; Click title to rename &middot; Shift+drag to multi-select</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panels */}
        {(showLog || showHistory) && (
          <div className="w-72 border-l border-neutral-100 bg-white overflow-y-auto shrink-0">
            {showLog && (
              <div className="p-4 border-b border-neutral-100">
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
            )}
            {showHistory && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500">Canvas History</h3>
                  <button onClick={() => { saveSnapshot("manual"); mutateSnapshots(); }}
                    className="text-[9px] font-mono text-neutral-400 hover:text-black border border-neutral-200 rounded px-1.5 py-0.5">Save now</button>
                </div>
                {snapshots.length === 0 ? (
                  <p className="text-[10px] font-mono text-neutral-300">No snapshots yet. They are created automatically before changes.</p>
                ) : (
                  snapshots.map((snap) => (
                    <div key={snap.id} className="border-b border-neutral-50 pb-2 mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium text-black">
                          {snap.label === "pre-clear" ? "Before clear" : snap.label === "pre-restore" ? "Before restore" : snap.label === "manual" ? "Manual save" : "Auto-save"}
                        </p>
                        <p className="text-[8px] font-mono text-neutral-400">
                          {snap.createdBy?.split("@")[0] || "?"} &middot; {new Date(snap.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {isAdmin && (
                        <button onClick={() => restoreSnapshot(snap.id)}
                          className="text-[9px] font-mono text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">Restore</button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ChatBubble initialMessages={chatMsgs} onSendMessage={chatSendMessage} onClearChat={clearChat} page="technical" />
    </div>
  );
}
