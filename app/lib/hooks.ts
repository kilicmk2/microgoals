"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { Goal, GoalCategory, ChatMessage } from "./store";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

export function useGoals(category: GoalCategory) {
  const { data, error, isLoading, mutate } = useSWR<Goal[]>(
    `/api/goals?category=${category}`,
    fetcher
  );

  const goals = data ?? [];

  const addGoal = useCallback(
    async (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goal),
      });
      if (res.ok) mutate();
    },
    [mutate]
  );

  const updateGoal = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) mutate();
    },
    [mutate]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      await fetch(`/api/goals/${id}`, { method: "DELETE" });
      mutate();
    },
    [mutate]
  );

  const reorderGoals = useCallback(
    async (updates: { id: string; order: number; horizon?: string }[]) => {
      await fetch("/api/goals/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      mutate();
    },
    [mutate]
  );

  return {
    goals,
    loaded: !isLoading,
    error,
    addGoal,
    updateGoal,
    deleteGoal,
    reorderGoals,
    refreshGoals: mutate,
  };
}

export function useChatMessages() {
  const { data, mutate } = useSWR<ChatMessage[]>("/api/chat/history", fetcher);

  const messages = useMemo(() => data ?? [], [data]);

  const sendMessage = useCallback(
    async (content: string) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      const result = await res.json();
      mutate(); // Re-fetch from server
      return result;
    },
    [mutate]
  );

  const clearChat = useCallback(async () => {
    await fetch("/api/chat/history", { method: "DELETE" });
    mutate([]);
  }, [mutate]);

  return { messages, sendMessage, clearChat };
}
