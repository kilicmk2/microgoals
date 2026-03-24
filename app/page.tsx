"use client";

import { useState, useCallback } from "react";
import { TimeHorizon, GoalCategory, HORIZONS, Goal } from "./lib/store";
import { useGoals, useChatMessages } from "./lib/hooks";
import HorizonNav from "./components/HorizonNav";
import GoalCard from "./components/GoalCard";
import AddGoal from "./components/AddGoal";
import ChatBubble from "./components/ChatBubble";
import { getSeedGoals } from "./lib/seed-goals";

export default function Home() {
  const [horizon, setHorizon] = useState<TimeHorizon | null>(null);
  const [category, setCategory] = useState<GoalCategory>("company");
  const [dragId, setDragId] = useState<string | null>(null);
  const { goals, loaded, addGoal, updateGoal, deleteGoal, setGoals } = useGoals();
  const { messages, addMessage, clearChat } = useChatMessages();

  const filtered = horizon
    ? goals
        .filter((g) => g.horizon === horizon && g.category === category)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  const horizonLabel =
    HORIZONS.find((h) => h.key === horizon)?.label || "";

  const doneCount = filtered.filter((g) => g.status === "done").length;
  const inProgressCount = filtered.filter((g) => g.status === "in_progress").length;
  const blockedCount = filtered.filter((g) => g.status === "blocked").length;

  function handleCategoryChange(c: GoalCategory) {
    setCategory(c);
    setHorizon(null);
  }

  function handleHorizonClick(h: TimeHorizon) {
    setHorizon(horizon === h ? null : h);
  }

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!dragId || dragId === targetId || !horizon) return;

      const currentList = goals
        .filter((g) => g.horizon === horizon && g.category === category)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const dragIndex = currentList.findIndex((g) => g.id === dragId);
      const targetIndex = currentList.findIndex((g) => g.id === targetId);
      if (dragIndex === -1 || targetIndex === -1) return;

      const reordered = [...currentList];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const updatedGoals = goals.map((g) => {
        const newIndex = reordered.findIndex((r) => r.id === g.id);
        if (newIndex !== -1) {
          return { ...g, order: newIndex };
        }
        return g;
      });

      setGoals(updatedGoals);
      setDragId(null);
    },
    [dragId, goals, horizon, category, setGoals]
  );

  const handleDropOnHorizon = useCallback(
    (targetHorizon: TimeHorizon) => {
      if (!dragId) return;
      const updatedGoals = goals.map((g) =>
        g.id === dragId
          ? { ...g, horizon: targetHorizon, updatedAt: new Date().toISOString() }
          : g
      );
      setGoals(updatedGoals);
      setHorizon(targetHorizon);
      setDragId(null);
    },
    [dragId, goals, setGoals]
  );

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-xs font-mono text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <nav className="w-full border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold tracking-tight">Microgoals</h1>
          </div>
          <div className="flex items-center gap-8">
            <button
              onClick={() => handleCategoryChange("company")}
              className={`text-xs font-mono uppercase tracking-widest transition-colors pb-0.5 ${
                category === "company"
                  ? "text-black border-b border-black"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              Company
            </button>
            <button
              onClick={() => handleCategoryChange("personal")}
              className={`text-xs font-mono uppercase tracking-widest transition-colors pb-0.5 ${
                category === "personal"
                  ? "text-black border-b border-black"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              Personal
            </button>
          </div>
        </div>
      </nav>

      {/* Timeline with preview bubbles */}
      <div className="w-full max-w-6xl mx-auto">
        <HorizonNav
          activeHorizon={horizon}
          category={category}
          goals={goals}
          onHorizonChange={handleHorizonClick}
          onDropGoal={handleDropOnHorizon}
        />
      </div>

      {/* Goal detail panel — only shows when a horizon is selected */}
      {horizon && (
        <div className="flex-1 overflow-y-auto border-t border-neutral-100">
          <div className="max-w-2xl mx-auto px-8 py-8 pb-24">
            {/* Header with close */}
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-black">
                  {horizonLabel}
                </h2>
                <p className="text-[10px] font-mono text-neutral-400 mt-1">
                  {category === "company" ? "Company" : "Personal"} &middot;{" "}
                  {filtered.length} goal{filtered.length !== 1 ? "s" : ""}
                  {doneCount > 0 && (
                    <span className="text-green-600 ml-3">{doneCount} done</span>
                  )}
                  {inProgressCount > 0 && (
                    <span className="text-blue-500 ml-3">{inProgressCount} active</span>
                  )}
                  {blockedCount > 0 && (
                    <span className="text-red-500 ml-3">{blockedCount} blocked</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setHorizon(null)}
                className="text-xs font-mono text-neutral-400 hover:text-black transition-colors"
              >
                Close
              </button>
            </div>

            {/* Goals */}
            <div className="space-y-3">
              {filtered.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onUpdate={updateGoal}
                  onDelete={deleteGoal}
                  childCount={goals.filter((g) => g.parentId === goal.id).length}
                  showPin={category === "company"}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
              <AddGoal horizon={horizon} category={category} onAdd={addGoal} />
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no horizon selected */}
      {!horizon && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs font-mono text-neutral-300">
            Click a time horizon to view goals
          </p>
        </div>
      )}

      {/* Chat bubble */}
      <ChatBubble
        messages={messages}
        goals={goals}
        onAddMessage={addMessage}
        onClearChat={clearChat}
        onGoalsUpdate={setGoals}
      />
    </div>
  );
}
