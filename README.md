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
