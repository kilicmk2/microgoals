"use client";

import { useState } from "react";
import { Goal } from "../lib/store";

interface Props {
  goals: Goal[];
  onUpdate: (id: string, updates: Partial<Goal>) => void;
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

export default function RoadmapTimeline({ goals, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  // Timeline spans 3 months from today — stable per mount
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

  // Only show pinned company goals with targetDate
  const milestones = goals
    .filter((g) => g.pinned && g.targetDate && g.category === "company")
    .map((g) => {
      const d = new Date(g.targetDate!);
      const dayOffset = (d.getTime() - startMs) / (1000 * 60 * 60 * 24);
      const pct = Math.max(0, Math.min(100, (dayOffset / totalDays) * 100));
      return { ...g, date: d, pct };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group milestones into time bands so they don't overlap
  // Band 1: goals positioned above the line, Band 2: below
  const above = milestones.filter((_, i) => i % 2 === 0);
  const below = milestones.filter((_, i) => i % 2 === 1);

  function handleDateSave(goalId: string) {
    if (editDate) {
      onUpdate(goalId, { targetDate: editDate });
    }
    setEditingId(null);
    setEditDate("");
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-2xl font-medium tracking-tight text-black">
          3-Month Roadmap
        </h1>
        <p className="text-xs font-mono text-neutral-400 mt-2 uppercase tracking-widest">
          {fmtMonth(new Date(startMs))} — {fmtMonth(new Date(endMs))} {new Date(endMs).getFullYear()}
        </p>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-neutral-400 font-mono">
            No milestones yet
          </p>
          <p className="text-xs text-neutral-300 font-mono mt-2">
            Pin company goals and set a target date to see them here
          </p>
        </div>
      ) : (
        <div className="relative" style={{ height: "420px" }}>
          {/* Above-line milestones */}
          <div className="absolute left-0 right-0 top-0" style={{ height: "180px" }}>
            {above.map((m) => (
              <div
                key={m.id}
                className="absolute bottom-0 w-56"
                style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}
              >
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-3 hover:border-neutral-400 transition-colors">
                  <h3 className="text-xs font-medium text-black leading-snug mb-1">
                    {m.title}
                  </h3>
                  {m.description && (
                    <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">
                      {m.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {editingId === m.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="text-[10px] font-mono border border-neutral-300 rounded px-1 py-0.5 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleDateSave(m.id)}
                          className="text-[10px] font-mono text-black hover:underline"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditDate(m.targetDate || toISO(m.date));
                        }}
                        className="text-[10px] font-mono text-neutral-400 hover:text-black transition-colors"
                      >
                        {fmtDate(m.date)}
                      </button>
                    )}
                    {m.owner && (
                      <span className="text-[10px] font-mono text-neutral-300">
                        {m.owner}
                      </span>
                    )}
                  </div>
                </div>
                {/* Connector line */}
                <div className="w-px h-3 bg-neutral-300 mx-auto" />
              </div>
            ))}
          </div>

          {/* Timeline axis */}
          <div className="absolute left-0 right-0" style={{ top: "192px" }}>
            <div className="h-px bg-neutral-300 w-full relative">
              {/* Arrow */}
              <div className="absolute right-0 -top-[4px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-neutral-300" />

              {/* Date markers */}
              {markers.map((mk, i) => {
                const dayOff =
                  (mk.date.getTime() - startMs) / (1000 * 60 * 60 * 24);
                const pct = (dayOff / totalDays) * 100;
                return (
                  <div
                    key={i}
                    className="absolute"
                    style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="w-px h-2 bg-neutral-300 -mt-1" />
                    <span className="text-[10px] font-mono text-neutral-400 mt-1 block whitespace-nowrap">
                      {mk.label}
                    </span>
                  </div>
                );
              })}

              {/* Milestone dots on the line */}
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="absolute w-2 h-2 rounded-full bg-black -mt-[3px]"
                  style={{
                    left: `${m.pct}%`,
                    transform: "translateX(-50%)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Below-line milestones */}
          <div
            className="absolute left-0 right-0"
            style={{ top: "216px", height: "180px" }}
          >
            {below.map((m) => (
              <div
                key={m.id}
                className="absolute top-0 w-56"
                style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}
              >
                {/* Connector line */}
                <div className="w-px h-3 bg-neutral-300 mx-auto" />
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mt-0 hover:border-neutral-400 transition-colors">
                  <h3 className="text-xs font-medium text-black leading-snug mb-1">
                    {m.title}
                  </h3>
                  {m.description && (
                    <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">
                      {m.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {editingId === m.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="text-[10px] font-mono border border-neutral-300 rounded px-1 py-0.5 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleDateSave(m.id)}
                          className="text-[10px] font-mono text-black hover:underline"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditDate(m.targetDate || toISO(m.date));
                        }}
                        className="text-[10px] font-mono text-neutral-400 hover:text-black transition-colors"
                      >
                        {fmtDate(m.date)}
                      </button>
                    )}
                    {m.owner && (
                      <span className="text-[10px] font-mono text-neutral-300">
                        {m.owner}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      <p className="text-[10px] font-mono text-neutral-300 text-center mt-8">
        Click a date to adjust &middot; Pin company goals with a target date to add milestones
      </p>
    </div>
  );
}
