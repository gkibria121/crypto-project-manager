import type {
  ProjectBusinessStatus,
  ProjectChain,
  ProjectStage,
} from "../schemas/project.schema";

export const PROJECT_CHAINS: readonly ProjectChain[] = [
  "Solana",
  "Ethereum L2",
  "Base",
  "Arbitrum",
  "Sui",
  "Monad / EVM",
] as const;

export const PROJECT_STAGES: readonly ProjectStage[] = [
  "Pre-TGE",
  "Mainnet Live",
  "IDO / Launchpad",
  "Ecosystem Growth",
  "Stealth",
] as const;

export const BUSINESS_STATUS_ORDER: readonly ProjectBusinessStatus[] = [
  "new",
  "contacted",
  "collaborated",
  "completed",
  "unresponsive",
  "archived",
] as const;

export const SOLID_AVATAR_COLORS = [
  "bg-[#1d4ed8]",
  "bg-[#00a884]",
  "bg-[#0f172a]",
  "bg-[#334155]",
  "bg-[#0369a1]",
] as const;

export const BUSINESS_STATUS_META: Record<
  ProjectBusinessStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
    dotClass: string;
    sortPriority: number;
  }
> = {
  new: {
    label: "New",
    shortLabel: "New",
    description: "New project lead",
    badgeClass:
      "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/15 dark:text-[#4599ff]",
    dotClass: "bg-[#0084ff]",
    sortPriority: 0,
  },
  contacted: {
    label: "Contacted",
    shortLabel: "Contacted",
    description: "Outreach sent, awaiting reply",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    sortPriority: 1,
  },
  collaborated: {
    label: "Collaborated",
    shortLabel: "Collaborated",
    description: "Active partnership",
    badgeClass: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-[#00a884]",
    sortPriority: 2,
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    description: "Campaign completed",
    badgeClass:
      "bg-slate-200/80 text-slate-700 dark:bg-[#2a3942] dark:text-[#d1d7db]",
    dotClass: "bg-slate-500",
    sortPriority: 3,
  },
  unresponsive: {
    label: "Unresponsive",
    shortLabel: "Unresponsive",
    description: "No response after follow-up",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
    sortPriority: 4,
  },
  archived: {
    label: "Archived",
    shortLabel: "Archived",
    description: "Archived chat",
    badgeClass:
      "bg-slate-200/60 text-slate-500 dark:bg-[#202c33] dark:text-[#8696a0]",
    dotClass: "bg-slate-400",
    sortPriority: 5,
  },
};
