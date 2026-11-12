#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3c7491912e1ca387c292446052c8a807c7a4bf99ac6f64fde1ded95fb6306a95/contract';
import startContract from '../../snapshots/3c7491912e1ca387c292446052c8a807c7a4bf99ac6f64fde1ded95fb6306a95/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/953ef57992a84db36c25151766b219cfc18a199f5f7324f19f0b5bedf5a42e62/contract';
import endContract from '../../snapshots/953ef57992a84db36c25151766b219cfc18a199f5f7324f19f0b5bedf5a42e62/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'project_contexts',
        constraint: 'project_contexts_type_check_d42820d8',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'scrape_jobs',
        constraint: 'scrape_jobs_target_type_check_d8aa28ef',
      }),
      this.createTable({
        schema: 'public',
        table: 'lead_provider_configs',
        columns: [
          col('api_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
      this.addCheckConstraint({
        schema: 'public',
        table: 'project_contexts',
        constraint: 'project_contexts_type_check_e7ed2cba',
        expression: sql`"type" IN ('website', 'x_handle', 'linkedin', 'telegram', 'message', 'lead')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'scrape_jobs',
        constraint: 'scrape_jobs_target_type_check_b4a0a995',
        expression: sql`"target_type" IN ('website', 'x_handle', 'linkedin', 'telegram', 'message', 'lead')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
