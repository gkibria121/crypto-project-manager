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
    label: "New Lead",
    shortLabel: "New",
    description: "Fresh crypto project lead ready for initial discovery & outreach",
    badgeClass:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
    dotClass: "bg-sky-500",
  },
  contacted: {
    label: "Contacted",
    shortLabel: "Contacted",
    description: "Initial pitch or DM sent; in negotiation or awaiting reply",
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    dotClass: "bg-amber-500",
  },
  collaborated: {
    label: "Collaborated",
    shortLabel: "Collaborated",
    description: "Active partnership & live marketing campaign execution",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    dotClass: "bg-emerald-500",
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    description: "Campaign deliverables & milestone scope completed",
    badgeClass:
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
    dotClass: "bg-indigo-500",
  },
  unresponsive: {
    label: "Unresponsive",
    shortLabel: "Unresponsive",
    description: "No response after outreach follow-ups",
    badgeClass:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    dotClass: "bg-rose-500",
  },
  archived: {
    label: "Archived",
    shortLabel: "Archived",
    description: "Archived workspace kept for historical reference",
    badgeClass:
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25",
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
