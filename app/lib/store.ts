export type GoalStatus = "not_started" | "in_progress" | "done" | "blocked";
export type TimeHorizon = "5y" | "2y" | "1y" | "6m" | "monthly" | "weekly";
export type GoalCategory = "company" | "personal";

export interface Goal {
  id: string;
  userId: string | null;
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
  approved: boolean;
  proposedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MASTER_EMAIL = "bercan.kilic@micro-agi.com";

export interface ChatMessage {
  id: string;
  userId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Weekly on left, long-term on right
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

export function createGoal(
  partial: Partial<Goal> & Pick<Goal, "title" | "horizon" | "category">
): Partial<Goal> & { title: string; horizon: string; category: string } {
  return {
    description: "",
    status: "not_started",
    owner: "",
    parentId: null,
    reasoning: "",
    pinned: false,
    order: Date.now(),
    ...partial,
  };
}
