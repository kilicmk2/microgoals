export type GoalStatus = "not_started" | "in_progress" | "done" | "blocked";
export type TimeHorizon = "5y" | "2y" | "1y" | "6m" | "3m" | "monthly" | "weekly";
export type GoalCategory = "company" | "personal" | "executive";
export type WorkStream =
  | "network"
  | "payment"
  | "hardware"
  | "app"
  | "pipeline"
  | "microops"
  | "research"
  | "sales"
  | "fundraising"
  | "marketing"
  | "finance";

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
  workstream: string | null;
  targetDate: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
}

export const MASTER_EMAIL = "bercan.kilic@micro-agi.com";
export const EXECUTIVE_EMAILS = ["addy@micro-agi.com", "bercan.kilic@micro-agi.com"];
export const TECHNICAL_ADMINS = ["nico.nussbaum@micro-agi.com", "bercan.kilic@micro-agi.com"];

export interface CanvasNode {
  id: string;
  userId: string | null;
  title: string;
  description: string;
  status: GoalStatus;
  owner: string;
  estimatedHours: number | null;
  x: number;
  y: number;
  connectedTo: string[];
  createdBy: string | null;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const WORK_STREAMS: { key: WorkStream; label: string }[] = [
  { key: "network", label: "Network" },
  { key: "payment", label: "Payment" },
  { key: "hardware", label: "Hardware & Sourcing" },
  { key: "app", label: "App" },
  { key: "pipeline", label: "Pipeline" },
  { key: "microops", label: "MicroOps" },
  { key: "research", label: "Research" },
  { key: "sales", label: "Sales" },
  { key: "fundraising", label: "Fundraising/Comms" },
  { key: "marketing", label: "Marketing & Brand" },
  { key: "finance", label: "Finance/Legal/HR" },
];

export const WORK_STREAM_SHORT: Record<WorkStream, string> = {
  network: "NET",
  payment: "PAY",
  hardware: "HW",
  app: "APP",
  pipeline: "PIPE",
  microops: "OPS",
  research: "RES",
  sales: "SALES",
  fundraising: "FUND",
  marketing: "MKT",
  finance: "FIN",
};

export const EXECUTIVE_HORIZONS: { key: TimeHorizon; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "3m", label: "3 Month" },
  { key: "1y", label: "1 Year" },
  { key: "5y", label: "5 Year" },
];

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
    order: Math.floor(Date.now() / 1000) % 2000000000,
    ...partial,
  };
}
