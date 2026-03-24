"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { Goal, GoalCategory } from "./store";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`API ${url} returned ${res.status}`);
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error(`API ${url} returned non-array:`, data);
    return [];
  }
  return data;
};

export function useGoals(category: GoalCategory) {
  const { data, error, isLoading, mutate } = useSWR<Goal[]>(
    `/api/goals?category=${category}`,
    fetcher
  );

  const goals = data ?? [];

  const addGoal = useCallback(
    async (goal: Partial<Goal> & { title: string; horizon: string; category: string }) => {
      try {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(goal),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Failed to add goal: ${JSON.stringify(err)}`);
        }
      } catch (e) {
        alert(`Network error adding goal: ${e}`);
      }
      await mutate(undefined, { revalidate: true });
    },
    [mutate]
  );

  const updateGoal = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      try {
        const res = await fetch(`/api/goals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Failed to update goal: ${JSON.stringify(err)}`);
        }
      } catch (e) {
        alert(`Network error updating goal: ${e}`);
      }
      await mutate(undefined, { revalidate: true });
    },
    [mutate]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/goals/${id}`, { method: "DELETE" });
      } catch (e) {
        alert(`Network error deleting goal: ${e}`);
      }
      await mutate(undefined, { revalidate: true });
    },
    [mutate]
  );

  const reorderGoals = useCallback(
    async (updates: { id: string; order: number; horizon?: string }[]) => {
      try {
        const res = await fetch("/api/goals/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Failed to reorder: ${JSON.stringify(err)}`);
        }
      } catch (e) {
        alert(`Network error reordering: ${e}`);
      }
      await mutate(undefined, { revalidate: true });
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

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useChatMessages() {
  const { data, mutate } = useSWR<ChatMsg[]>("/api/chat/history", fetcher);

  const messages = useMemo(() => data ?? [], [data]);

  const sendMessage = useCallback(
    async (content: string): Promise<{ reply?: string; error?: string; createdGoals?: string[] }> => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });
        const result = await res.json();
        mutate();
        return result;
      } catch (e) {
        return { error: String(e) };
      }
    },
    [mutate]
  );

  const clearChat = useCallback(async () => {
    await fetch("/api/chat/history", { method: "DELETE" });
    mutate([]);
  }, [mutate]);

  return { messages, sendMessage, clearChat };
}
