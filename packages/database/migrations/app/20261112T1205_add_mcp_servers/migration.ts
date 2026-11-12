#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/68047f13351ee0dc4a823d256f31689f4b5acfc934e4baf1fe144fee7a8577fa/contract';
import endContract from '../../snapshots/68047f13351ee0dc4a823d256f31689f4b5acfc934e4baf1fe144fee7a8577fa/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b267b364a85bf1a983e8198268c566c0642aed3405598d394ffa0862c274acfd/contract';
import startContract from '../../snapshots/b267b364a85bf1a983e8198268c566c0642aed3405598d394ffa0862c274acfd/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
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
      this.createTable({
        schema: 'public',
        table: 'mcp_servers',
        columns: [
          col('auth_header', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('cached_tools', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('is_built_in', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('is_enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('last_error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('last_status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('last_sync_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('transport', 'text', {
            notNull: true,
            default: lit('streamable_http'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updated_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
