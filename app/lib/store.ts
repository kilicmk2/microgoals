import { v4 as uuidv4 } from "uuid";

export type GoalStatus = "not_started" | "in_progress" | "done" | "blocked";
export type TimeHorizon = "5y" | "2y" | "1y" | "6m" | "monthly" | "weekly";
export type GoalCategory = "company" | "personal";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  horizon: TimeHorizon;
  category: GoalCategory;
  owner: string;
  parentId: string | null;
  reasoning: string;
  pinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STORAGE_KEY = "microgoals_data";
const CHAT_KEY = "microgoals_chat";

// Swapped: weekly on left, long-term on right
export const HORIZONS: { key: TimeHorizon; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "6m", label: "6 Month" },
  { key: "1y", label: "1 Year" },
  { key: "2y", label: "2 Year" },
  { key: "5y", label: "5 Year" },
];

export const PERSONAL_HORIZONS: { key: TimeHorizon; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export const PERSONAL_EXTRA_HORIZONS: { key: TimeHorizon; label: string }[] = [
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "5y", label: "5Y" },
];

export const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "text-neutral-400" },
  in_progress: { label: "In Progress", color: "text-blue-500" },
  done: { label: "Done", color: "text-green-600" },
  blocked: { label: "Blocked", color: "text-red-500" },
};

export function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function createGoal(
  partial: Partial<Goal> & Pick<Goal, "title" | "horizon" | "category">
): Goal {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    description: "",
    status: "not_started",
    owner: "",
    parentId: null,
    reasoning: "",
    pinned: false,
    order: Date.now(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function loadChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CHAT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
}

export function createChatMessage(role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: uuidv4(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}
