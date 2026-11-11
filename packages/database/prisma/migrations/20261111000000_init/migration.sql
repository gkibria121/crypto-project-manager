-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContextType" AS ENUM ('website', 'x_handle', 'linkedin', 'telegram', 'message');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('PRE_TGE', 'MAINNET_LIVE', 'IDO_LAUNCHPAD', 'ECOSYSTEM_GROWTH', 'STEALTH');

-- CreateEnum
CREATE TYPE "ProjectBusinessStatus" AS ENUM ('new', 'contacted', 'collaborated', 'completed', 'unresponsive', 'archived');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('admin', 'ai');

-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('pending', 'running', 'completed', 'unreachable', 'failed');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "stage" "ProjectStage" NOT NULL,
    "business_status" "ProjectBusinessStatus" NOT NULL DEFAULT 'new',
    "avatar_bg" TEXT NOT NULL,
    "logo_url" TEXT,
    "tagline" TEXT NOT NULL DEFAULT '',
    "campaign_budget" TEXT NOT NULL DEFAULT '$25,000 / mo',
    "sentiment_score" INTEGER NOT NULL DEFAULT 90,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "unread_insights" INTEGER NOT NULL DEFAULT 0,
    "last_activity_time" TEXT NOT NULL DEFAULT 'Now',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contexts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ContextType" NOT NULL,
    "title" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at_label" TEXT NOT NULL DEFAULT 'Now',
    "scrape_status" "ScrapeStatus",
    "last_scraped_at" TIMESTAMP(3),
    "scraped_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp_label" TEXT NOT NULL,
    "used_context_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggested_actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applied_system_prompt_title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scan_prompt" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_checklist_states" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "scan_result_note" TEXT,
    "scanned_at_label" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_checklist_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "context_id" TEXT,
    "target_type" "ContextType" NOT NULL,
    "target_value" TEXT NOT NULL,
    "normalized_url" TEXT,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'pending',
    "extracted_title" TEXT,
    "extracted_description" TEXT,
    "detected_socials" JSONB,
    "detected_signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw_preview" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_business_status_idx" ON "projects"("business_status");

-- CreateIndex
CREATE INDEX "projects_updated_at_idx" ON "projects"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "project_contexts_project_id_created_at_idx" ON "project_contexts"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_project_id_created_at_idx" ON "chat_messages"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "prompt_templates_sort_order_idx" ON "prompt_templates"("sort_order");

-- CreateIndex
CREATE INDEX "checklist_items_sort_order_idx" ON "checklist_items"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "project_checklist_states_project_id_checklist_item_id_key" ON "project_checklist_states"("project_id", "checklist_item_id");

-- CreateIndex
CREATE INDEX "scrape_jobs_project_id_created_at_idx" ON "scrape_jobs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "scrape_jobs_context_id_idx" ON "scrape_jobs"("context_id");

-- AddForeignKey
ALTER TABLE "project_contexts" ADD CONSTRAINT "project_contexts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklist_states" ADD CONSTRAINT "project_checklist_states_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklist_states" ADD CONSTRAINT "project_checklist_states_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "project_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

