"use client";

import { useState } from "react";
import { Goal, GoalStatus, STATUS_CONFIG } from "../lib/store";

interface Props {
  goal: Goal;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  childCount: number;
  showPin?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
}

const STATUS_OPTIONS: GoalStatus[] = ["not_started", "in_progress", "done", "blocked"];

export default function GoalCard({
  goal,
  onUpdate,
  onDelete,
  childCount,
  showPin = false,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const [reasoning, setReasoning] = useState(goal.reasoning);
  const [owner, setOwner] = useState(goal.owner);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusCfg = STATUS_CONFIG[goal.status];

  function handleSave() {
    onUpdate(goal.id, { title, description, reasoning, owner });
    setEditing(false);
  }

  function handleCancel() {
    setTitle(goal.title);
    setDescription(goal.description);
    setReasoning(goal.reasoning);
    setOwner(goal.owner);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="border border-neutral-300 rounded-lg p-5 space-y-3">
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
            onClick={handleSave}
            className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-xs font-mono px-3 py-1 text-neutral-500 hover:text-black"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group border rounded-lg p-5 transition-all cursor-grab active:cursor-grabbing ${
        goal.pinned
          ? "border-black bg-neutral-50"
          : "border-neutral-200 hover:border-neutral-400"
      }`}
      draggable
      onDragStart={(e) => onDragStart?.(e, goal.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => onDrop?.(e, goal.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Drag handle */}
          <div className="mt-1 text-neutral-300 group-hover:text-neutral-400 shrink-0 select-none">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2" cy="2" r="1.5" />
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="2" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="2" cy="14" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-mono uppercase ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {goal.pinned && (
                <span className="text-[10px] font-mono text-black">HIGHLIGHTED</span>
              )}
              {childCount > 0 && (
                <span className="text-[10px] font-mono text-neutral-400">
                  {childCount} sub-goal{childCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-black leading-snug">{goal.title}</h3>
            {goal.description && (
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{goal.description}</p>
            )}
            {goal.reasoning && (
              <p className="text-xs text-neutral-400 mt-1 italic">Why: {goal.reasoning}</p>
            )}
            {goal.owner && (
              <p className="text-[10px] font-mono text-neutral-400 mt-2">Owner: {goal.owner}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <select
            value={goal.status}
            onChange={(e) => onUpdate(goal.id, { status: e.target.value as GoalStatus })}
            className="text-[10px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none cursor-pointer"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          {showPin && (
            <button
              onClick={() => onUpdate(goal.id, { pinned: !goal.pinned })}
              className={`text-[10px] font-mono px-1 ${
                goal.pinned ? "text-black" : "text-neutral-400 hover:text-black"
              }`}
              title={goal.pinned ? "Unpin" : "Pin to top"}
            >
              {goal.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] font-mono text-neutral-400 hover:text-black px-1"
          >
            Edit
          </button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={() => onDelete(goal.id)}
                className="text-[10px] font-mono text-red-500 hover:text-red-700 px-1"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] font-mono text-neutral-400 hover:text-black px-1"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[10px] font-mono text-neutral-400 hover:text-red-500 px-1"
            >
              Del
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
