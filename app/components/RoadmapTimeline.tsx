"use client";

import { useState } from "react";
import { Goal, GoalStatus, STATUS_CONFIG, createGoal } from "../lib/store";

interface Props {
  goals: Goal[];
  category?: string;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  onAdd: (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => void;
}

function fmtDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function RoadmapTimeline({ goals, category = "company", onUpdate, onDelete, onAdd }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Timeline spans 3 months from today
  const now = new Date();
  const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endMs = new Date(now.getFullYear(), now.getMonth() + 3, 15).getTime();
  const totalDays = (endMs - startMs) / (1000 * 60 * 60 * 24);

  // Generate date markers — 1st and 15th of each month
  const markers: { date: Date; label: string }[] = [];
  {
    const d = new Date(startMs);
    const endDate = new Date(endMs);
    while (d <= endDate) {
      markers.push({ date: new Date(d), label: fmtDate(d) });
      if (d.getDate() === 1) {
        d.setDate(15);
      } else {
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
      }
    }
  }

  // Show pinned goals with targetDate (any category the parent passes in)
  const milestones = goals
    .filter((g) => g.pinned && g.targetDate)
    .map((g) => {
      const d = new Date(g.targetDate!);
      const dayOffset = (d.getTime() - startMs) / (1000 * 60 * 60 * 24);
      const pct = Math.max(2, Math.min(98, (dayOffset / totalDays) * 100));
      return { ...g, date: d, pct };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Distribute milestones into lanes so overlapping cards stack cleanly
  // Cards are ~210px wide on a container that's ~1100px, so ~19% of width
  const OVERLAP_THRESHOLD = 15; // pct — cards closer than this would overlap
  type LanedMilestone = typeof milestones[number] & { lane: number };

  const laned: LanedMilestone[] = [];
  const lanes: number[][] = []; // lanes[i] = array of pct positions in that lane

  for (const m of milestones) {
    let placed = false;
    for (let li = 0; li < lanes.length; li++) {
      const fits = lanes[li].every((p) => Math.abs(p - m.pct) >= OVERLAP_THRESHOLD);
      if (fits) {
        lanes[li].push(m.pct);
        laned.push({ ...m, lane: li });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([m.pct]);
      laned.push({ ...m, lane: lanes.length - 1 });
    }
  }

  // Even lanes go above the axis, odd lanes go below
  const above = laned.filter((m) => m.lane % 2 === 0);
  const below = laned.filter((m) => m.lane % 2 === 1);

  // How many rows above / below so we can size the container
  const aboveLanes = Math.max(1, ...above.map((m) => Math.floor(m.lane / 2) + 1), 1);
  const belowLanes = Math.max(1, ...below.map((m) => Math.floor(m.lane / 2) + 1), 1);
  const ROW_HEIGHT = 140; // px per lane row
  const AXIS_GAP = 30; // px gap around axis
  const totalHeight = aboveLanes * ROW_HEIGHT + belowLanes * ROW_HEIGHT + AXIS_GAP * 2 + 20;
  const axisTop = aboveLanes * ROW_HEIGHT + AXIS_GAP;

  function handleDateSave(goalId: string) {
    if (editDate) {
      onUpdate(goalId, { targetDate: editDate });
    }
    setEditingId(null);
    setEditDate("");
  }

  function handleAdd() {
    if (!newTitle.trim() || !newDate) return;
    onAdd(
      createGoal({
        title: newTitle.trim(),
        description: newDesc.trim(),
        owner: newOwner.trim(),
        targetDate: newDate,
        horizon: "3m",
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

  function handleTimelineDrop(e: React.DragEvent) {
    e.preventDefault();
    const goalId = e.dataTransfer.getData("text/plain");
    if (!goalId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const dayOffset = pct * totalDays;
    const newDateMs = startMs + dayOffset * 1000 * 60 * 60 * 24;
    const d = new Date(newDateMs);
    onUpdate(goalId, { targetDate: toISO(d) });
    setDragging(false);
  }

  // Prevent drag from swallowing clicks on interactive elements
  function stopDrag(e: React.MouseEvent) { e.stopPropagation(); }

  function renderCardContent(m: LanedMilestone) {
    const statusCfg = STATUS_CONFIG[m.status as GoalStatus] || STATUS_CONFIG.not_started;
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 hover:border-neutral-400 transition-colors cursor-grab active:cursor-grabbing">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[9px] font-mono uppercase ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          {/* Controls — draggable=false so clicks work */}
          <div className="flex gap-1" draggable={false} onMouseDown={stopDrag}>
            <select
              value={m.status}
              onChange={(e) => onUpdate(m.id, { status: e.target.value as GoalStatus })}
              className="text-[9px] font-mono bg-transparent border border-neutral-200 rounded px-0.5 outline-none cursor-pointer"
            >
              {(["not_started", "in_progress", "done", "blocked"] as GoalStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            {confirmDeleteId === m.id ? (
              <div className="flex gap-1">
                <button onClick={() => { onDelete(m.id); setConfirmDeleteId(null); }} className="text-[10px] font-mono font-bold text-red-500 hover:text-red-700 px-1">Delete</button>
                <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] font-mono text-neutral-400 px-1">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDeleteId(m.id)} className="text-[10px] font-mono text-neutral-400 hover:text-red-500 px-1">&times;</button>
            )}
          </div>
        </div>
        <h3 className="text-[11px] font-medium text-black leading-snug mb-0.5">{m.title}</h3>
        {m.description && (
          <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">{m.description}</p>
        )}
        <div className="flex items-center justify-between mt-1.5" draggable={false} onMouseDown={stopDrag}>
          {editingId === m.id ? (
            <div className="flex items-center gap-1">
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                className="text-[10px] font-mono border border-neutral-300 rounded px-1 py-0.5 outline-none" autoFocus />
              <button onClick={() => handleDateSave(m.id)} className="text-[10px] font-mono text-black hover:underline">OK</button>
            </div>
          ) : (
            <button onClick={() => { setEditingId(m.id); setEditDate(m.targetDate || toISO(m.date)); }}
              className="text-[10px] font-mono text-neutral-400 hover:text-black transition-colors">{fmtDate(m.date)}</button>
          )}
          {m.owner && <span className="text-[9px] font-mono text-neutral-300">{m.owner}</span>}
        </div>
      </div>
    );
  }

  function renderCard(m: LanedMilestone, position: "above" | "below") {
    const row = Math.floor(m.lane / 2);
    const offset = row * ROW_HEIGHT;
    return (
      <div
        key={m.id}
        className="absolute w-52"
        style={{
          left: `${m.pct}%`,
          transform: "translateX(-50%)",
          ...(position === "above" ? { bottom: `${offset}px` } : { top: `${offset}px` }),
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", m.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
      >
        {position === "above" ? (
          <>
            {renderCardContent(m)}
            <div className="w-px h-3 bg-neutral-300 mx-auto mt-2" />
          </>
        ) : (
          <>
            <div className="w-px h-3 bg-neutral-300 mx-auto mb-2" />
            {renderCardContent(m)}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-black">
            3-Month Roadmap
          </h1>
          <p className="text-xs font-mono text-neutral-400 mt-2 uppercase tracking-widest">
            {fmtMonth(new Date(startMs))} — {fmtMonth(new Date(endMs))} {new Date(endMs).getFullYear()}
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
        <div className="border border-neutral-300 rounded-lg p-5 mb-8 space-y-3">
          <input
            className="w-full text-sm font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Milestone title"
            autoFocus
          />
          <textarea
            className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
          />
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono text-neutral-400">Target date</label>
              <input
                type="date"
                className="text-xs bg-transparent border border-neutral-200 rounded px-2 py-1 outline-none focus:border-black"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <input
              className="flex-1 text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              placeholder="Owner (optional)"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800">Add</button>
            <button onClick={() => setAddOpen(false)} className="text-xs font-mono px-3 py-1 text-neutral-500 hover:text-black">Cancel</button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !addOpen ? (
        <div className="text-center py-20">
          <p className="text-sm text-neutral-400 font-mono">No milestones yet</p>
          <p className="text-xs text-neutral-300 font-mono mt-2">
            Click &quot;+ Add milestone&quot; to create one, or pin company goals with a target date
          </p>
        </div>
      ) : milestones.length > 0 && (
        <div
          className="relative"
          style={{ height: `${totalHeight}px` }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={handleTimelineDrop}
        >
          {/* Above-line milestones */}
          <div className="absolute left-0 right-0 top-0" style={{ height: `${axisTop}px` }}>
            {above.map((m) => renderCard(m, "above"))}
          </div>

          {/* Timeline axis */}
          <div className="absolute left-0 right-0" style={{ top: `${axisTop}px` }}>
            <div className={`h-px w-full relative transition-colors ${dragging ? "bg-black" : "bg-neutral-300"}`}>
              {/* Arrow */}
              <div className={`absolute right-0 -top-[4px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] ${dragging ? "border-l-black" : "border-l-neutral-300"}`} />

              {/* Date markers */}
              {markers.map((mk, i) => {
                const dayOff = (mk.date.getTime() - startMs) / (1000 * 60 * 60 * 24);
                const pct = (dayOff / totalDays) * 100;
                return (
                  <div key={i} className="absolute" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
                    <div className="w-px h-2 bg-neutral-300 -mt-1" />
                    <span className="text-[10px] font-mono text-neutral-400 mt-1 block whitespace-nowrap">{mk.label}</span>
                  </div>
                );
              })}

              {/* Milestone dots */}
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`absolute w-2.5 h-2.5 rounded-full -mt-[4px] transition-colors ${
                    m.status === "done" ? "bg-green-600" : m.status === "in_progress" ? "bg-blue-500" : "bg-black"
                  }`}
                  style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}
                />
              ))}
            </div>
          </div>

          {/* Below-line milestones */}
          <div className="absolute left-0 right-0" style={{ top: `${axisTop + AXIS_GAP}px`, height: `${belowLanes * ROW_HEIGHT}px` }}>
            {below.map((m) => renderCard(m, "below"))}
          </div>

          {/* Drag hint */}
          {dragging && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <span className="text-xs font-mono text-neutral-300 bg-white/80 px-3 py-1 rounded">
                Drop on timeline to reposition
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      <p className="text-[10px] font-mono text-neutral-300 text-center mt-8">
        Drag milestones to reposition &middot; Click date to adjust &middot; Hover for controls
      </p>
    </div>
  );
}
