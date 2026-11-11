import { BUSINESS_STATUS_META } from "./constants/project.constants";
import type {
  ChecklistItemConfig,
  ContextType,
  CryptoProject,
  ProjectChecklistItemState,
  ProjectContextItem,
  PromptTemplate,
} from "./schemas/project.schema";

export function formatCurrentTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizeContextUrl(
  rawType: ContextType,
  rawVal: string
): string | undefined {
  const v = rawVal.trim();
  if (!v || rawType === "message") return undefined;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (rawType === "x_handle") {
    return `https://x.com/${v.replace(/^@/, "")}`;
  }
  return `https://${v}`;
}

export function evaluateChecklistItemAgainstProject(
  project: CryptoProject,
  item: ChecklistItemConfig
): ProjectChecklistItemState {
  const scrapedSignals = project.contexts.flatMap(
    (c) => c.scrapedMetadata?.signals ?? []
  );
  const scrapedCorpus = project.contexts
    .map((c) => {
      const meta = c.scrapedMetadata;
      if (!meta) return "";
      return [
        meta.title ?? "",
        meta.description ?? "",
        meta.rawPreview ?? "",
        Object.values(meta.socialLinks ?? {}).join(" "),
        (meta.signals ?? []).join(" "),
      ].join(" ");
    })
    .join(" ");

  const corpus = [
    project.name,
    project.tagline,
    scrapedCorpus,
    ...project.contexts.map(
      (c) => `${c.type} ${c.title} ${c.value} ${c.summary || ""}`
    ),
  ]
    .join(" ")
    .toLowerCase();

  const q = `${item.label} ${item.scanPrompt}`.toLowerCase();

  let detected = false;
  let note = "";

  if (q.includes("telegram") || q.includes("bot")) {
    const tgCtx = project.contexts.find((c) => c.type === "telegram");
    detected =
      Boolean(tgCtx) ||
      scrapedSignals.includes("telegram_bot") ||
      corpus.includes("t.me") ||
      corpus.includes("bot");
    note = detected
      ? `Found Telegram presence (${tgCtx?.value || "t.me link"}) in project contexts.`
      : "No Telegram bot or t.me link found in project contexts — opportunity to pitch a Telegram community/trading bot.";
  } else if (q.includes("mcp")) {
    detected =
      scrapedSignals.includes("mcp_server") ||
      corpus.includes("mcp") ||
      corpus.includes("agent") ||
      corpus.includes("inference") ||
      corpus.includes("sdk");
    note = detected
      ? "Agentic / SDK infrastructure detected in project positioning; compatible with MCP server deployment."
      : "No MCP server mentioned in contexts — high-value opportunity to build an MCP server for AI agent access.";
  } else if (q.includes("chatgpt") || q.includes("ai platform")) {
    detected =
      scrapedSignals.includes("ai_integration") ||
      corpus.includes("ai") ||
      corpus.includes("chatgpt") ||
      corpus.includes("deepmind") ||
      corpus.includes("agent");
    note = detected
      ? "AI positioning found in contexts; ready for ChatGPT / AI platform plugin listing."
      : "Not currently indexed for ChatGPT / AI platform integrations.";
  } else if (q.includes("sdk") || q.includes("api") || q.includes("doc")) {
    detected =
      scrapedSignals.includes("developer_sdk") ||
      scrapedSignals.includes("api_docs") ||
      corpus.includes("sdk") ||
      corpus.includes("docs") ||
      corpus.includes("litepaper") ||
      corpus.includes("app");
    note = detected
      ? "Developer documentation / portal reference found in website contexts."
      : "No public SDK or API documentation link found in active contexts.";
  } else if (
    q.includes("analytics") ||
    q.includes("dune") ||
    q.includes("tvl") ||
    q.includes("node")
  ) {
    detected =
      scrapedSignals.includes("onchain_analytics") ||
      corpus.includes("tvl") ||
      corpus.includes("node") ||
      corpus.includes("vault") ||
      corpus.includes("140m") ||
      corpus.includes("25m") ||
      corpus.includes("dune") ||
      corpus.includes("defillama");
    note = detected
      ? "On-chain metrics / TVL / node telemetry referenced in project contexts."
      : "No public Dune or on-chain analytics dashboard linked yet.";
  } else {
    const keywords = item.label
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    detected = keywords.some((kw) => corpus.includes(kw));
    note = detected
      ? `Matched "${item.label}" in project contexts.`
      : `No reference to "${item.label}" found in current project contexts.`;
  }

  return {
    checked: detected,
    scanResultNote: note,
    scannedAt: "Just now",
  };
}

