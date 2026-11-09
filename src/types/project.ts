export type ContextType =
  | "website"
  | "x_handle"
  | "linkedin"
  | "telegram"
  | "message";

export interface ProjectContextItem {
  id: string;
  type: ContextType;
  title: string;
  value: string;
  url?: string;
  summary?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: "admin" | "ai";
  content: string;
  timestamp: string;
  usedContextIds?: string[];
  suggestedActions?: string[];
}

export type ProjectStage =
  | "Pre-TGE"
  | "Mainnet Live"
  | "IDO / Launchpad"
  | "Ecosystem Growth"
  | "Stealth";

export type ProjectBusinessStatus =
  | "new"
  | "contacted"
  | "collaborated"
  | "completed"
  | "unresponsive"
  | "archived";

export const BUSINESS_STATUS_META: Record<
  ProjectBusinessStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  new: {
    label: "New",
    shortLabel: "New",
    description: "New project lead",
    badgeClass:
      "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/15 dark:text-[#4599ff]",
    dotClass: "bg-[#0084ff]",
  },
  contacted: {
    label: "Contacted",
    shortLabel: "Contacted",
    description: "Outreach sent, awaiting reply",
    badgeClass:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  collaborated: {
    label: "Collaborated",
    shortLabel: "Collaborated",
    description: "Active partnership",
    badgeClass:
      "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-[#00a884]",
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    description: "Campaign completed",
    badgeClass:
      "bg-slate-200/80 text-slate-700 dark:bg-[#2a3942] dark:text-[#d1d7db]",
    dotClass: "bg-slate-500",
  },
  unresponsive: {
    label: "Unresponsive",
    shortLabel: "Unresponsive",
    description: "No response after follow-up",
    badgeClass:
      "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
  archived: {
    label: "Archived",
    shortLabel: "Archived",
    description: "Archived chat",
    badgeClass:
      "bg-slate-200/60 text-slate-500 dark:bg-[#202c33] dark:text-[#8696a0]",
    dotClass: "bg-slate-400",
  },
};

export interface CryptoProject {
  id: string;
  name: string;
  ticker: string;
  chain: string;
  stage: ProjectStage;
  businessStatus: ProjectBusinessStatus;
  avatarBg: string;
  logoUrl?: string;
  tagline: string;
  campaignBudget: string;
  sentimentScore: number;
  isPinned?: boolean;
  unreadInsights?: number;
  lastActivityTime: string;
  contexts: ProjectContextItem[];
  messages: ChatMessage[];
}
