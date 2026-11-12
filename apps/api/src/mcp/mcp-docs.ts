export const PULSEOS_MCP_DOCS_MARKDOWN = `# PulseOS Model Context Protocol (MCP) Documentation

## Overview
PulseOS embeds a native **MCP Server** (\`pulseos-workspace-mcp\`) over \`@modelcontextprotocol/sdk\` (JSON-RPC 2.0 / Streamable HTTP at \`POST /api/v1/mcp\`) and also supports external MCP servers configured in **Global Settings → MCP Servers** or **Admin Dashboard → AI Providers**.

Every AI chat session discovers all active MCP tools at the start of the conversation.

## Business Role Separation
- **Our Agency (About Us):** Configured in **Dashboard → About Us**. Always injected into every chat as the sender identity.
- **Target Project Workspaces:** Each project in the sidebar represents an external **prospective client company** that our agency wants to pitch and win projects from.

## Built-in MCP Tools
1. \`get_company_context\` — Fetches the target company overview and all saved backend contexts (\`website\`, \`x_handle\`, \`linkedin\`, \`telegram\`, \`message\`, \`lead\`). Reports \`leadsCount\` and reminds the agent to call \`fetch_project_leads\` if leads have not been gathered manually.
2. \`get_context_by_tag\` — Resolves chat \`@tags\` (\`@context\`, \`@linkedin\`, \`@x\`, \`@website\`, \`@telegram\`, \`@notes\`, \`@leads\`, \`@about-us\`, or context title slugs) against the backend and stored scraped pages.
3. \`fetch_project_leads\` — **Automatic & Manual Lead Gathering.** Checks whether contact leads (\`type: "lead"\`) already exist for the target project. If no leads have been fetched manually yet (or \`forceRefresh: true\`), gathers decision-maker contacts (emails, titles, LinkedIn URLs, phones) via the best configured provider (\`apollo\`, \`hunter\`, \`snov\`, \`lusha\`) or falls back to the built-in \`website_scraper\`, and saves them directly into the right-side Context Panel.
4. \`get_scraped_data\` — Retrieves relational \`ScrapeJob\` and multi-level \`ScrapedPage\` content stored in PostgreSQL.
5. \`scrape_context_link\` — Triggers the PulseOS Python Scraper microservice for saved project links and persists results to PostgreSQL.
6. \`scrape_url\` — Scrapes any external URL via the Python Scraper microservice.
7. \`list_project_checklist\` — Reads global due-diligence checklist items and scan notes for a project.
8. \`search_projects\` — Searches workspace projects by name, ticker, chain, or pipeline status.
9. \`get_agency_profile\` — Reads our agency's **About Us** company & representative profile.

## Chat \`@Tag\` Reference
- \`@context\` — Loads full target company overview and saved contexts.
- \`@linkedin\`, \`@x\`, \`@website\`, \`@telegram\`, \`@notes\` — Resolves platform-specific contexts and scraped data from the backend.
- \`@leads\` (or \`@contacts\`) — Loads saved contact leads from the right-side panel; if none have been fetched manually yet, triggers \`fetch_project_leads\` automatically.
- \`@scrape\` — Instructs the AI to run live scraping via MCP + Python Scraper.
- \`@scraped\` — Loads already-stored multi-level scraped pages.
- \`@checklist\` — Loads feature checklist scan status.
- \`@about-us\` — Loads our agency & representative profile.

## MCP Resources
- \`pulseos://projects/{projectId}/context\` — Target company profile & active contexts (JSON).
- \`pulseos://docs/mcp\` — This MCP tool, tag, and automatic lead-fetching specification (Markdown).
`;
