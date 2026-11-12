import type {
  AiProvider,
  ContextType,
  CryptoProject,
  Permission,
  ProjectBusinessStatus,
  ProjectChain,
  ProjectPlatformRank,
  ProjectStage,
  ScrapeConfig,
  SpecializedScraperProvider,
  SyncProvider,
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
  "active",
  "contacted",
  "collaborated",
  "completed",
  "unresponsive",
  "archived",
] as const;

export const CREATABLE_BUSINESS_STATUS_ORDER: readonly ProjectBusinessStatus[] =
  BUSINESS_STATUS_ORDER.filter((status) => status !== "active");

export function shouldAutoActivateOnActivity(
  currentStatus: ProjectBusinessStatus
): boolean {
  return currentStatus === "new";
}

export const SUGGESTED_NEXT_STATUSES: Record<
  ProjectBusinessStatus,
  readonly ProjectBusinessStatus[]
> = {
  new: ["contacted", "archived"],
  active: ["contacted", "collaborated", "unresponsive", "archived"],
  contacted: ["collaborated", "unresponsive", "completed", "archived"],
  collaborated: ["completed", "contacted", "unresponsive", "archived"],
  completed: ["collaborated", "archived"],
  unresponsive: ["contacted", "active", "archived"],
  archived: ["active", "new"],
};

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
    description:
      "Newly added project — becomes Active automatically on first chat, scrape, checklist, or edit action",
    badgeClass:
      "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/15 dark:text-[#4599ff]",
    dotClass: "bg-[#0084ff]",
    sortPriority: 0,
  },
  active: {
    label: "Active",
    shortLabel: "Active",
    description:
      "In progress — activated automatically when an admin or team member interacts with this project",
    badgeClass:
      "bg-indigo-500/12 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    dotClass: "bg-indigo-500",
    sortPriority: 1,
  },
  contacted: {
    label: "Contacted",
    shortLabel: "Contacted",
    description: "Outreach sent, awaiting reply",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    sortPriority: 2,
  },
  collaborated: {
    label: "Collaborated",
    shortLabel: "Collaborated",
    description: "Active partnership",
    badgeClass: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-[#00a884]",
    sortPriority: 3,
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    description: "Campaign completed",
    badgeClass:
      "bg-slate-200/80 text-slate-700 dark:bg-[#2a3942] dark:text-[#d1d7db]",
    dotClass: "bg-slate-500",
    sortPriority: 4,
  },
  unresponsive: {
    label: "Unresponsive",
    shortLabel: "Unresponsive",
    description: "No response after follow-up",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
    sortPriority: 5,
  },
  archived: {
    label: "Archived",
    shortLabel: "Archived",
    description: "Archived chat",
    badgeClass:
      "bg-slate-200/60 text-slate-500 dark:bg-[#202c33] dark:text-[#8696a0]",
    dotClass: "bg-slate-400",
    sortPriority: 6,
  },
};

export const SYNC_PROVIDERS: readonly SyncProvider[] = [
  "coingecko",
  "coinmarketcap",
  "livecoinwatch",
  "coincap",
] as const;

export const SYNC_PROVIDER_META: Record<
  SyncProvider,
  {
    label: string;
    shortLabel: string;
    description: string;
    envVar: string;
    apiBaseUrl: string;
    docsUrl: string;
    freeTierNote: string;
    badgeClass: string;
  }
