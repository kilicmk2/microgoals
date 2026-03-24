"use client";

import { useState, useRef } from "react";
import {
  TimeHorizon,
  HORIZONS,
  GoalCategory,
  PERSONAL_HORIZONS,
  PERSONAL_EXTRA_HORIZONS,
  Goal,
} from "../lib/store";

interface Props {
  activeHorizon: TimeHorizon | null;
  category: GoalCategory;
  goals: Goal[];
  onHorizonChange: (h: TimeHorizon) => void;
  onDropGoal?: (goalId: string, horizon: TimeHorizon) => void;
}

export default function HorizonNav({
  activeHorizon,
  category,
  goals,
  onHorizonChange,
  onDropGoal,
}: Props) {
  const horizons = category === "personal"
    ? [...PERSONAL_HORIZONS, ...PERSONAL_EXTRA_HORIZONS]
    : HORIZONS;

  const [dropTarget, setDropTarget] = useState<TimeHorizon | null>(null);
  const justDroppedRef = useRef(false);

  function getPreviewTitles(horizon: TimeHorizon): string[] {
    return (goals || [])
      .filter((g) => g.horizon === horizon && g.category === category && g.pinned)
      .slice(0, 3)
      .map((g) => g.title.length > 30 ? g.title.substring(0, 28) + "..." : g.title);
  }

  function getGoalCount(horizon: TimeHorizon): number {
    return (goals || []).filter((g) => g.horizon === horizon && g.category === category).length;
  }

  function handleClick(h: TimeHorizon) {
    // Don't navigate if we just dropped a goal
    if (justDroppedRef.current) {
      justDroppedRef.current = false;
      return;
    }
    onHorizonChange(h);
  }

  function handleDrop(e: React.DragEvent, h: TimeHorizon) {
    e.preventDefault();
    e.stopPropagation();
    const goalId = e.dataTransfer.getData("text/plain");
    if (!goalId) return;
    justDroppedRef.current = true;
    setDropTarget(null);
    onDropGoal?.(goalId, h);
    setTimeout(() => { justDroppedRef.current = false; }, 300);
  }

  return (
    <div className="w-full py-10 px-6">
      <div className="relative">
        {/* Line */}
        <div className="absolute left-0 right-0 top-[24px] h-px bg-neutral-200" />

        {/* Dots and labels */}
        <div className="relative flex items-start justify-between">
          {horizons.map((h) => {
            const isActive = activeHorizon === h.key;
            const isDragOver = dropTarget === h.key;
            const previews = getPreviewTitles(h.key);
            const count = getGoalCount(h.key);

            return (
              <div
                key={h.key}
                className="flex flex-col items-center w-0 flex-1"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(h.key);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(e, h.key)}
              >
                {/* Large invisible drop zone */}
                <div
                  className={`w-full flex flex-col items-center cursor-pointer py-3 rounded-lg transition-colors ${
                    isDragOver ? "bg-blue-50" : ""
                  }`}
                  onClick={() => handleClick(h.key)}
                >
                  {/* Dot */}
                  <div
                    className={`w-3 h-3 rounded-full border-2 transition-all duration-300 shrink-0 ${
                      isDragOver
                        ? "bg-blue-500 border-blue-500 scale-[2]"
                        : isActive
                        ? "bg-black border-black scale-125"
                        : "bg-white border-neutral-300 hover:border-neutral-500 hover:bg-neutral-100"
                    }`}
                  />

                  {/* Label */}
                  <span
                    className={`text-[11px] font-mono mt-3 transition-all duration-300 whitespace-nowrap ${
                      isDragOver
                        ? "text-blue-500 font-semibold"
                        : isActive
                        ? "text-black font-semibold"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}
                  >
                    {h.label}
                  </span>

                  {/* Count */}
                  {count > 0 && (
                    <span className="text-[9px] font-mono text-neutral-300 mt-0.5">
                      {count}
                    </span>
                  )}
                </div>

                {/* Preview bubbles */}
                <div className="flex flex-col items-center gap-1 mt-1 w-full px-1">
                  {previews.map((title, i) => (
                    <span
                      key={i}
                      className={`text-[9px] leading-tight px-2 py-0.5 rounded-full border max-w-full truncate transition-colors ${
                        isActive
                          ? "border-neutral-400 text-neutral-700 bg-neutral-50"
                          : "border-neutral-200 text-neutral-400"
                      }`}
                    >
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
