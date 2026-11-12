import type { McpServerStatus, McpToolSummary } from "@repo/shared";

const MAX_TOOL_SCHEMA_DEPTH = 8;

export function sanitizeJsonSchemaForGemini(
  schema: Record<string, unknown>,
  depth = 0
): Record<string, unknown> | undefined {
  if (depth > MAX_TOOL_SCHEMA_DEPTH || !schema || typeof schema !== "object") {
    return undefined;
  }

  const out: Record<string, unknown> = {};
  const rawType = schema["type"];

  if (Array.isArray(rawType)) {
    const nonNull = rawType.find((t) => t !== "null" && typeof t === "string");
    if (typeof nonNull === "string") {
      out["type"] = nonNull.toUpperCase();
    }
    if (rawType.includes("null")) {
      out["nullable"] = true;
    }
  } else if (typeof rawType === "string") {
    out["type"] = rawType.toUpperCase();
  }

  if (typeof schema["description"] === "string" && schema["description"]) {
    out["description"] = schema["description"];
  }

  if (Array.isArray(schema["enum"]) && schema["enum"].length > 0) {
    out["enum"] = schema["enum"].map((v) => String(v));
  }

  if (schema["items"] && typeof schema["items"] === "object") {
    const sanitizedItems = sanitizeJsonSchemaForGemini(
      schema["items"] as Record<string, unknown>,
      depth + 1
    );
    if (sanitizedItems) {
      out["items"] = sanitizedItems;
    }
  }

  if (schema["properties"] && typeof schema["properties"] === "object") {
    const rawProps = schema["properties"] as Record<string, unknown>;
    const cleanProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(rawProps)) {
      if (val && typeof val === "object") {
        const cleaned = sanitizeJsonSchemaForGemini(
          val as Record<string, unknown>,
          depth + 1
        );
        if (cleaned) {
          cleanProps[key] = cleaned;
        }
      }
    }
    if (Object.keys(cleanProps).length > 0) {
      out["properties"] = cleanProps;
    }
  }

  if (Array.isArray(schema["required"]) && out["properties"]) {
    const propKeys = new Set(
      Object.keys(out["properties"] as Record<string, unknown>)
    );
    const req = schema["required"].filter(
      (r): r is string => typeof r === "string" && propKeys.has(r)
    );
    if (req.length > 0) {
      out["required"] = req;
    }
  }

  if (!out["type"]) {
    out["type"] = out["properties"] ? "OBJECT" : "STRING";
  }

  return out;
}

export function toGeminiFunctionDeclaration(tool: McpToolSummary) {
  const sanitized = sanitizeJsonSchemaForGemini(tool.inputSchema);
  const hasProperties =
    sanitized &&
    typeof sanitized["properties"] === "object" &&
    Object.keys(sanitized["properties"] as Record<string, unknown>).length > 0;

  return {
    name: tool.qualifiedName,
    description:
      tool.description || `MCP tool "${tool.name}" from ${tool.serverName}`,
    ...(hasProperties ? { parameters: sanitized } : {}),
  };
}

export function toOpenAiToolDefinition(tool: McpToolSummary) {
  const parameters =
    tool.inputSchema && typeof tool.inputSchema === "object"
      ? {
          type: "object",
          properties:
            (tool.inputSchema["properties"] as Record<string, unknown>) ?? {},
          ...(Array.isArray(tool.inputSchema["required"])
            ? { required: tool.inputSchema["required"] }
            : {}),
        }
      : { type: "object", properties: {} };

  return {
    type: "function" as const,
    function: {
      name: tool.qualifiedName,
      description:
        tool.description || `MCP tool "${tool.name}" from ${tool.serverName}`,
      parameters,
    },
  };
}

export function toAnthropicToolDefinition(tool: McpToolSummary) {
  const inputSchema =
    tool.inputSchema && typeof tool.inputSchema === "object"
      ? {
          type: "object" as const,
          properties:
            (tool.inputSchema["properties"] as Record<string, unknown>) ?? {},
          ...(Array.isArray(tool.inputSchema["required"])
            ? { required: tool.inputSchema["required"] }
            : {}),
        }
      : { type: "object" as const, properties: {} };

  return {
    name: tool.qualifiedName,
    description:
      tool.description || `MCP tool "${tool.name}" from ${tool.serverName}`,
    input_schema: inputSchema,
  };
}

export function buildMcpSystemPromptSection(
  servers: McpServerStatus[],
  tools: McpToolSummary[]
): string {
  if (tools.length === 0) return "";

  const activeServers = servers
    .filter((s) => s.isEnabled && s.status === "connected")
    .map((s) => `- ${s.name} (${s.transport}, ${s.tools.length} tools)`)
    .join("\n");

  const toolLines = tools
    .map(
      (t) =>
        `- ${t.qualifiedName} [${t.serverName}]: ${t.description || "MCP tool"}`
    )
    .join("\n");

  return [
    "[Connected MCP Servers & Available Tools]",
    activeServers || "- PulseOS Workspace MCP",
    "",
    "Available MCP Tools:",
    toolLines,
    "",
    "MCP & Tag Rules:",
    "- You are integrated with the PulseOS MCP server(s) and Python Scraper microservice.",
    "- When the user mentions @context (target company context), @linkedin, @x, @website, @telegram, @notes, @leads, @scraped, or @checklist, or asks about the target company/project info, use the resolved context and call MCP tools (such as get_company_context, get_context_by_tag, get_scraped_data) if additional details are needed. Use get_agency_profile or @about-us for OUR agency's details.",
    "- Automatic Lead Gathering: If no contact leads (type: 'lead') have been gathered manually yet for the target company and the user asks for contacts, decision-makers, emails, outreach recipients, or personalized outreach to specific people at that company, call fetch_project_leads (with provider: 'auto') via MCP so the system gathers and saves contacts onto the right-side panel automatically.",
    "- Role Separation: Data returned by get_company_context / @context / @linkedin / @telegram / @leads belongs to the EXTERNAL TARGET / PROSPECTIVE CLIENT COMPANY we are pitching to win business from—never treat it as our agency's identity or put their handles into our signature.",
    "- When the user asks to scrape, fetch, or inspect a link/URL or asks for live page/social data, call scrape_context_link (for saved project links) or scrape_url (for any URL) via MCP.",
    "- Never invent scraped content or company facts—if a specialized scraper reports requiresApiKey=true (e.g., LINKEDIN_API_KEY or X_API_BEARER_TOKEN needed), clearly report both any already-saved backend summary and the exact key needed.",
  ].join("\n");
}

export function safeParseToolArguments(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function isToolUnsupportedError(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes("tool") &&
    (lower.includes("not support") ||
      lower.includes("unsupported") ||
      lower.includes("function calling") ||
      lower.includes("unknown field"))
  );
}
