import { createDbClient } from "../src/db.js";

const AETHER_LOGO_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#1d4ed8"/><polygon points="60,24 92,42 92,78 60,96 28,78 28,42" fill="none" stroke="#ffffff" stroke-width="7"/><circle cx="60" cy="60" r="12" fill="#ffffff"/></svg>`
)}`;

const ZKFLOW_LOGO_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#00a884"/><path d="M60 24 L90 38 V62 C90 80 77 93 60 99 C43 93 30 80 30 62 V38 Z" fill="none" stroke="#ffffff" stroke-width="7"/><path d="M47 60 L56 69 L75 50" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
)}`;

const INITIAL_PROMPT_TEMPLATES = [
  {
    id: "tpl-linkedin-to-x",
    label: "Adapt this LinkedIn post into a 4-tweet X thread",
    description:
      "Converts institutional LinkedIn positioning into a high-conviction 4-tweet X thread.",
    systemPrompt:
      "You are a senior crypto growth strategist. Convert the project's institutional LinkedIn positioning and active contexts into a high-conviction 4-tweet X (Twitter) thread. Tweet 1: Sharp metric or narrative hook. Tweet 2: Core technical/product proof. Tweet 3: Token or ecosystem value accrual. Tweet 4: Direct CTA link without generic hashtags.",
    isDefault: true,
    sortOrder: 0,
  },
  {
    id: "tpl-mm-cold-dm",
    label: "Write a cold DM for institutional market makers",
    description:
      "Drafts concise institutional liquidity partner outreach grounded in active contexts.",
    systemPrompt:
      "You are an institutional Web3 BD lead. Write a concise, high-signal cold DM for institutional market makers, liquid token funds, and OTC desks using the project's active contexts. Emphasize liquidity depth, chain architecture, and partnership terms.",
    isDefault: false,
    sortOrder: 1,
  },
  {
    id: "tpl-founder-quote",
    label: "Generate executive founder quote",
    description:
      "Produces authoritative executive quotes for press releases and partner announcements.",
    systemPrompt:
      "You are an executive communications director for a Web3 protocol. Draft a punchy, authoritative founder quote suitable for press releases, LinkedIn announcements, and co-marketing posts grounded in the project's active contexts.",
    isDefault: false,
    sortOrder: 2,
  },
  {
    id: "tpl-kol-outreach",
    label: "Create Tier-1 KOL outreach DM",
    description:
      "Writes non-spammy Tier-1 crypto researcher & KOL pitch DMs.",
    systemPrompt:
      "Draft a personalized, non-spammy X/Telegram DM to pitch Tier-1 crypto researchers and KOLs on covering our upcoming milestone.",
    isDefault: false,
    sortOrder: 3,
  },
];

const INITIAL_CHECKLIST_ITEMS = [
  {
    id: "chk-tg-bot",
    label: "Telegram Bot",
    category: "community",
    scanPrompt: "Does this project have a Telegram bot or Telegram mini-app?",
    isRequired: false,
    sortOrder: 0,
  },
  {
    id: "chk-mcp-server",
    label: "MCP Server",
    category: "ai",
    scanPrompt:
      "Does this project have an MCP (Model Context Protocol) server for AI agents?",
    isRequired: false,
    sortOrder: 1,
  },
  {
    id: "chk-chatgpt-ai",
    label: "Add in ChatGPT / AI Platform",
    category: "ai",
    scanPrompt:
      "Can this project be added or integrated in ChatGPT, Claude, or other AI platforms?",
    isRequired: false,
    sortOrder: 2,
  },
  {
    id: "chk-sdk-api",
    label: "Developer SDK / Public API",
    category: "developer",
    scanPrompt:
      "Does this project provide a public developer SDK or API documentation?",
    isRequired: true,
    sortOrder: 3,
  },
  {
    id: "chk-analytics",
    label: "On-Chain Analytics (Dune / DefiLlama)",
    category: "analytics",
    scanPrompt:
      "Does this project have verifiable on-chain analytics, a live node map, or TVL tracking?",
    isRequired: true,
    sortOrder: 4,
  },
];

