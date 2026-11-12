#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/12fdf4409b6d3ae12d8e0503e0bc189283b2b2ab3af89965175c3dd40dad2cb9/contract';
import startContract from '../../snapshots/12fdf4409b6d3ae12d8e0503e0bc189283b2b2ab3af89965175c3dd40dad2cb9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6801bdf4e036bc679e894f360a258dd13640c0a13b63c8ea91605b34c57aff0f/contract';
import endContract from '../../snapshots/6801bdf4e036bc679e894f360a258dd13640c0a13b63c8ea91605b34c57aff0f/contract.json' with { type: 'json' };
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

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'project_contexts',
        constraint: 'project_contexts_scrape_status_check_5ae745cd',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'scrape_jobs',
        constraint: 'scrape_jobs_status_check_819d5415',
      }),
      this.createTable({
        schema: 'public',
        table: 'scraped_pages',
        columns: [
          col('canonical_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('contacts', 'text[]', {
            notNull: true,
            default: fn(sql`'{}'::text[]`),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('content_type', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('context_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('depth', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('error_message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('headings', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('http_status', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('language', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('links', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('meta_tags', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('parent_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('platform_data', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('render_mode', 'text', {
            notNull: true,
            default: lit('playwright_js'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('scrape_job_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scraped_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('signals', 'text[]', {
            notNull: true,
            default: fn(sql`'{}'::text[]`),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('social_links', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('structured_data', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('text_content', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('word_count', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'scraped_pages_contacts_elem_not_null_b7b8d745',
            sql`array_position("contacts", NULL) IS NULL`,
          ),
          checkExpression(
            'scraped_pages_signals_elem_not_null_bd417bea',
            sql`array_position("signals", NULL) IS NULL`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'scraper_provider_configs',
        columns: [
          col('api_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('api_secret', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('extra_config', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('is_enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updated_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['provider'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'scrape_jobs',
        column: col('config', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'scrape_jobs',
        column: col('levels_scraped', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'scrape_jobs',
        column: col('pages_scraped', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'scrape_jobs',
        column: col('platform_data', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'scrape_jobs',
        column: col('provider_used', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'scrape_jobs',
        column: col('requires_api_key', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'project_contexts',
        constraint: 'project_contexts_scrape_status_check_05985b9d',
        expression: sql`"scrape_status" IN ('pending', 'running', 'completed', 'unreachable', 'failed', 'api_key_required')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'scrape_jobs',
        constraint: 'scrape_jobs_status_check_67d5b9aa',
        expression: sql`"status" IN ('pending', 'running', 'completed', 'unreachable', 'failed', 'api_key_required')`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'scraped_pages',
        index: 'scraped_pages_context_id_idx_0d3b2250',
        columns: ['context_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scraped_pages',
        index: 'scraped_pages_context_id_scraped_at_idx_2803cdad',
        columns: ['context_id', 'scraped_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scraped_pages',
        index: 'scraped_pages_project_id_idx_6ad92603',
        columns: ['project_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scraped_pages',
        index: 'scraped_pages_project_id_scraped_at_idx_33362faa',
        columns: ['project_id', 'scraped_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scraped_pages',
        index: 'scraped_pages_scrape_job_id_depth_idx_42001e3b',
        columns: ['scrape_job_id', 'depth'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scraped_pages',
        index: 'scraped_pages_scrape_job_id_idx_eacb5c9f',
        columns: ['scrape_job_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scraped_pages',
        foreignKey: {
          name: 'scraped_pages_project_id_fkey',
          columns: ['project_id'],
          references: { schema: 'public', table: 'projects', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scraped_pages',
        foreignKey: {
          name: 'scraped_pages_context_id_fkey',
          columns: ['context_id'],
          references: { schema: 'public', table: 'project_contexts', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scraped_pages',
        foreignKey: {
          name: 'scraped_pages_scrape_job_id_fkey',
          columns: ['scrape_job_id'],
          references: { schema: 'public', table: 'scrape_jobs', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
