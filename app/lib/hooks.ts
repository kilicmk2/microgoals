"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Goal, loadGoals, saveGoals, ChatMessage, loadChat, saveChat } from "./store";
import { getSeedGoals } from "./seed-goals";

let goalsCache: Goal[] | null = null;
let chatCache: ChatMessage[] | null = null;

function getGoalsSnapshot(): Goal[] {
  if (goalsCache === null) {
    if (typeof window === "undefined") return [];
    const existing = loadGoals();
    if (existing.length > 0) {
      goalsCache = existing;
    } else {
      const seed = getSeedGoals();
      saveGoals(seed);
      goalsCache = seed;
    }
  }
  return goalsCache;
}

function getChatSnapshot(): ChatMessage[] {
  if (chatCache === null) {
    if (typeof window === "undefined") return [];
    chatCache = loadChat();
  }
  return chatCache;
}

const emptyGoals: Goal[] = [];
const emptyChat: ChatMessage[] = [];

export function useGoals() {
  const goals = useSyncExternalStore(
    () => () => {},
    getGoalsSnapshot,
    () => emptyGoals
  );
  const [, forceUpdate] = useState(0);

  const persist = useCallback((next: Goal[]) => {
    goalsCache = next;
    saveGoals(next);
    forceUpdate((n) => n + 1);
  }, []);

  const addGoal = useCallback(
    (goal: Goal) => {
      persist([...getGoalsSnapshot(), goal]);
    },
    [persist]
  );

  const updateGoal = useCallback(
    (id: string, updates: Partial<Goal>) => {
      persist(
        getGoalsSnapshot().map((g) =>
          g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
        )
      );
    },
    [persist]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      persist(getGoalsSnapshot().filter((g) => g.id !== id));
    },
    [persist]
  );

  return { goals, loaded: true, addGoal, updateGoal, deleteGoal, setGoals: persist };
}

export function useChatMessages() {
  const messages = useSyncExternalStore(
    () => () => {},
    getChatSnapshot,
    () => emptyChat
  );
  const [, forceUpdate] = useState(0);

  const addMessage = useCallback(
    (msg: ChatMessage) => {
      const next = [...getChatSnapshot(), msg];
      chatCache = next;
      saveChat(next);
      forceUpdate((n) => n + 1);
    },
    []
  );

  const clearChat = useCallback(() => {
    chatCache = [];
    saveChat([]);
    forceUpdate((n) => n + 1);
  }, []);

  return { messages, addMessage, setMessages: () => {}, clearChat };
}
