import type {
  ChatMentionSuggestion,
  ContextType,
  CryptoProject,
  McpToolSummary,
} from "@repo/shared";

const TAG_TO_CONTEXT_TYPE: Record<string, ContextType> = {
  linkedin: "linkedin",
  li: "linkedin",
  x: "x_handle",
  twitter: "x_handle",
  x_handle: "x_handle",
  website: "website",
  site: "website",
  web: "website",
  docs: "website",
  telegram: "telegram",
  tg: "telegram",
  notes: "message",
  note: "message",
  brief: "message",
  message: "message",
  leads: "lead",
  lead: "lead",
  contacts: "lead",
  contact: "lead",
};

export function slugifyContextTag(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Extract @tag mentions from chat text while ignoring email addresses
 * such as hello@company.xyz.
 */
export function parseMentionTags(message: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  const regex = /(?:^|[\s(,;])@([a-zA-Z][a-zA-Z0-9_-]{0,63})/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(message)) !== null) {
    const raw = match[1]?.toLowerCase();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    tags.push(raw);
  }

  return tags;
}

export function mapTagToContextType(tag: string): ContextType | null {
  return TAG_TO_CONTEXT_TYPE[tag.toLowerCase()] ?? null;
}

export function buildProjectMentionSuggestions(
  project: CryptoProject,
  tools: McpToolSummary[]
): ChatMentionSuggestion[] {
  const suggestions: ChatMentionSuggestion[] = [];
  const contexts = project.contexts;

  const countByType = (type: ContextType) =>
    contexts.filter((c) => c.type === type);

  suggestions.push({
    tag: "@context",
    label: "Company Context",
    description: `Full ${project.name} (${project.ticker}) profile, all saved links & backend intelligence`,
    category: "company",
    availableCount: contexts.length,
    sampleValue: project.tagline || `${project.chain} · ${project.stage}`,
    isReady: true,
  });

  const platformSpecs: Array<{
    tag: string;
    label: string;
    type: ContextType;
    emptyDesc: string;
  }> = [
    {
      tag: "@linkedin",
      label: "LinkedIn",
      type: "linkedin",
      emptyDesc: "No LinkedIn context saved yet (backend can still scrape a URL)",
    },
    {
      tag: "@x",
      label: "X / Twitter",
      type: "x_handle",
      emptyDesc: "No X handle saved yet",
    },
    {
      tag: "@website",
      label: "Website & Docs",
      type: "website",
      emptyDesc: "No website link saved yet",
    },
    {
      tag: "@telegram",
      label: "Telegram",
      type: "telegram",
      emptyDesc: "No Telegram link saved yet",
    },
    {
      tag: "@notes",
      label: "Notes & Briefs",
      type: "message",
      emptyDesc: "No admin notes saved yet",
    },
    {
      tag: "@leads",
      label: "Target Leads & Contacts",
      type: "lead",
      emptyDesc:
        "No leads fetched manually yet — chatbot can auto-gather via MCP fetch_project_leads",
    },
  ];

  for (const spec of platformSpecs) {
    const matching = countByType(spec.type);
    suggestions.push({
      tag: spec.tag,
      label: spec.label,
      description:
        matching.length > 0
          ? matching.map((m) => m.value).join(" · ")
          : spec.emptyDesc,
      category: "platform",
      contextType: spec.type,
      availableCount: matching.length,
      sampleValue: matching[0]?.url ?? matching[0]?.value,
      isReady: matching.length > 0,
    });
  }

  const scrapedPagesCount = contexts.filter((c) => Boolean(c.lastScrapedAt)).length;
  suggestions.push({
    tag: "@scraped",
    label: "Scraped Data",
    description:
      scrapedPagesCount > 0
        ? `Fetch stored scraped pages & signals from ${scrapedPagesCount} source(s)`
        : "No scraped snapshots yet — combine with @scrape to crawl live",
    category: "company",
    availableCount: scrapedPagesCount,
    isReady: scrapedPagesCount > 0,
  });

  const checklistTotal = Object.keys(project.checklistState ?? {}).length;
  suggestions.push({
    tag: "@checklist",
    label: "Feature Checklist",
    description: "Project feature readiness & scan notes from backend",
    category: "company",
    availableCount: checklistTotal,
    isReady: true,
  });

  suggestions.push({
    tag: "@about-us",
    label: "Our Agency (About Us)",
    description:
      "Our agency profile, address, services, and representative details",
    category: "company",
    availableCount: 1,
    isReady: true,
  });

  suggestions.push({
    tag: "@scrape",
    label: "Scrape Links (MCP Tool)",
    description: `Trigger Python scraper via MCP tools (${tools.length} tools ready)`,
    category: "tool",
    availableCount: tools.length,
    isReady: tools.length > 0,
  });

  // Add individual project context items as direct @tags
  const usedTags = new Set(suggestions.map((s) => s.tag.toLowerCase()));
  for (const ctx of contexts) {
    const slug = slugifyContextTag(ctx.title);
    if (!slug) continue;
    const tag = `@${slug}`;
    if (usedTags.has(tag)) continue;
    usedTags.add(tag);

    suggestions.push({
      tag,
      label: ctx.title,
      description: ctx.summary ? `${ctx.value} — ${ctx.summary}` : ctx.value,
      category: "context_item",
      contextType: ctx.type,
      contextId: ctx.id,
      availableCount: 1,
      sampleValue: ctx.url ?? ctx.value,
      isReady: true,
    });
  }

  return suggestions;
}
