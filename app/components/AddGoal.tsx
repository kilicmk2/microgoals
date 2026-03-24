"use client";

import { useState } from "react";
import { TimeHorizon, GoalCategory, createGoal, Goal } from "../lib/store";

interface Props {
  horizon: TimeHorizon;
  category: GoalCategory;
  onAdd: (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => void;
}

export default function AddGoal({ horizon, category, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [reasoning, setReasoning] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(
      createGoal({
        title: title.trim(),
        description: description.trim(),
        owner: owner.trim(),
        reasoning: reasoning.trim(),
        horizon,
        category,
      })
    );
    setTitle("");
    setDescription("");
    setOwner("");
    setReasoning("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-neutral-300 rounded p-3 text-xs font-mono text-neutral-400 hover:border-neutral-500 hover:text-neutral-600 transition-colors"
      >
        + Add goal
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-neutral-300 rounded p-4 space-y-3"
    >
      <input
        className="w-full text-sm font-medium bg-transparent border-b border-neutral-300 pb-1 outline-none focus:border-black"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Goal title"
        autoFocus
      />
      <textarea
        className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
      />
      <textarea
        className="w-full text-xs bg-transparent border border-neutral-200 rounded p-2 outline-none focus:border-black resize-none"
        value={reasoning}
        onChange={(e) => setReasoning(e.target.value)}
        placeholder="Reasoning — why this goal matters"
        rows={2}
      />
      <input
        className="w-full text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder="Owner (name)"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-mono px-3 py-1 text-neutral-500 hover:text-black"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