> = {
  coingecko: {
    label: "CoinGecko Market Cap API",
    shortLabel: "CoinGecko",
    description:
      "Sync top crypto assets by market cap, token metadata, official websites, X handles, and LinkedIn profiles via CoinGecko v3 Demo API.",
    envVar: "COINGECKO_API_KEY",
    apiBaseUrl: "https://api.coingecko.com/api/v3",
    docsUrl: "https://www.coingecko.com/en/api",
    freeTierNote: "Free Demo API tier (30 calls/min)",
    badgeClass:
      "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  coinmarketcap: {
    label: "CoinMarketCap Basic API",
    shortLabel: "CoinMarketCap",
    description:
      "Sync market-cap ranked cryptocurrencies, logos, descriptions, and official website/social context links via CoinMarketCap Pro Basic API.",
    envVar: "COINMARKETCAP_API_KEY",
    apiBaseUrl: "https://pro-api.coinmarketcap.com",
    docsUrl: "https://coinmarketcap.com/api/",
    freeTierNote: "Free Basic tier (10,000 credits/mo)",
    badgeClass:
      "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]",
  },
  livecoinwatch: {
    label: "LiveCoinWatch API",
    shortLabel: "LiveCoinWatch",
    description:
      "Sync real-time market cap leaders with first-class Website, X (Twitter), and LinkedIn social links via LiveCoinWatch Coins API.",
    envVar: "LIVECOINWATCH_API_KEY",
    apiBaseUrl: "https://api.livecoinwatch.com",
    docsUrl: "https://www.livecoinwatch.com/tools/api",
    freeTierNote: "Free API key (10,000 requests/day)",
    badgeClass:
      "bg-purple-500/12 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  },
  coincap: {
    label: "CoinCap Market Data API",
    shortLabel: "CoinCap",
    description:
      "Sync high-liquidity crypto assets, market capitalization rankings, and social context links via CoinCap REST API.",
    envVar: "COINCAP_API_KEY",
    apiBaseUrl: "https://rest.coincap.io/v3",
    docsUrl: "https://docs.coincap.io/",
    freeTierNote: "Free Bearer API key tier",
    badgeClass:
      "bg-amber-500/12 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
};

export const DEFAULT_SCRAPE_CONFIG: ScrapeConfig = {
  levels: 2,
  maxPages: 10,
  renderJs: true,
  waitUntil: "networkidle",
  waitForMs: 1200,
  scrollToBottom: true,
  sameDomainOnly: true,
  includeSubdomains: true,
  respectRobotsTxt: true,
  extractStructuredData: true,
  extractContacts: true,
  blockMedia: true,
  timeoutSeconds: 15,
  includePatterns: [],
  excludePatterns: [],
  xPostsLimit: 10,
  linkedinPostsLimit: 10,
  specializedMaxItems: 10,
};

export const SPECIALIZED_SCRAPER_PROVIDERS: readonly SpecializedScraperProvider[] =
  ["x", "linkedin", "telegram"] as const;

export const AI_PROVIDERS: readonly AiProvider[] = [
  "google",
  "openai",
  "anthropic",
  "groq",
  "openrouter",
] as const;

export const AI_PROVIDER_META: Record<
  AiProvider,
  {
    label: string;
    shortLabel: string;
    envVar: string;
    docsUrl: string;
    defaultModel: string;
    recommendedModels: string[];
    description: string;
  }
> = {
  google: {
    label: "Google AI Studio (Gemini)",
    shortLabel: "Google AI Studio",
    envVar: "GEMINI_API_KEY",
    docsUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.5-flash-lite",
    recommendedModels: [
      "gemini-3.5-flash-lite",
    ],
    description:
      "Fast, multimodal Gemini models powered by Google AI Studio API keys.",
  },
  openai: {
    label: "OpenAI",
    shortLabel: "OpenAI",
    envVar: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    recommendedModels: [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-mini",
      "gpt-4.1",
      "o4-mini",
      "o3-mini",
    ],
    description: "GPT-4o, GPT-4.1, and reasoning models from OpenAI.",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    shortLabel: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-4-20250514",
    recommendedModels: [
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-opus-4-20250514",
    ],
    description: "Claude Sonnet, Haiku, and Opus models from Anthropic.",
  },
  groq: {
    label: "Groq",
    shortLabel: "Groq",
    envVar: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    recommendedModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b",
      "mixtral-8x7b-32768",
    ],
    description: "Ultra-low-latency LPU inference for open-weight models.",
  },
  openrouter: {
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/keys",
    defaultModel: "openai/gpt-4o-mini",
    recommendedModels: [
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "anthropic/claude-sonnet-4",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    description: "Unified gateway to 100+ commercial and open-source models.",
  },
};

export const SPECIALIZED_SCRAPER_PROVIDER_META: Record<
  SpecializedScraperProvider,
  {
    label: string;
    shortLabel: string;
    envVar: string;
    preferredMethod: string;
    docsUrl: string;
    requiredNotice: string;
    badgeClass: string;
  }
> = {
  x: {
    label: "X (Twitter) API v2",
    shortLabel: "X / Twitter",
    envVar: "X_API_BEARER_TOKEN",
    preferredMethod:
      "Official X API v2 (/2/users/by/username & /2/users/:id/tweets)",
    docsUrl: "https://developer.x.com/en/docs/twitter-api",
    requiredNotice:
      "API key needed: X (Twitter) requires an X API v2 Bearer Token (X_API_BEARER_TOKEN) because unauthenticated scraping is blocked.",
    badgeClass:
      "bg-slate-900/10 text-slate-800 dark:bg-white/10 dark:text-[#e9edef]",
  },
  linkedin: {
    label: "LinkedIn REST API",
    shortLabel: "LinkedIn",
    envVar: "LINKEDIN_API_KEY",
    preferredMethod:
      "Official LinkedIn Organizations & Community API (/rest/organizations & /rest/posts)",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/",
    requiredNotice:
      "API key needed: LinkedIn requires an official LinkedIn OAuth 2.0 Access Token (LINKEDIN_API_KEY) to access organization and profile metadata.",
    badgeClass:
      "bg-[#0a66c2]/12 text-[#0a66c2] dark:bg-[#0a66c2]/25 dark:text-[#60a5fa]",
  },
  telegram: {
    label: "Telegram Bot API",
    shortLabel: "Telegram",
    envVar: "TELEGRAM_BOT_TOKEN",
    preferredMethod:
      "Official Telegram Bot API (getChat, getChatMemberCount, getUpdates)",
    docsUrl: "https://core.telegram.org/bots/api",
    requiredNotice:
      "API key needed: Telegram requires a Bot API Token from @BotFather (TELEGRAM_BOT_TOKEN) to inspect channels, groups, and messages.",
    badgeClass:
      "bg-[#229ed9]/12 text-[#167fb3] dark:bg-[#229ed9]/20 dark:text-[#5cc4f5]",
  },
};

export function getProjectPlatformRanksList(
  project: Pick<CryptoProject, "platformRanks">
): ProjectPlatformRank[] {
  if (!project.platformRanks) return [];
  return Object.values(project.platformRanks)
    .filter((entry): entry is ProjectPlatformRank => Boolean(entry))
    .sort((a, b) => a.rank - b.rank);
}

export function detectSpecializedProvider(
  contextType: ContextType,
  rawValueOrUrl?: string | null
): SpecializedScraperProvider | null {
  if (contextType === "x_handle") return "x";
  if (contextType === "linkedin") return "linkedin";
  if (contextType === "telegram") return "telegram";
  if (contextType === "message" || !rawValueOrUrl) return null;

  const lower = rawValueOrUrl.trim().toLowerCase();
  let host = "";
  try {
    const parsed = new URL(lower.includes("://") ? lower : `https://${lower}`);
    host = parsed.hostname;
  } catch {
    host = lower;
  }

  if (
    host === "x.com" ||
    host.endsWith(".x.com") ||
    host === "twitter.com" ||
    host.endsWith(".twitter.com")
  ) {
    return "x";
  }
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    return "linkedin";
  }
  if (
    host === "t.me" ||
    host.endsWith(".t.me") ||
    host === "telegram.me" ||
    host.endsWith(".telegram.me")
  ) {
    return "telegram";
  }
  return null;
}
