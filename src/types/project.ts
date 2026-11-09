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

export interface CryptoProject {
  id: string;
  name: string;
  ticker: string;
  chain: string;
  stage: ProjectStage;
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