const INITIAL_PROJECTS = [
  {
    id: "proj-aether",
    name: "Aetheris AI Network",
    ticker: "$AETH",
    chain: "Solana",
    stage: "Pre-TGE" as const,
    businessStatus: "new" as const,
    avatarBg: "bg-[#1d4ed8]",
    logoUrl: AETHER_LOGO_URL,
    tagline: "Decentralized GPU inference mesh for autonomous DeFi agents",
    campaignBudget: "$45,000 / mo",
    sentimentScore: 94,
    tags: ["DePIN", "AI", "Solana"],
    isPinned: true,
    unreadInsights: 2,
    lastActivityTime: "2m",
    contexts: [
      {
        id: "ctx-aeth-1",
        type: "website" as const,
        title: "Official Website & Litepaper",
        value: "https://aetheris.network",
        url: "https://aetheris.network",
        summary:
          "Core positioning: sub-200ms verifiable AI inference on Solana with 68% lower compute cost than AWS.",
        isActive: true,
        updatedAtLabel: "Today",
      },
      {
        id: "ctx-aeth-2",
        type: "x_handle" as const,
        title: "Official X (Twitter)",
        value: "@AetherisNetwork",
        url: "https://x.com/AetherisNetwork",
        summary:
          "48.2K followers • Tone: technical, high-conviction, zero hype-fluff. Recent viral thread on DePIN node yields.",
        isActive: true,
        updatedAtLabel: "2h ago",
      },
      {
        id: "ctx-aeth-3",
        type: "linkedin" as const,
        title: "Company & Founders LinkedIn",
        value: "linkedin.com/company/aetheris-labs",
        url: "https://linkedin.com/company/aetheris-labs",
        summary:
          "Ex-DeepMind & Solana Labs engineers. Institutional B2B angle for enterprise AI partnerships.",
        isActive: true,
        updatedAtLabel: "Yesterday",
      },
      {
        id: "ctx-aeth-4",
        type: "message" as const,
        title: "Q4 TGE & KOL Campaign Brief",
        value:
          "Target TGE: Nov 28. Key narrative: 'DePIN meets Agentic Finance'. Avoid promising guaranteed APY; emphasize real compute revenue burn of $AETH.",
        url: null,
        summary:
          "Pinned admin directive for all generated marketing copy and KOL outreach scripts.",
        isActive: true,
        updatedAtLabel: "Pinned",
      },
      {
        id: "ctx-aeth-5",
        type: "telegram" as const,
        title: "Community Portal & Announcements",
        value: "t.me/AetherisOfficial",
        url: "https://t.me/AetherisOfficial",
        summary:
          "19.5K members • Testnet Epoch 3 node runner quest currently live.",
        isActive: false,
        updatedAtLabel: "3d ago",
      },
    ],
    messages: [
      {
        id: "msg-aeth-1",
        sender: "ai" as const,
        content:
          "Welcome back! I have loaded **4 active context sources** for **Aetheris AI Network ($AETH)** — including the website positioning, `@AetherisNetwork` X tone profile, LinkedIn founder credentials, and your Q4 TGE Campaign Brief.\n\nHow would you like to orchestrate today's campaign?",
        timestampLabel: "10:14 AM",
        usedContextIds: ["ctx-aeth-1", "ctx-aeth-2", "ctx-aeth-3", "ctx-aeth-4"],
        suggestedActions: [],
        model: "pulseos-engine",
      },
      {
        id: "msg-aeth-2",
        sender: "admin" as const,
        content:
          "Draft a high-converting 4-part X announcement thread for our Testnet Epoch 3 milestone and a LinkedIn post aimed at institutional compute partners.",
        timestampLabel: "10:18 AM",
        usedContextIds: [],
        suggestedActions: [],
      },
      {
        id: "msg-aeth-3",
        sender: "ai" as const,
        content:
          "Here is a coordinated cross-channel drop aligned with your **Q4 TGE Brief** and `@AetherisNetwork` voice:\n\n### 1. X (Twitter) Thread — `@AetherisNetwork`\n- **1/4 (Hook):** Verifiable AI inference shouldn't cost $40/hr on centralized clouds. Today, Aetheris Testnet Epoch 3 crosses 12,400 active GPU nodes on Solana — delivering sub-200ms agentic inference at 68% lower cost. 🧵👇\n- **2/4 (The Proof):** Unlike idle DePIN networks, every query routed through Aetheris settles on-chain and directly fuels `$AETH` compute-burn mechanics. Real enterprise demand, verifiable execution.\n- **3/4 (Builder Call):** Building autonomous DeFi agents? Plug into our SDK in 4 lines of TypeScript.\n- **4/4 (CTA):** Explore the live node map at `aetheris.network` before our Nov 28 milestone.\n\n### 2. LinkedIn Executive Post (`linkedin.com/company/aetheris-labs`)\n> **Institutional AI Needs Verifiable Infrastructure.**\n> Our team of former DeepMind and Solana systems engineers built Aetheris Labs to solve the #1 bottleneck in autonomous finance: deterministic, low-latency GPU compute. With Epoch 3 now processing 1.8M daily inferences, we are opening institutional partner onboarding ahead of Q4 mainnet.",
        timestampLabel: "10:19 AM",
        usedContextIds: ["ctx-aeth-1", "ctx-aeth-2", "ctx-aeth-3", "ctx-aeth-4"],
        suggestedActions: [
          "Generate 5 Tier-1 KOL DM outreach scripts",
          "Rewrite hook for CT degen audience",
          "Create Discord & Telegram announcement",
        ],
        model: "pulseos-engine",
      },
    ],
  },
  {
    id: "proj-zkflow",
    name: "zkFlow Protocol",
    ticker: "$ZKFL",
    chain: "Ethereum L2",
    stage: "Mainnet Live" as const,
    businessStatus: "contacted" as const,
    avatarBg: "bg-[#00a884]",
    logoUrl: ZKFLOW_LOGO_URL,
    tagline:
      "Zero-knowledge institutional dark pool & cross-rollup liquidity layer",
    campaignBudget: "$32,000 / mo",
    sentimentScore: 89,
    tags: ["ZK", "Institutional", "Liquidity"],
    isPinned: true,
    unreadInsights: 0,
    lastActivityTime: "18m",
    contexts: [
      {
        id: "ctx-zk-1",
        type: "website" as const,
        title: "zkFlow Mainnet App & Docs",
        value: "https://zkflow.fi",
        url: "https://zkflow.fi",
        summary:
          "Zero MEV, zero slippage dark pool for whales and DAO treasuries across Arbitrum, Base, and Optimism.",
        isActive: true,
        updatedAtLabel: "1d ago",
      },
      {
        id: "ctx-zk-2",
        type: "x_handle" as const,
        title: "X Handle",
        value: "@zkFlowProtocol",
        url: "https://x.com/zkFlowProtocol",
        summary:
          "31.4K followers • Focuses on MEV horror stories, institutional privacy, and TVL milestones ($140M+).",
        isActive: true,
        updatedAtLabel: "4h ago",
      },
      {
        id: "ctx-zk-3",
        type: "linkedin" as const,
        title: "zkFlow Institutional LinkedIn",
        value: "linkedin.com/company/zkflow-protocol",
        url: "https://linkedin.com/company/zkflow-protocol",
        summary:
          "Targets market makers, liquid token funds, and DAO treasury managers.",
        isActive: true,
        updatedAtLabel: "2d ago",
      },
      {
        id: "ctx-zk-4",
        type: "message" as const,
        title: "Compliance & Messaging Guardrails",
        value:
          "Always frame privacy as 'MEV Protection & Institutional Execution Confidentiality' (compliant programmable privacy), never 'anonymity mixer'.",
        url: null,
        summary:
          "Critical legal & brand framing note for all AI-generated content.",
        isActive: true,
        updatedAtLabel: "Pinned",
      },
    ],
    messages: [
      {
        id: "msg-zk-1",
        sender: "ai" as const,
        content:
          "Connected to **zkFlow Protocol ($ZKFL)** workspace. All **4 contexts** are active, including your *MEV Protection & Institutional Execution Confidentiality* guardrails.\n\nReady to craft DAO treasury pitches, X threads, or LinkedIn thought-leadership posts.",
        timestampLabel: "Yesterday",
        usedContextIds: ["ctx-zk-1", "ctx-zk-2", "ctx-zk-3", "ctx-zk-4"],
        suggestedActions: [],
        model: "pulseos-engine",
      },
    ],
  },
  {
    id: "proj-solvex",
    name: "Solvex RWA Vaults",
    ticker: "$SLVX",
    chain: "Base",
    stage: "Ecosystem Growth" as const,
    businessStatus: "collaborated" as const,
    avatarBg: "bg-[#0f172a]",
    logoUrl: null,
    tagline: "Tokenized T-Bills & private credit composable with Base DeFi",
    campaignBudget: "$28,500 / mo",
    sentimentScore: 91,
    tags: ["RWA", "Base", "DeFi"],
    isPinned: false,
    unreadInsights: 1,
    lastActivityTime: "1h",
    contexts: [
      {
        id: "ctx-slv-1",
        type: "website" as const,
        title: "Solvex Institutional Portal",
        value: "https://solvex.finance",
        url: "https://solvex.finance",
        summary:
          "Instant mint/redeem USDC to tokenized short-duration US Treasuries on Base L2.",
        isActive: true,
        updatedAtLabel: "3d ago",
      },
      {
        id: "ctx-slv-2",
        type: "x_handle" as const,
        title: "X Handle",
        value: "@SolvexFinance",
        url: "https://x.com/SolvexFinance",
        summary:
          "22.8K followers • RWA yield comparisons, Base ecosystem integrations (Aerodrome, Morpho).",
        isActive: true,
        updatedAtLabel: "6h ago",
      },
      {
        id: "ctx-slv-3",
        type: "linkedin" as const,
        title: "Solvex Capital LinkedIn",
        value: "linkedin.com/company/solvex-finance",
        url: "https://linkedin.com/company/solvex-finance",
        summary:
          "TradFi-to-DeFi bridge narrative; ex-BlackRock fixed income product leads.",
        isActive: true,
        updatedAtLabel: "5d ago",
      },
      {
        id: "ctx-slv-4",
        type: "message" as const,
        title: "Morpho Curated Vault Launch Note",
        value:
          "We just launched the $SLVX / USDC loop vault on Morpho Base. Highlight institutional audit by Spearbit and $25M initial cap.",
        url: null,
        summary:
          "Campaign brief for this week's Base ecosystem co-marketing push.",
        isActive: true,
        updatedAtLabel: "1h ago",
      },
    ],
    messages: [
      {
        id: "msg-slv-1",
        sender: "ai" as const,
        content:
          "I detected a new context note: **Morpho Curated Vault Launch Note** ($25M initial cap on Base, Spearbit audited). Want me to draft the co-marketing announcement for `@SolvexFinance` and LinkedIn?",
        timestampLabel: "09:30 AM",
        usedContextIds: ["ctx-slv-1", "ctx-slv-2", "ctx-slv-4"],
        suggestedActions: [],
        model: "pulseos-engine",
      },
    ],
  },
  {
    id: "proj-nebula",
    name: "Nebula Perps DEX",
    ticker: "$NEBU",
    chain: "Arbitrum",
    stage: "IDO / Launchpad" as const,
    businessStatus: "completed" as const,
    avatarBg: "bg-[#334155]",
    logoUrl: null,
    tagline:
      "Omnichain orderbook perpetuals with 100x gasless one-click trading",
    campaignBudget: "$52,000 / mo",
    sentimentScore: 87,
    tags: ["Perps", "Arbitrum"],
    isPinned: false,
    unreadInsights: 0,
    lastActivityTime: "3h",
    contexts: [
      {
        id: "ctx-neb-1",
        type: "website" as const,
        title: "Nebula Exchange dApp",
        value: "https://nebula.exchange",
        url: "https://nebula.exchange",
        summary:
          "Sub-10ms matching engine with self-custodial Arbitrum settlement & TradingView pro charts.",
        isActive: true,
        updatedAtLabel: "2d ago",
      },
      {
        id: "ctx-neb-2",
        type: "x_handle" as const,
        title: "Official X Handle",
        value: "@NebulaPerps",
        url: "https://x.com/NebulaPerps",
        summary:
          "64.1K followers • High-energy trader competitions, PnL card flexes, and liquidity mining epochs.",
        isActive: true,
        updatedAtLabel: "1d ago",
      },
      {
        id: "ctx-neb-3",
        type: "message" as const,
        title: "Trading Competition Season 2 Rules",
        value:
          "$250,000 prize pool in $ARB + $NEBU points multiplier. Makers pay 0 bps fee for 30 days.",
        url: null,
        summary: "Promo parameters for trader acquisition campaign.",
        isActive: true,
        updatedAtLabel: "2d ago",
      },
    ],
    messages: [
      {
        id: "msg-neb-1",
        sender: "ai" as const,
        content:
          "Nebula Perps ($NEBU) context loaded. We have 3 active contexts ready for your Season 2 Trading Competition ($250K prize pool, 0 bps maker fees). What are we shipping today?",
        timestampLabel: "Yesterday",
        usedContextIds: ["ctx-neb-1", "ctx-neb-2", "ctx-neb-3"],
        suggestedActions: [],
        model: "pulseos-engine",
      },
    ],
  },
  {
    id: "proj-omni",
    name: "OmniLayer Restaking",
    ticker: "$OMNI",
    chain: "Monad / EVM",
    stage: "Stealth" as const,
    businessStatus: "unresponsive" as const,
    avatarBg: "bg-[#0369a1]",
    logoUrl: null,
    tagline: "Shared economic security for parallelized EVM app-chains",
    campaignBudget: "$18,000 / mo",
    sentimentScore: 96,
    tags: ["Restaking", "Monad"],
    isPinned: false,
    unreadInsights: 0,
    lastActivityTime: "1d",
    contexts: [
      {
        id: "ctx-omni-1",
        type: "website" as const,
        title: "Stealth Manifesto Page",
        value: "https://omnilayer.xyz",
        url: "https://omnilayer.xyz",
        summary: "Waitlist gated with invite codes; backed by Tier-1 crypto VCs.",
        isActive: true,
        updatedAtLabel: "4d ago",
      },
      {
        id: "ctx-omni-2",
        type: "x_handle" as const,
        title: "X Handle",
        value: "@OmniLayerXYZ",
        url: "https://x.com/OmniLayerXYZ",
        summary:
          "9.4K followers • Cryptic research threads, high follower-to-engagement ratio.",
        isActive: true,
        updatedAtLabel: "3d ago",
      },
      {
        id: "ctx-omni-3",
        type: "linkedin" as const,
        title: "OmniLayer Labs LinkedIn",
        value: "linkedin.com/company/omnilayer-labs",
        url: "https://linkedin.com/company/omnilayer-labs",
        summary: "Hiring cryptography researchers and BD leads.",
        isActive: true,
        updatedAtLabel: "1w ago",
      },
    ],
    messages: [
      {
        id: "msg-omni-1",
        sender: "ai" as const,
        content:
          "Stealth workspace for **OmniLayer Restaking ($OMNI)** is active. Currently marked **Unresponsive** after initial outreach — ask me to draft a high-value follow-up bump with a free competitor narrative audit.",
        timestampLabel: "2 days ago",
        usedContextIds: ["ctx-omni-1", "ctx-omni-2", "ctx-omni-3"],
        suggestedActions: [],
        model: "pulseos-engine",
      },
    ],
  },
  {
    id: "proj-krono",
    name: "KronoSwap Modular",
    ticker: "$KRON",
    chain: "Sui",
    stage: "Mainnet Live" as const,
    businessStatus: "archived" as const,
    avatarBg: "bg-[#475569]",
    logoUrl: null,
    tagline: "Concentrated liquidity AMM on Sui (Q2 campaign archived)",
    campaignBudget: "$15,000 / mo",
    sentimentScore: 82,
    tags: ["DEX", "Sui"],
    isPinned: false,
    unreadInsights: 0,
    lastActivityTime: "2w",
    contexts: [
      {
        id: "ctx-kron-1",
        type: "website" as const,
        title: "KronoSwap App",
        value: "https://kronoswap.io",
        url: "https://kronoswap.io",
        summary: "Archived Q2 liquidity campaign on Sui.",
        isActive: true,
        updatedAtLabel: "2w ago",
      },
      {
        id: "ctx-kron-2",
        type: "x_handle" as const,
        title: "X Handle",
        value: "@KronoSwapSui",
        url: "https://x.com/KronoSwapSui",
        summary: "14.2K followers • Campaign concluded.",
        isActive: true,
        updatedAtLabel: "2w ago",
      },
    ],
    messages: [
      {
        id: "msg-kron-1",
        sender: "ai" as const,
        content:
          "This project workspace (**KronoSwap Modular — $KRON**) is currently **Archived**. You can unarchive it or switch its business status anytime to resume campaigns.",
        timestampLabel: "2 weeks ago",
        usedContextIds: ["ctx-kron-1", "ctx-kron-2"],
        suggestedActions: [],
        model: "pulseos-engine",
      },
    ],
  },
];

