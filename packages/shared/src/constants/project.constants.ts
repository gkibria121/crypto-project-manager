import type {
  Permission,
  ProjectBusinessStatus,
  ProjectChain,
  ProjectStage,
  UserRole,
} from "../schemas/project.schema";

export const USER_ROLES: readonly UserRole[] = [
  "admin",
  "manager",
  "analyst",
  "viewer",
] as const;

export const ALL_PERMISSIONS: readonly Permission[] = [
  "projects:read",
  "projects:create",
  "projects:update",
  "projects:delete",
  "contexts:write",
  "scraper:trigger",
  "chat:write",
  "checklist:write",
  "settings:read",
  "settings:write",
  "users:read",
  "users:write",
] as const;

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    "projects:read",
    "projects:create",
    "projects:update",
    "projects:delete",
    "contexts:write",
    "scraper:trigger",
    "chat:write",
    "checklist:write",
    "settings:read",
    "settings:write",
    "users:read",
    "users:write",
  ],
  manager: [
    "projects:read",
    "projects:create",
    "projects:update",
    "contexts:write",
    "scraper:trigger",
    "chat:write",
    "checklist:write",
    "settings:read",
    "settings:write",
    "users:read",
  ],
  analyst: [
    "projects:read",
    "contexts:write",
    "scraper:trigger",
    "chat:write",
    "checklist:write",
    "settings:read",
  ],
  viewer: ["projects:read", "settings:read"],
} as const;

export const USER_ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  admin: {
    label: "Admin",
    shortLabel: "Admin",
    description:
      "Full workspace administration, user & role management, project deletion, and global settings.",
    badgeClass:
      "bg-purple-500/12 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  },
  manager: {
    label: "BD Manager",
    shortLabel: "Manager",
    description:
      "Create and manage projects, update pipeline status, configure prompt templates & checklists, and view team members.",
    badgeClass:
      "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]",
  },
  analyst: {
    label: "Growth Analyst",
    shortLabel: "Analyst",
    description:
      "Manage project contexts, trigger web/social scraping, run AI campaign synthesis, and execute feature checklists.",
    badgeClass:
      "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  viewer: {
    label: "Viewer / Auditor",
    shortLabel: "Viewer",
    description:
      "Read-only access to project workspaces, contexts, scraped intelligence, checklists, and AI campaign history.",
    badgeClass:
      "bg-slate-200/80 text-slate-700 dark:bg-[#2a3942] dark:text-[#d1d7db]",
  },
};

export const PERMISSION_LABELS: Record<
  Permission,
  { label: string; category: string }
> = {
  "projects:read": { label: "View Projects & Chats", category: "Projects" },
  "projects:create": { label: "Create Projects", category: "Projects" },
  "projects:update": {
    label: "Update Status & Logo",
    category: "Projects",
  },
  "projects:delete": { label: "Delete Projects", category: "Projects" },
  "contexts:write": {
    label: "Add / Toggle / Delete Contexts",
    category: "Intelligence",
  },
  "scraper:trigger": {
    label: "Trigger Python Scraper",
    category: "Intelligence",
  },
  "chat:write": {
    label: "Generate AI Campaigns & Reset Chat",
    category: "Campaigns",
  },
  "checklist:write": {
    label: "Scan & Toggle Checklists",
    category: "Campaigns",
  },
  "settings:read": {
    label: "Read Global Templates",
    category: "Settings",
  },
  "settings:write": {
    label: "Edit Global Templates & Checklists",
    category: "Settings",
  },
  "users:read": { label: "View Team & Audit Logs", category: "Access Control" },
  "users:write": {
    label: "Manage Users & Assign Roles",
    category: "Access Control",
  },
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function hasPermission(
  subject:
    | { role: UserRole; permissions?: readonly Permission[] }
    | UserRole
    | null
    | undefined,
  permission: Permission
): boolean {
  if (!subject) return false;
  if (typeof subject === "string") {
    return ROLE_PERMISSIONS[subject]?.includes(permission) ?? false;
  }
  if (subject.permissions && subject.permissions.length > 0) {
    return subject.permissions.includes(permission);
  }
  return ROLE_PERMISSIONS[subject.role]?.includes(permission) ?? false;
}

export function hasAnyRole(
  subject: { role: UserRole } | UserRole | null | undefined,
  allowedRoles: readonly UserRole[]
): boolean {
  if (!subject) return false;
  const role = typeof subject === "string" ? subject : subject.role;
  return allowedRoles.includes(role);
}

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
