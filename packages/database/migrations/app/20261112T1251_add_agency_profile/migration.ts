#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3c7491912e1ca387c292446052c8a807c7a4bf99ac6f64fde1ded95fb6306a95/contract';
import endContract from '../../snapshots/3c7491912e1ca387c292446052c8a807c7a4bf99ac6f64fde1ded95fb6306a95/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/68047f13351ee0dc4a823d256f31689f4b5acfc934e4baf1fe144fee7a8577fa/contract';
import startContract from '../../snapshots/68047f13351ee0dc4a823d256f31689f4b5acfc934e4baf1fe144fee7a8577fa/contract.json' with { type: 'json' };
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
        table: 'agency_profiles',
        columns: [
          col('about_us', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('company_name', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('representative_email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('representative_name', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('representative_phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('representative_title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('services', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('social_links', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('tagline', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updated_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('website', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