async function main() {
  console.log("Seeding PulseOS database with Prisma 8...");
  const db = createDbClient(process.env["DATABASE_URL"]);

  try {
    for (const tpl of INITIAL_PROMPT_TEMPLATES) {
      await db.orm.public.PromptTemplate.upsert({
        create: tpl,
        update: {
          label: tpl.label,
          description: tpl.description,
          systemPrompt: tpl.systemPrompt,
          isDefault: tpl.isDefault,
          sortOrder: tpl.sortOrder,
        },
      });
    }

    for (const item of INITIAL_CHECKLIST_ITEMS) {
      await db.orm.public.ChecklistItem.upsert({
        create: item,
        update: {
          label: item.label,
          category: item.category,
          scanPrompt: item.scanPrompt,
          isRequired: item.isRequired,
          sortOrder: item.sortOrder,
        },
      });
    }

    const baseTime = Date.now() - 1000 * 60 * 60;

    for (let pIdx = 0; pIdx < INITIAL_PROJECTS.length; pIdx++) {
      const proj = INITIAL_PROJECTS[pIdx];
      const existing = await db.orm.public.Project.select("id")
        .where({ id: proj.id })
        .first();

      if (existing) {
        continue;
      }

      await db.transaction(async (tx) => {
        await tx.orm.public.Project.create({
          id: proj.id,
          name: proj.name,
          ticker: proj.ticker,
          chain: proj.chain,
          stage: proj.stage,
          businessStatus: proj.businessStatus,
          avatarBg: proj.avatarBg,
          logoUrl: proj.logoUrl,
          tagline: proj.tagline,
          campaignBudget: proj.campaignBudget,
          sentimentScore: proj.sentimentScore,
          tags: proj.tags,
          isPinned: proj.isPinned,
          unreadInsights: proj.unreadInsights,
          lastActivityTime: proj.lastActivityTime,
          archivedAt:
            proj.businessStatus === "archived" ? new Date(baseTime) : null,
        });

        for (let cIdx = 0; cIdx < proj.contexts.length; cIdx++) {
          const ctx = proj.contexts[cIdx];
          await tx.orm.public.ProjectContext.create({
            id: ctx.id,
            projectId: proj.id,
            type: ctx.type,
            title: ctx.title,
            value: ctx.value,
            url: ctx.url,
            summary: ctx.summary,
            isActive: ctx.isActive,
            updatedAtLabel: ctx.updatedAtLabel,
            createdAt: new Date(baseTime + pIdx * 60_000 + cIdx * 1000),
          });
        }

        for (let mIdx = 0; mIdx < proj.messages.length; mIdx++) {
          const msg = proj.messages[mIdx];
          await tx.orm.public.ChatMessage.create({
            id: msg.id,
            projectId: proj.id,
            sender: msg.sender,
            content: msg.content,
            timestampLabel: msg.timestampLabel,
            usedContextIds: msg.usedContextIds,
            suggestedActions: msg.suggestedActions,
            model: msg.model ?? null,
            createdAt: new Date(baseTime + pIdx * 60_000 + mIdx * 1000),
          });
        }
      });
    }

    console.log("Prisma 8 seed completed successfully.");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("Failed to seed database:", error);
  process.exit(1);
});
