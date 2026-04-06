"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { TimeHorizon, GoalCategory, createGoal, Goal, WORK_STREAMS } from "../lib/store";

interface Props {
  horizon: TimeHorizon;
  category: GoalCategory;
  workstream?: string | null;
  allGoals?: Goal[];
  onAdd: (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => void;
}

export default function AddGoal({ horizon, category, workstream, allGoals = [], onAdd }: Props) {
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(" ")[0] || "";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owners, setOwners] = useState(userName);
  const [reasoning, setReasoning] = useState("");
  const [selectedWs, setSelectedWs] = useState<string>(workstream || "");
  const [parentId, setParentId] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  // Goals that can be parents (same category, not sub-tasks themselves)
  const parentCandidates = allGoals.filter(
    (g) => g.category === category && !g.parentId
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(
      createGoal({
        title: title.trim(),
        description: description.trim(),
        owner: owners.trim(),
        reasoning: reasoning.trim(),
        horizon,
        category,
        ...(category === "executive" && selectedWs ? { workstream: selectedWs } : {}),
        ...(parentId ? { parentId } : {}),
        ...(estimatedHours ? { estimatedHours: parseInt(estimatedHours) } : {}),
      } as Partial<Goal> & Pick<Goal, "title" | "horizon" | "category">)
    );
    setTitle("");
    setDescription("");
    setOwners(userName);
    setReasoning("");
    setSelectedWs(workstream || "");
    setParentId("");
    setEstimatedHours("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-neutral-300 rounded-lg p-3 text-xs font-mono text-neutral-400 hover:border-neutral-500 hover:text-neutral-600 transition-colors"
      >
        + Add goal
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-neutral-300 rounded-lg p-5 space-y-3">
      <input
        className="w-full text-sm font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Goal title" autoFocus
      />
      <textarea
        className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)" rows={2}
      />
      <textarea
        className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
        value={reasoning} onChange={(e) => setReasoning(e.target.value)}
        placeholder="Reasoning — why this goal matters" rows={2}
      />
      <input
        className="w-full text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
        value={owners} onChange={(e) => setOwners(e.target.value)}
        placeholder="Owners (comma-separated, e.g. Bercan, Anton)"
      />
      <div className="flex gap-4 flex-wrap">
        {/* Parent goal selector */}
        {parentCandidates.length > 0 && (
          <select
            className="text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black"
            value={parentId} onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Parent goal (optional)</option>
            {parentCandidates.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        )}
        {/* Time estimate */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-neutral-400 shrink-0">Est. hours</label>
          <input type="number" min="0"
            className="text-xs bg-transparent border border-neutral-200 rounded px-2 py-1 outline-none focus:border-black w-16"
            value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="—"
          />
        </div>
      </div>
      {category === "executive" && (
        <select
          className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black"
          value={selectedWs} onChange={(e) => setSelectedWs(e.target.value)}
        >
          <option value="">Work stream (optional)</option>
          {WORK_STREAMS.map((ws) => (
            <option key={ws.key} value={ws.key}>{ws.label}</option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button type="submit" className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-mono px-3 py-1 text-neutral-500 hover:text-black">Cancel</button>
      </div>
    </form>
  );
}
