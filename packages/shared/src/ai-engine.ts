import type {
  ChecklistItemConfig,
  ContextType,
  CryptoProject,
  ProjectChecklistItemState,
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
  if (rawType === "lead") {
    if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("mailto:")) {
      return v;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return `mailto:${v}`;
    }
    if (v.includes("linkedin.com/")) {
      return `https://${v}`;
    }
    return undefined;
  }
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
