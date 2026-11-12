#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/50ed379bd4cad41602b6d02a92274ebb5eb66f7ce3a52d8619c1116b35b000c3/contract';
import startContract from '../../snapshots/50ed379bd4cad41602b6d02a92274ebb5eb66f7ce3a52d8619c1116b35b000c3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b267b364a85bf1a983e8198268c566c0642aed3405598d394ffa0862c274acfd/contract';
import endContract from '../../snapshots/b267b364a85bf1a983e8198268c566c0642aed3405598d394ffa0862c274acfd/contract.json' with { type: 'json' };
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
        table: 'ai_provider_configs',
        columns: [
          col('api_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('extra_config', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('is_enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('selected_model', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updated_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['provider'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
