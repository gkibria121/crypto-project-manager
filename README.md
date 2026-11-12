# PulseOS — Crypto Project Manager Microservices Monorepo

A Turborepo microservice platform for Web3 marketing & BD teams to manage crypto projects, enrich project contexts via web/social scraping, run feature checklists, and synthesize contextual AI campaigns.

## Architecture

```text
crypto-project-manager/
├── apps/
│   ├── web/              # Next.js 16 frontend + BFF proxy (/api/v1/*)
│   ├── api/              # NestJS Core Backend microservice (REST, Swagger, Prisma)
│   └── scraper/          # Python FastAPI web & social metadata scraper microservice
├── packages/
│   ├── database/         # Prisma schema, migrations, seed script, PostgreSQL client
│   ├── shared/           # Shared Zod schemas, TypeScript domain types, constants, helpers
│   └── typescript-config/# Shared strict tsconfig bases
├── docker-compose.yml    # Full production stack (PostgreSQL + migrations/seed + Scraper + API + Web)
├── docker-compose.dev.yml# Local PostgreSQL container for host development
└── turbo.json            # Turborepo task graph
```

### Microservice Communication

- **Frontend (`apps/web`, port `3000`)** serves the Messenger-style React 19 UI and exposes `/api/v1/[...path]` as a same-origin BFF proxy to the NestJS Core Backend (`API_INTERNAL_URL`).
- **Core Backend (`apps/api`, port `4000`)** owns domain business logic, PostgreSQL persistence via Prisma (`@repo/database`), Swagger OpenAPI docs (`/docs`), and orchestrates scraping jobs against the Python Scraper service (`SCRAPER_SERVICE_URL`).
- **Python Scraper (`apps/scraper`, port `8001` on host / `8000` in Docker)** extracts `<title>`, OpenGraph/meta descriptions, headings, social links, and Web3/AI technical signals (`mcp_server`, `telegram_bot`, `developer_sdk`, `onchain_analytics`, `audit`, etc.) with SSRF protection and internal service key authentication (`X-Internal-Service-Key`).
- **PostgreSQL (`postgres:16-alpine`, port `5432`)** stores `projects`, `project_contexts`, `chat_messages`, `prompt_templates`, `checklist_items`, `project_checklist_states`, and `scrape_jobs`.

## Quick Start with Docker Compose

1. Optionally copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Build and start all services (PostgreSQL, Prisma migration + seed, Python Scraper, NestJS Core API, Next.js Frontend):
   ```bash
   docker compose up --build -d
   ```
3. Access the platform:
   - **Frontend UI:** http://localhost:3000
   - **Core API Swagger Docs:** http://localhost:4000/docs
   - **Core API Health:** http://localhost:4000/health
   - **Python Scraper Docs:** http://localhost:8001/docs

## Local Development (Turborepo + Bun)

1. Install workspace dependencies and build shared packages:
   ```bash
   bun install
   bun run build
   ```
2. Setup the Python scraper virtual environment:
   ```bash
   bun run setup:scraper
   ```
3. Start PostgreSQL for development:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
4. Apply Prisma migrations and seed initial crypto projects:
   ```bash
   cp .env.example .env
   bun run db:migrate:deploy
   bun run db:seed
   ```
5. Start all microservices (`web`, `api`, `scraper`) in parallel via Turborepo:
   ```bash
   bun run dev
   ```

## Testing & Verification

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

## MCP Server, Lead Enrichment & Agency Context

PulseOS embeds a native **Model Context Protocol (MCP) Server** (`pulseos-workspace-mcp`) and supports external MCP servers configurable in **Global Settings → MCP Servers** or **Admin Dashboard → AI Providers**.

- **MCP Streamable HTTP Endpoint:** `POST /api/v1/mcp`
- **Live MCP Markdown Documentation:** `GET /api/v1/mcp/docs` (also exposed inside MCP as resource `pulseos://docs/mcp`)
- **MCP Project Context Resource:** `pulseos://projects/{projectId}/context`

### Built-in MCP Tools (9 Tools)

Every AI chat session discovers active MCP tools at the start of the conversation:

1. `get_company_context` — Target company overview + saved backend contexts (`website`, `x_handle`, `linkedin`, `telegram`, `message`, `lead`), including `leadsCount` and automatic reminder to call `fetch_project_leads` when leads have not been gathered manually.
2. `get_context_by_tag` — Resolves `@tags` (`@context`, `@linkedin`, `@x`, `@website`, `@telegram`, `@notes`, `@leads`, `@about-us`, or context title slugs).
3. `fetch_project_leads` — Automatically fetches target company decision-maker contacts (`type: "lead"`) and persists them into the right-side **Company Context** panel if no leads have been gathered manually yet (or when `forceRefresh: true`).
4. `get_scraped_data` — Reads stored `ScrapeJob` and multi-level `ScrapedPage` rows from PostgreSQL.
5. `scrape_context_link` — Runs the Python Scraper microservice on a saved project link and persists results.
6. `scrape_url` — Scrapes an arbitrary external URL via the Python Scraper microservice.
7. `list_project_checklist` — Reads due-diligence checklist states and scan notes.
8. `search_projects` — Searches workspace target companies by name, ticker, chain, or pipeline status.
9. `get_agency_profile` — Reads our agency's **About Us** company & representative profile.

### Chat `@Tag` Resolution

- `@context` — Full target company overview and saved contexts.
- `@linkedin`, `@x`, `@website`, `@telegram`, `@notes` — Platform-specific backend contexts and scraped pages.
- `@leads` (or `@contacts`) — Saved contact leads from the right-side panel; automatically calls `fetch_project_leads` if no leads exist yet.
- `@scrape` / `@scraped` — Live scraping via MCP or stored multi-level scraped pages.
- `@checklist` — Feature checklist scan results.
- `@about-us` — Our agency & representative identity.

### Agency Profile & Lead Providers

- **Agency Profile (`About Us`):** Configure our company details, address, representative contact info, and social links in **Dashboard → About Us**. Automatically injected into every chat as the outreach sender, with explicit separation from the prospective client project.
- **Fetch Leads (Context Panel):** Click **Fetch leads** in the right-side **Company Context** panel to configure encrypted provider API keys (`APOLLO_API_KEY`, `HUNTER_API_KEY`, `SNOV_API_KEY`, `LUSHA_API_KEY`) or run the built-in **Website & Social Scraper** (`website_scraper`) and save deduplicated contacts directly as `lead` items.

