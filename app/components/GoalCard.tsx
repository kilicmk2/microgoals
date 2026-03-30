"use client";

import { useState } from "react";
import { Goal, GoalStatus, STATUS_CONFIG, HORIZONS, TimeHorizon, WORK_STREAM_SHORT, WorkStream } from "../lib/store";

interface Props {
  goal: Goal;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  childCount: number;
  showPin?: boolean;
  isMaster?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
  availableHorizons?: { key: TimeHorizon; label: string }[];
}

const STATUS_OPTIONS: GoalStatus[] = ["not_started", "in_progress", "done", "blocked"];

export default function GoalCard({
  goal,
  onUpdate,
  onDelete,
  childCount,
  showPin = false,
  isMaster = false,
  onApprove,
  onReject,
  onDragStart,
  onDragOver,
  onDrop,
  availableHorizons = HORIZONS,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const [reasoning, setReasoning] = useState(goal.reasoning);
  const [owner, setOwner] = useState(goal.owner);
  const [targetDate, setTargetDate] = useState(goal.targetDate || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusCfg = STATUS_CONFIG[goal.status];

  function handleSave() {
    onUpdate(goal.id, { title, description, reasoning, owner, targetDate: targetDate || null });
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
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-neutral-400 shrink-0">Target date</label>
          <input
            type="date"
            className="text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
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
        !goal.approved
          ? "border-yellow-400 bg-yellow-50"
          : goal.pinned
          ? "border-black bg-neutral-50"
          : "border-neutral-200 hover:border-neutral-400"
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", goal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== goal.id && onDrop) {
          onDrop(e, goal.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-mono uppercase ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {!goal.approved && (
                <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                  PENDING APPROVAL
                </span>
              )}
              {goal.pinned && goal.approved && (
                <span className="text-[10px] font-mono text-black">HIGHLIGHTED</span>
              )}
              {goal.workstream && (
                <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {WORK_STREAM_SHORT[goal.workstream as WorkStream] || goal.workstream}
                </span>
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
            {(goal.owner || goal.targetDate) && (
              <p className="text-[10px] font-mono text-neutral-400 mt-2">
                {goal.owner && <span>Owner: {goal.owner}</span>}
                {goal.owner && goal.targetDate && <span className="mx-2">&middot;</span>}
                {goal.targetDate && <span>Target: {goal.targetDate}</span>}
              </p>
            )}
            {goal.proposedBy && (
              <p className="text-[10px] font-mono text-yellow-600 mt-1">Proposed by: {goal.proposedBy}</p>
            )}
            {!goal.approved && isMaster && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onApprove?.(goal.id)}
                  className="text-[10px] font-mono px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject?.(goal.id)}
                  className="text-[10px] font-mono px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            )}
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
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
          <select
            value={goal.horizon}
            onChange={(e) => onUpdate(goal.id, { horizon: e.target.value as TimeHorizon })}
            className="text-[10px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none cursor-pointer"
            title="Move to horizon"
          >
            {availableHorizons.map((h) => (
              <option key={h.key} value={h.key}>
                {h.label}
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
