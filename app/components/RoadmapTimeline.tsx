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

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
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

export default function RoadmapTimeline({ goals, category = "company", isMaster = false, onUpdate, onDelete, onAdd }: Props) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDate, setEditDate] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newOwner, setNewOwner] = useState("");

  // Timeline: 3 months from start of current month
  const now = new Date();
  const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endMs = new Date(now.getFullYear(), now.getMonth() + 3, 15).getTime();
  const totalDays = (endMs - startMs) / (1000 * 60 * 60 * 24);

  // Pinned goals with targetDate
  const milestones = goals
    .filter((g) => g.pinned && g.targetDate)
    .map((g) => ({ ...g, date: new Date(g.targetDate!) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by date
  const grouped: { key: string; date: Date; goals: typeof milestones }[] = [];
  for (const m of milestones) {
    const k = dateKey(m.date);
    const existing = grouped.find((g) => g.key === k);
    if (existing) {
      existing.goals.push(m);
    } else {
      grouped.push({ key: k, date: m.date, goals: [m] });
    }
  }

  // Timeline markers for the axis
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

  function handleAdd() {
    if (!newTitle.trim() || !newDate) return;
    onAdd(
      createGoal({
        title: newTitle.trim(),
        description: newDesc.trim(),
        owner: newOwner.trim(),
        targetDate: newDate,
        horizon: "6m",
        category,
        pinned: true,
      } as Partial<Goal> & Pick<Goal, "title" | "horizon" | "category">)
    );
    setNewTitle("");
    setNewDesc("");
    setNewDate("");
    setNewOwner("");
    setAddOpen(false);
  }

  function startEdit(m: typeof milestones[number]) {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditDesc(m.description);
    setEditOwner(m.owner);
    setEditDate(m.targetDate || toISO(m.date));
  }

  function saveEdit(id: string) {
    onUpdate(id, {
      title: editTitle,
      description: editDesc,
      owner: editOwner,
      targetDate: editDate || null,
    });
    setEditingId(null);
  }

  const isExpanded = (k: string) => expandedDate === k;

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-black">
            Roadmap
          </h1>
          <p className="text-[10px] font-mono text-neutral-400 mt-1 uppercase tracking-widest">
            {fmtMonth(new Date(startMs))} — {fmtMonth(new Date(endMs))}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(!addOpen)}
          className="text-xs font-mono px-4 py-2 bg-black text-white rounded hover:bg-neutral-800 transition-colors"
        >
          + Add milestone
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="border border-neutral-200 rounded-lg p-5 mb-8 space-y-3">
          <input
            className="w-full text-sm font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Milestone title" autoFocus
          />
          <textarea
            className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)" rows={2}
          />
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

      {/* Timeline axis */}
      <div className="relative h-8 mb-6">
        <div className="absolute left-0 right-0 top-3 h-px bg-neutral-200" />
        <div className="absolute right-0 top-[9px] w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-neutral-200" />
        {markers.map((mk, i) => (
          <div key={i} className="absolute" style={{ left: `${mk.pct}%`, transform: "translateX(-50%)" }}>
            <div className="w-px h-2 bg-neutral-300 mt-1" />
            <span className="text-[9px] font-mono text-neutral-400 block mt-1 whitespace-nowrap">
              {mk.date.getDate() === 1 ? fmtDate(mk.date) : `${mk.date.getDate()}`}
            </span>
          </div>
        ))}
        {/* Dots for each date group */}
        {grouped.map((g) => {
          const dayOff = (g.date.getTime() - startMs) / (1000 * 60 * 60 * 24);
          const pct = Math.max(1, Math.min(99, (dayOff / totalDays) * 100));
          const hasActive = g.goals.some((m) => m.status === "in_progress");
          const allDone = g.goals.every((m) => m.status === "done");
          return (
            <button
              key={g.key}
              onClick={() => setExpandedDate(isExpanded(g.key) ? null : g.key)}
              className={`absolute w-3 h-3 rounded-full top-[6px] -ml-1.5 transition-all hover:scale-150 ${
                allDone ? "bg-green-500" : hasActive ? "bg-blue-500" : "bg-black"
              } ${isExpanded(g.key) ? "ring-2 ring-offset-1 ring-black" : ""}`}
              style={{ left: `${pct}%` }}
              title={`${fmtDateLong(g.date)} — ${g.goals.length} milestone${g.goals.length > 1 ? "s" : ""}`}
            />
          );
        })}
      </div>

      {/* Date groups */}
      {grouped.length === 0 && !addOpen ? (
        <div className="text-center py-16">
          <p className="text-sm text-neutral-400 font-mono">No milestones yet</p>
          <p className="text-xs text-neutral-300 font-mono mt-2">
            Click &quot;+ Add milestone&quot; or pin company goals with a target date
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {grouped.map((g) => {
            const expanded = isExpanded(g.key);
            const doneCount = g.goals.filter((m) => m.status === "done").length;
            const total = g.goals.length;

            return (
              <div key={g.key} className="border-b border-neutral-100 last:border-0">
                {/* Date header — always visible */}
                <button
                  onClick={() => setExpandedDate(expanded ? null : g.key)}
                  className="w-full flex items-center gap-4 py-3 px-2 hover:bg-neutral-50 transition-colors text-left group"
                >
                  {/* Date */}
                  <span className="text-xs font-mono text-neutral-400 w-20 shrink-0">
                    {fmtDate(g.date)}
                  </span>

                  {/* Titles preview */}
                  <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    {g.goals.map((m) => {
                      const cfg = STATUS_CONFIG[m.status as GoalStatus] || STATUS_CONFIG.not_started;
                      return (
                        <span key={m.id} className="text-xs text-black truncate max-w-xs">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                            m.status === "done" ? "bg-green-500" : m.status === "in_progress" ? "bg-blue-500" : m.status === "blocked" ? "bg-red-500" : "bg-neutral-300"
                          }`} />
                          {m.title}
                        </span>
                      );
                    })}
                  </div>

                  {/* Count badge */}
                  <span className="text-[10px] font-mono text-neutral-300 shrink-0">
                    {doneCount > 0 && <span className="text-green-500">{doneCount}/</span>}
                    {total}
                  </span>

                  {/* Chevron */}
                  <span className={`text-neutral-300 text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>
                    &#9654;
                  </span>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="pb-4 pl-24 pr-4 space-y-2">
                    {g.goals.map((m) => {
                      const cfg = STATUS_CONFIG[m.status as GoalStatus] || STATUS_CONFIG.not_started;

                      if (editingId === m.id) {
                        return (
                          <div key={m.id} className="border border-neutral-200 rounded-lg p-4 space-y-2">
                            <input className="w-full text-sm font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
                              value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
                            <textarea className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
                              value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={2} />
                            <div className="flex gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-mono text-neutral-400">Date</label>
                                <input type="date" className="text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-black"
                                  value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                              </div>
                              <input className="flex-1 text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
                                value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(m.id)} className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs font-mono px-3 py-1 text-neutral-400 hover:text-black">Cancel</button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={m.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg hover:bg-neutral-50 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[9px] font-mono uppercase ${cfg.color}`}>{cfg.label}</span>
                              {m.workstream && (
                                <span className="text-[9px] font-mono text-neutral-400 bg-neutral-100 px-1 rounded">{m.workstream}</span>
                              )}
                            </div>
                            <h4 className="text-sm font-medium text-black">{m.title}</h4>
                            {m.description && (
                              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{m.description}</p>
                            )}
                            {m.owner && (
                              <p className="text-[10px] font-mono text-neutral-400 mt-1">Owner: {m.owner}</p>
                            )}
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <select
                              value={m.status}
                              onChange={(e) => onUpdate(m.id, { status: e.target.value as GoalStatus })}
                              className="text-[10px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none cursor-pointer"
                            >
                              {(["not_started", "in_progress", "done", "blocked"] as GoalStatus[]).map((s) => (
                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                              ))}
                            </select>
                            <button onClick={() => startEdit(m)} className="text-[10px] font-mono text-neutral-400 hover:text-black px-1">Edit</button>
                            {confirmDeleteId === m.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => { onDelete(m.id); setConfirmDeleteId(null); }} className="text-[10px] font-mono text-red-500 hover:text-red-700 px-1">Yes</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] font-mono text-neutral-400 px-1">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(m.id)} className="text-[10px] font-mono text-neutral-400 hover:text-red-500 px-1">Del</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
