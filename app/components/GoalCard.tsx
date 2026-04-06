"use client";

import { useState } from "react";
import { Goal, GoalStatus, STATUS_CONFIG, HORIZONS, TimeHorizon, WORK_STREAM_SHORT, WorkStream, createGoal } from "../lib/store";

interface Props {
  goal: Goal;
  allGoals: Goal[];
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  onAdd: (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => void;
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
  allGoals,
  onUpdate,
  onDelete,
  onAdd,
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
  const [estimatedHours, setEstimatedHours] = useState(goal.estimatedHours?.toString() || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState("");

  const statusCfg = STATUS_CONFIG[goal.status];
  const children = allGoals.filter((g) => g.parentId === goal.id);

  function handleSave() {
    onUpdate(goal.id, {
      title, description, reasoning, owner,
      targetDate: targetDate || null,
      estimatedHours: estimatedHours ? parseInt(estimatedHours) : null,
    });
    setEditing(false);
  }

  function handleCancel() {
    setTitle(goal.title);
    setDescription(goal.description);
    setReasoning(goal.reasoning);
    setOwner(goal.owner);
    setTargetDate(goal.targetDate || "");
    setEstimatedHours(goal.estimatedHours?.toString() || "");
    setEditing(false);
  }

  function handleAddSubTask() {
    if (!subTaskTitle.trim()) return;
    onAdd(createGoal({
      title: subTaskTitle.trim(),
      horizon: goal.horizon,
      category: goal.category,
      parentId: goal.id,
      owner: goal.owner,
    } as Partial<Goal> & Pick<Goal, "title" | "horizon" | "category">));
    setSubTaskTitle("");
    setAddingSubTask(false);
    setShowSubTasks(true);
  }

  if (editing) {
    return (
      <div className="border border-neutral-300 rounded-lg p-5 space-y-3">
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
          value={owner} onChange={(e) => setOwner(e.target.value)}
          placeholder="Owners (comma-separated)"
        />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-neutral-400 shrink-0">Target date</label>
            <input type="date" className="text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black"
              value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-neutral-400 shrink-0">Est. hours</label>
            <input type="number" min="0" className="text-xs bg-transparent border-b border-neutral-200 pb-1 outline-none focus:border-black w-16"
              value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="—" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="text-xs font-mono px-3 py-1 bg-black text-white rounded hover:bg-neutral-800">Save</button>
          <button onClick={handleCancel} className="text-xs font-mono px-3 py-1 text-neutral-500 hover:text-black">Cancel</button>
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
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== goal.id && onDrop) onDrop(e, goal.id);
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-mono uppercase ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            {!goal.approved && (
              <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">PENDING</span>
            )}
            {goal.pinned && goal.approved && (
              <span className="text-[10px] font-mono text-black">HIGHLIGHTED</span>
            )}
            {goal.workstream && (
              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                {WORK_STREAM_SHORT[goal.workstream as WorkStream] || goal.workstream}
              </span>
            )}
            {goal.estimatedHours && (
              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                ~{goal.estimatedHours}h
              </span>
            )}
            {childCount > 0 && (
              <button
                onClick={() => setShowSubTasks(!showSubTasks)}
                className="text-[10px] font-mono text-neutral-400 hover:text-black"
              >
                {childCount} sub-task{childCount > 1 ? "s" : ""} {showSubTasks ? "▾" : "▸"}
              </button>
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
              <button onClick={() => onApprove?.(goal.id)} className="text-[10px] font-mono px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
              <button onClick={() => onReject?.(goal.id)} className="text-[10px] font-mono px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Reject</button>
            </div>
          )}

          {/* Sub-tasks */}
          {showSubTasks && children.length > 0 && (
            <div className="mt-3 pl-3 border-l-2 border-neutral-100 space-y-1.5">
              {children.map((child) => {
                const childCfg = STATUS_CONFIG[child.status as GoalStatus] || STATUS_CONFIG.not_started;
                return (
                  <div key={child.id} className="flex items-center gap-2 group/sub">
                    <button
                      onClick={() => onUpdate(child.id, { status: child.status === "done" ? "not_started" : "done" })}
                      className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                        child.status === "done" ? "bg-green-500 border-green-500 text-white" : "border-neutral-300 hover:border-black"
                      }`}
                    >
                      {child.status === "done" && <span className="text-[8px]">✓</span>}
                    </button>
                    <span className={`text-xs ${child.status === "done" ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                      {child.title}
                    </span>
                    {child.estimatedHours && (
                      <span className="text-[9px] font-mono text-neutral-300">~{child.estimatedHours}h</span>
                    )}
                    {child.owner && (
                      <span className="text-[9px] font-mono text-neutral-300">{child.owner}</span>
                    )}
                    <button
                      onClick={() => onDelete(child.id)}
                      className="text-[9px] text-neutral-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-opacity ml-auto"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add sub-task */}
          {addingSubTask ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                className="flex-1 text-xs bg-transparent border-b border-neutral-300 pb-0.5 outline-none focus:border-black"
                value={subTaskTitle} onChange={(e) => setSubTaskTitle(e.target.value)}
                placeholder="Sub-task title" autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddSubTask()}
              />
              <button onClick={handleAddSubTask} className="text-[10px] font-mono text-black hover:underline">Add</button>
              <button onClick={() => { setAddingSubTask(false); setSubTaskTitle(""); }} className="text-[10px] font-mono text-neutral-400">×</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSubTask(true)}
              className="mt-2 text-[10px] font-mono text-neutral-300 hover:text-neutral-600 transition-colors"
            >
              + sub-task
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <select value={goal.status}
            onChange={(e) => onUpdate(goal.id, { status: e.target.value as GoalStatus })}
            className="text-[10px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none cursor-pointer">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <select value={goal.horizon}
            onChange={(e) => onUpdate(goal.id, { horizon: e.target.value as TimeHorizon })}
            className="text-[10px] font-mono bg-transparent border border-neutral-200 rounded px-1 py-0.5 outline-none cursor-pointer" title="Move to horizon">
            {availableHorizons.map((h) => (
              <option key={h.key} value={h.key}>{h.label}</option>
            ))}
          </select>
          {showPin && (
            <button onClick={() => onUpdate(goal.id, { pinned: !goal.pinned })}
              className={`text-[10px] font-mono px-1 ${goal.pinned ? "text-black" : "text-neutral-400 hover:text-black"}`}
              title={goal.pinned ? "Unpin" : "Pin"}>{goal.pinned ? "Unpin" : "Pin"}</button>
          )}
          <button onClick={() => setEditing(true)} className="text-[10px] font-mono text-neutral-400 hover:text-black px-1">Edit</button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={() => onDelete(goal.id)} className="text-[10px] font-mono text-red-500 hover:text-red-700 px-1">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] font-mono text-neutral-400 hover:text-black px-1">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-[10px] font-mono text-neutral-400 hover:text-red-500 px-1">Del</button>
          )}
        </div>
      </div>
    </div>
  );
}