export function buildContextualAiResponse(
  project: CryptoProject,
  userPrompt: string,
  activeContexts: ProjectContextItem[],
  template?: PromptTemplate
): string {
  const websiteCtx = activeContexts.find((c) => c.type === "website");
  const xCtx = activeContexts.find((c) => c.type === "x_handle");
  const linkedinCtx = activeContexts.find((c) => c.type === "linkedin");
  const noteCtx = activeContexts.find((c) => c.type === "message");
  const statusMeta = BUSINESS_STATUS_META[project.businessStatus];

  const scrapedSignals = Array.from(
    new Set(
      activeContexts.flatMap((c) => c.scrapedMetadata?.signals ?? [])
    )
  );
  const scrapedInsight = activeContexts
    .map((c) => c.scrapedMetadata?.description || c.summary)
    .find(Boolean);

  const lower =
    `${userPrompt} ${template?.label || ""} ${template?.systemPrompt || ""}`.toLowerCase();

  const systemInstructionHeader = template
    ? `> **Applied System Prompt (${template.label}):** ${template.systemPrompt}\n\n`
    : "";

  const signalLine =
    scrapedSignals.length > 0
      ? `\n- **Scraped Technical Signals:** ${scrapedSignals.map((s) => `\`${s}\``).join(", ")}`
      : "";

  if (lower.includes("4-tweet") || lower.includes("thread")) {
    return `${systemInstructionHeader}### 4-Tweet X Thread — ${project.name} (${project.ticker})
- **1/4:** ${project.name} (${project.ticker}) is scaling on ${project.chain}: ${project.tagline}.
- **2/4:** Grounded in our latest positioning${linkedinCtx ? ` (\`${linkedinCtx.value}\`)` : ""}: ${noteCtx?.value || scrapedInsight || "built for institutional-grade execution and verifiable throughput."}
- **3/4:** Follow ${xCtx ? `\`${xCtx.value}\`` : project.ticker} as we progress through our **${project.stage}** phase.
- **4/4:** Explore the docs and live metrics at \`${websiteCtx?.value || "our official portal"}\`.${signalLine}`;
  }

  if (lower.includes("market maker") || lower.includes("cold dm")) {
    return `${systemInstructionHeader}### Institutional Market Maker Cold DM — ${project.name} (${project.ticker})
"Hi [Name] — reaching out from the **${project.name} (${project.ticker})** team on ${project.chain}.

${project.tagline}. ${noteCtx?.value || scrapedInsight || ""}

We are currently in **${project.stage}** (${statusMeta.label}) and onboarding institutional liquidity partners. Full documentation is live at \`${websiteCtx?.value || "our portal"}\`${linkedinCtx ? ` and \`${linkedinCtx.value}\`` : ""}. Open to sharing our liquidity brief this week?"${signalLine}`;
  }

  if (lower.includes("founder quote") || lower.includes("executive")) {
    return `${systemInstructionHeader}### Executive Founder Quote — ${project.name} (${project.ticker})
> "${project.name} was engineered on ${project.chain} to solve a fundamental gap: ${project.tagline.toLowerCase()}. ${noteCtx?.value || scrapedInsight || "Our focus is delivering verifiable utility and deep ecosystem composability."}"
> — **Founder, ${project.name} (${project.ticker})**${signalLine}`;
  }

  return `${systemInstructionHeader}### ${project.name} (${project.ticker}) — Campaign Output
Synthesized from **${activeContexts.length} active contexts** (${activeContexts.map((c) => c.title).join(", ") || "Project Profile"}):

- **X / Social (${xCtx?.value || project.ticker}):** "${project.name} (${project.ticker}) on ${project.chain} — ${project.tagline}."
- **Key Context Directive:** ${noteCtx?.value || scrapedInsight || "Emphasize core product traction and verifiable metrics."}
- **Primary Link:** \`${websiteCtx?.value || linkedinCtx?.value || "N/A"}\`${signalLine}`;
}
