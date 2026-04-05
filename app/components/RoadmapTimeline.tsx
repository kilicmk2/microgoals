"use client";

import { useState } from "react";
import { Goal, GoalStatus, STATUS_CONFIG, createGoal } from "../lib/store";

interface Props {
  goals: Goal[];
  category?: string;
  isMaster?: boolean;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  onAdd: (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => void;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function RoadmapTimeline({ goals, category = "company", onUpdate, onDelete, onAdd }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDate, setEditDate] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newOwner, setNewOwner] = useState("");

  const now = new Date();
  const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endMs = new Date(now.getFullYear(), now.getMonth() + 3, 15).getTime();
  const totalDays = (endMs - startMs) / (1000 * 60 * 60 * 24);

  // Date markers
  const markers: { date: Date; pct: number }[] = [];
  {
    const d = new Date(startMs);
    const endDate = new Date(endMs);
    while (d <= endDate) {
      const dayOff = (d.getTime() - startMs) / (1000 * 60 * 60 * 24);
      markers.push({ date: new Date(d), pct: (dayOff / totalDays) * 100 });
      if (d.getDate() === 1) d.setDate(15);
      else { d.setMonth(d.getMonth() + 1); d.setDate(1); }
    }
  }

  // Milestones
  const milestones = goals
    .filter((g) => g.pinned && g.targetDate)
    .map((g) => {
      const d = new Date(g.targetDate!);
      const dayOff = (d.getTime() - startMs) / (1000 * 60 * 60 * 24);
      const pct = Math.max(2, Math.min(98, (dayOff / totalDays) * 100));
      return { ...g, date: d, pct };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Lane packing — collapsed cards are ~180px on ~1100px container = ~16%
  const OVERLAP_THRESHOLD = 14;
  type LanedMilestone = typeof milestones[number] & { lane: number };
  const laned: LanedMilestone[] = [];
  const laneSlots: number[][] = [];

  for (const m of milestones) {
    let placed = false;
    for (let li = 0; li < laneSlots.length; li++) {
      if (laneSlots[li].every((p) => Math.abs(p - m.pct) >= OVERLAP_THRESHOLD)) {
        laneSlots[li].push(m.pct);
        laned.push({ ...m, lane: li });
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneSlots.push([m.pct]);
      laned.push({ ...m, lane: laneSlots.length - 1 });
    }
  }

  const above = laned.filter((m) => m.lane % 2 === 0);
  const below = laned.filter((m) => m.lane % 2 === 1);
  const aboveRows = Math.max(1, ...above.map((m) => Math.floor(m.lane / 2) + 1));
  const belowRows = Math.max(1, ...below.map((m) => Math.floor(m.lane / 2) + 1));

  // Collapsed card = ~50px, expanded = ~180px
  const COLLAPSED_ROW = 56;
  const EXPANDED_EXTRA = 140;
  const expandedAbove = expandedId && above.some((m) => m.id === expandedId);
  const expandedBelow = expandedId && below.some((m) => m.id === expandedId);
  const aboveHeight = aboveRows * COLLAPSED_ROW + (expandedAbove ? EXPANDED_EXTRA : 0);
  const belowHeight = belowRows * COLLAPSED_ROW + (expandedBelow ? EXPANDED_EXTRA : 0);
  const AXIS_GAP = 24;
  const totalHeight = aboveHeight + belowHeight + AXIS_GAP * 2 + 10;
  const axisTop = aboveHeight + AXIS_GAP;

  function handleAdd() {
    if (!newTitle.trim() || !newDate) return;
    onAdd(createGoal({
      title: newTitle.trim(), description: newDesc.trim(), owner: newOwner.trim(),
      targetDate: newDate, horizon: "6m", category, pinned: true,
    } as Partial<Goal> & Pick<Goal, "title" | "horizon" | "category">));
    setNewTitle(""); setNewDesc(""); setNewDate(""); setNewOwner(""); setAddOpen(false);
  }

  function startEdit(m: typeof milestones[number]) {
    setEditingId(m.id); setEditTitle(m.title); setEditDesc(m.description);
    setEditOwner(m.owner); setEditDate(m.targetDate || toISO(m.date));
    setExpandedId(m.id);
  }

  function saveEdit(id: string) {
    onUpdate(id, { title: editTitle, description: editDesc, owner: editOwner, targetDate: editDate || null });
    setEditingId(null);
  }

  function handleTimelineDrop(e: React.DragEvent) {
    e.preventDefault();
    const goalId = e.dataTransfer.getData("text/plain");
    if (!goalId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const d = new Date(startMs + pct * totalDays * 86400000);
    onUpdate(goalId, { targetDate: toISO(d) });
    setDragging(false);
  }

  function stopDrag(e: React.MouseEvent) { e.stopPropagation(); }

  function renderCard(m: LanedMilestone, position: "above" | "below") {
    const row = Math.floor(m.lane / 2);
    const isExpanded = expandedId === m.id;
    const isEditing = editingId === m.id;
    const cfg = STATUS_CONFIG[m.status as GoalStatus] || STATUS_CONFIG.not_started;
    const offset = row * COLLAPSED_ROW;

    return (
      <div
        key={m.id}
        className="absolute w-44"
        style={{
          left: `${m.pct}%`,
          transform: "translateX(-50%)",
          zIndex: isExpanded ? 20 : 1,
          ...(position === "above" ? { bottom: `${offset}px` } : { top: `${offset}px` }),
        }}
        draggable={!isEditing}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", m.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
      >
        {position === "above" && <div className="w-px h-2 bg-neutral-300 mx-auto mb-1" />}
        {position === "below" && <div className="w-px h-2 bg-neutral-300 mx-auto mb-1" />}

        {/* Card */}
        <div
          className={`border rounded-lg transition-all cursor-pointer ${
            isExpanded
              ? "bg-white border-black shadow-sm p-3"
              : "bg-neutral-50 border-neutral-200 hover:border-neutral-400 px-2.5 py-1.5"
          }`}
          onClick={() => !isEditing && setExpandedId(isExpanded ? null : m.id)}
        >
          {/* Always visible: status dot + title */}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              m.status === "done" ? "bg-green-500" : m.status === "in_progress" ? "bg-blue-500" : m.status === "blocked" ? "bg-red-500" : "bg-neutral-300"
            }`} />
            <span className={`text-[10px] font-medium leading-tight ${isExpanded ? "text-black" : "text-neutral-700"} ${isExpanded ? "" : "truncate"}`}>
              {m.title}
            </span>
          </div>

          {/* Expanded details */}
          {isExpanded && !isEditing && (
            <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
              {m.description && (
                <p className="text-[10px] text-neutral-500 leading-relaxed">{m.description}</p>
              )}
              <div className="flex items-center gap-2 text-[9px] font-mono text-neutral-400">
                <span>{fmtDate(m.date)}</span>
                {m.owner && <><span>&middot;</span><span>{m.owner}</span></>}
                {m.workstream && <><span>&middot;</span><span className="bg-neutral-100 px-1 rounded">{m.workstream}</span></>}
              </div>
              {/* Controls */}
              <div className="flex items-center gap-1 pt-1" draggable={false} onMouseDown={stopDrag}>
                <select value={m.status}
                  onChange={(e) => onUpdate(m.id, { status: e.target.value as GoalStatus })}
                  className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none cursor-pointer">
                  {(["not_started", "in_progress", "done", "blocked"] as GoalStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
                <button onClick={() => startEdit(m)} className="text-[9px] font-mono text-neutral-400 hover:text-black px-1">Edit</button>
                {confirmDeleteId === m.id ? (
                  <div className="flex gap-0.5">
                    <button onClick={() => { onDelete(m.id); setConfirmDeleteId(null); setExpandedId(null); }}
                      className="text-[9px] font-mono text-red-500 hover:text-red-700 px-1">Delete</button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="text-[9px] font-mono text-neutral-400 px-1">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(m.id)}
                    className="text-[9px] font-mono text-neutral-400 hover:text-red-500 px-1">Del</button>
                )}
              </div>
            </div>
          )}

          {/* Inline edit form */}
          {isExpanded && isEditing && (
            <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <input className="w-full text-xs font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
                value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
              <textarea className="w-full text-[10px] bg-transparent border border-neutral-200 rounded p-1.5 outline-none focus:border-black resize-none"
                value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={2} />
              <div className="flex gap-2">
                <input type="date" className="text-[10px] border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-black"
                  value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                <input className="flex-1 text-[10px] bg-transparent border-b border-neutral-200 pb-0.5 outline-none focus:border-black"
                  value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => saveEdit(m.id)} className="text-[9px] font-mono px-2 py-0.5 bg-black text-white rounded hover:bg-neutral-800">Save</button>
                <button onClick={() => setEditingId(null)} className="text-[9px] font-mono text-neutral-400 hover:text-black px-1">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-black">Roadmap</h1>
          <p className="text-[10px] font-mono text-neutral-400 mt-1 uppercase tracking-widest">
            {fmtMonth(new Date(startMs))} — {fmtMonth(new Date(endMs))}
          </p>
        </div>
        <button onClick={() => setAddOpen(!addOpen)}
          className="text-xs font-mono px-4 py-2 bg-black text-white rounded hover:bg-neutral-800 transition-colors">
          + Add milestone
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="border border-neutral-200 rounded-lg p-5 mb-8 space-y-3">
          <input className="w-full text-sm font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Milestone title" autoFocus />
          <textarea className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono text-neutral-400">Date</label>
              <input type="date" className="text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-black"
                value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <input className="flex-1 text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
              value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner (optional)" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800">Add</button>
            <button onClick={() => setAddOpen(false)} className="text-xs font-mono px-3 py-1 text-neutral-400 hover:text-black">Cancel</button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !addOpen ? (
        <div className="text-center py-16">
          <p className="text-sm text-neutral-400 font-mono">No milestones yet</p>
          <p className="text-xs text-neutral-300 font-mono mt-2">
            Click &quot;+ Add milestone&quot; or pin company goals with a target date
          </p>
        </div>
      ) : milestones.length > 0 && (
        <div className="relative" style={{ height: `${totalHeight}px` }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={handleTimelineDrop}>

          {/* Above cards */}
          <div className="absolute left-0 right-0 top-0" style={{ height: `${axisTop}px` }}>
            {above.map((m) => renderCard(m, "above"))}
          </div>

          {/* Timeline axis */}
          <div className="absolute left-0 right-0" style={{ top: `${axisTop}px` }}>
            <div className={`h-px w-full relative transition-colors ${dragging ? "bg-black" : "bg-neutral-200"}`}>
              <div className={`absolute right-0 -top-[4px] w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] ${dragging ? "border-l-black" : "border-l-neutral-200"}`} />
              {markers.map((mk, i) => (
                <div key={i} className="absolute" style={{ left: `${mk.pct}%`, transform: "translateX(-50%)" }}>
                  <div className="w-px h-2 bg-neutral-300 -mt-1" />
                  <span className="text-[9px] font-mono text-neutral-400 mt-1 block whitespace-nowrap">{fmtDate(mk.date)}</span>
                </div>
              ))}
              {/* Milestone dots */}
              {milestones.map((m) => (
                <div key={m.id}
                  className={`absolute w-2 h-2 rounded-full -mt-[3px] ${
                    m.status === "done" ? "bg-green-500" : m.status === "in_progress" ? "bg-blue-500" : "bg-black"
                  }`}
                  style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }} />
              ))}
            </div>
          </div>

          {/* Below cards */}
          <div className="absolute left-0 right-0" style={{ top: `${axisTop + AXIS_GAP}px`, height: `${belowHeight}px` }}>
            {below.map((m) => renderCard(m, "below"))}
          </div>

          {dragging && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <span className="text-xs font-mono text-neutral-300 bg-white/80 px-3 py-1 rounded">Drop to reposition</span>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] font-mono text-neutral-300 text-center mt-6">
        Click card to expand &middot; Drag to reposition &middot; Click date to edit
      </p>
    </div>
  );
}
