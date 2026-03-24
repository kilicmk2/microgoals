"use client";

import { useState, useEffect, useCallback } from "react";
import { Goal, loadGoals, saveGoals, ChatMessage, loadChat, saveChat } from "./store";
import { getSeedGoals } from "./seed-goals";

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = loadGoals();
    if (existing.length > 0) {
      setGoals(existing);
    } else {
      const seed = getSeedGoals();
      setGoals(seed);
      saveGoals(seed);
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: Goal[]) => {
    setGoals(next);
    saveGoals(next);
  }, []);

  const addGoal = useCallback(
    (goal: Goal) => {
      persist([...goals, goal]);
    },
    [goals, persist]
  );

  const updateGoal = useCallback(
    (id: string, updates: Partial<Goal>) => {
      persist(
        goals.map((g) =>
          g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
        )
      );
    },
    [goals, persist]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      persist(goals.filter((g) => g.id !== id));
    },
    [goals, persist]
  );

  return { goals, loaded, addGoal, updateGoal, deleteGoal, setGoals: persist };
}

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages(loadChat());
  }, []);

  const addMessage = useCallback(
    (msg: ChatMessage) => {
      const next = [...messages, msg];
      setMessages(next);
      saveChat(next);
    },
    [messages]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    saveChat([]);
  }, []);

  return { messages, addMessage, setMessages, clearChat };
}
