#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7c2739e41675145a84478ce29696593c25d574806938156430153b37a6061804/contract';
import endContract from '../../snapshots/7c2739e41675145a84478ce29696593c25d574806938156430153b37a6061804/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'chat_messages',
        columns: [
          col('applied_system_prompt_title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('model', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sender', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('suggested_actions', 'text[]', {
            notNull: true,
            default: fn(sql`'{}'::text[]`),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('timestamp_label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('used_context_ids', 'text[]', {
            notNull: true,
            default: fn(sql`'{}'::text[]`),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('chat_messages_sender_check_ce155c6b', sql`"sender" IN ('admin', 'ai')`),
          checkExpression(
            'chat_messages_suggested_actions_elem_not_null_18d476a1',
            sql`array_position("suggested_actions", NULL) IS NULL`,
          ),
          checkExpression(
            'chat_messages_used_context_ids_elem_not_null_515fa01a',
            sql`array_position("used_context_ids", NULL) IS NULL`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'checklist_items',
        columns: [
          col('category', 'text', {
            notNull: true,
            default: lit('general'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('is_required', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scan_prompt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sort_order', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'project_checklist_states',
        columns: [
          col('checked', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('checklist_item_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scan_result_note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('scanned_at_label', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'project_contexts',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('last_scraped_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scrape_status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('scraped_metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('summary', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updated_at_label', 'text', {
            notNull: true,
            default: lit('Now'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'project_contexts_scrape_status_check_5ae745cd',
            sql`"scrape_status" IN ('pending', 'running', 'completed', 'unreachable', 'failed')`,
          ),
          checkExpression(
            'project_contexts_type_check_d42820d8',
            sql`"type" IN ('website', 'x_handle', 'linkedin', 'telegram', 'message')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'projects',
        columns: [
          col('archived_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('avatar_bg', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('business_status', 'text', {
            notNull: true,
            default: lit('new'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('campaign_budget', 'text', {
            notNull: true,
            default: lit('$25,000 / mo'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('chain', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('is_pinned', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('last_activity_time', 'text', {
            notNull: true,
            default: lit('Now'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('last_scraped_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('logo_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentiment_score', 'int4', {
            notNull: true,
            default: lit(90),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('stage', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tagline', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tags', 'text[]', {
            notNull: true,
            default: fn(sql`'{}'::text[]`),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('ticker', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unread_insights', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'project_sentiment_bounds_67d2c989',
            sql`sentiment_score >= 0 AND sentiment_score <= 100`,
          ),
          checkExpression(
            'projects_business_status_check_dc9ae1b2',
            sql`"business_status" IN ('new', 'contacted', 'collaborated', 'completed', 'unresponsive', 'archived')`,
          ),
          checkExpression(
            'projects_stage_check_328d1089',
            sql`"stage" IN ('Pre-TGE', 'Mainnet Live', 'IDO / Launchpad', 'Ecosystem Growth', 'Stealth')`,
          ),
          checkExpression(
            'projects_tags_elem_not_null_aecbe9e2',
            sql`array_position("tags", NULL) IS NULL`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'prompt_templates',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('is_default', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sort_order', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('system_prompt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'scrape_jobs',
        columns: [
          col('attempt_count', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('completed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('context_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('detected_signals', 'text[]', {
            notNull: true,
            default: fn(sql`'{}'::text[]`),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('detected_socials', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('error_message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('extracted_description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('extracted_title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('http_status', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('normalized_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('raw_preview', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('target_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('target_value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'scrape_jobs_detected_signals_elem_not_null_ba0c7463',
            sql`array_position("detected_signals", NULL) IS NULL`,
          ),
          checkExpression(
            'scrape_jobs_status_check_819d5415',
            sql`"status" IN ('pending', 'running', 'completed', 'unreachable', 'failed')`,
          ),
          checkExpression(
            'scrape_jobs_target_type_check_d8aa28ef',
            sql`"target_type" IN ('website', 'x_handle', 'linkedin', 'telegram', 'message')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'project_checklist_states',
        constraint: 'project_checklist_states_project_id_checklist_item_id_key',
        columns: ['project_id', 'checklist_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_messages',
        index: 'chat_messages_project_id_created_at_idx_e997dbc7',
        columns: ['project_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_messages',
        index: 'chat_messages_project_id_idx_6ad92603',
        columns: ['project_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_messages',
        index: 'chat_messages_search_idx_a3775c5a',
        expression: sql`to_tsvector('english', "content")`,
        extras: { type: 'gin' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'checklist_items',
        index: 'checklist_items_category_idx_f2600f8e',
        columns: ['category'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'checklist_items',
        index: 'checklist_items_sort_order_idx_a1d4b1c1',
        columns: ['sort_order'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_checklist_states',
        index: 'project_checklist_states_checklist_item_id_idx_f85b1292',
        columns: ['checklist_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_checklist_states',
        index: 'project_checklist_states_project_id_idx_6ad92603',
        columns: ['project_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_contexts',
        index: 'project_contexts_project_id_created_at_idx_e997dbc7',
        columns: ['project_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_contexts',
        index: 'project_contexts_project_id_idx_6ad92603',
        columns: ['project_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_contexts',
        index: 'project_contexts_project_id_is_active_idx_4d0bb62f',
        columns: ['project_id', 'is_active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_contexts',
        index: 'project_contexts_scrape_status_idx_2d2c2564',
        columns: ['scrape_status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projects',
        index: 'projects_active_status_idx_fec3b999',
        columns: ['business_status'],
        extras: { where: sql`archived_at IS NULL` },
      }),
      this.createIndex({
        schema: 'public',
        table: 'projects',
        index: 'projects_business_status_idx_b424bdee',
        columns: ['business_status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projects',
        index: 'projects_is_pinned_created_at_idx_5d146632',
        columns: ['is_pinned', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projects',
        index: 'projects_search_idx_f746adb2',
        expression: sql`(setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("ticker", '')), 'A') || setweight(to_tsvector('english', coalesce("tagline", '')), 'B'))`,
        extras: { type: 'gin' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'projects',
        index: 'projects_updated_at_idx_48f706a1',
        columns: ['updated_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'prompt_templates',
        index: 'prompt_templates_sort_order_idx_a1d4b1c1',
        columns: ['sort_order'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scrape_jobs',
        index: 'scrape_jobs_context_id_idx_0d3b2250',
        columns: ['context_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scrape_jobs',
        index: 'scrape_jobs_project_id_created_at_idx_e997dbc7',
        columns: ['project_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scrape_jobs',
        index: 'scrape_jobs_project_id_idx_6ad92603',
        columns: ['project_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scrape_jobs',
        index: 'scrape_jobs_status_created_at_idx_1bbe8adf',
        columns: ['status', 'created_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chat_messages',
        foreignKey: {
          name: 'chat_messages_project_id_fkey',
          columns: ['project_id'],
          references: { schema: 'public', table: 'projects', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'project_checklist_states',
        foreignKey: {
          name: 'project_checklist_states_project_id_fkey',
          columns: ['project_id'],
          references: { schema: 'public', table: 'projects', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'project_checklist_states',
        foreignKey: {
          name: 'project_checklist_states_checklist_item_id_fkey',
          columns: ['checklist_item_id'],
          references: { schema: 'public', table: 'checklist_items', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'project_contexts',
        foreignKey: {
          name: 'project_contexts_project_id_fkey',
          columns: ['project_id'],
          references: { schema: 'public', table: 'projects', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scrape_jobs',
        foreignKey: {
          name: 'scrape_jobs_project_id_fkey',
          columns: ['project_id'],
          references: { schema: 'public', table: 'projects', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scrape_jobs',
        foreignKey: {
          name: 'scrape_jobs_context_id_fkey',
          columns: ['context_id'],
          references: { schema: 'public', table: 'project_contexts', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
