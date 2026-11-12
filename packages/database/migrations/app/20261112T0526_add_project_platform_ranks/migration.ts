#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/50ed379bd4cad41602b6d02a92274ebb5eb66f7ce3a52d8619c1116b35b000c3/contract';
import endContract from '../../snapshots/50ed379bd4cad41602b6d02a92274ebb5eb66f7ce3a52d8619c1116b35b000c3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6801bdf4e036bc679e894f360a258dd13640c0a13b63c8ea91605b34c57aff0f/contract';
import startContract from '../../snapshots/6801bdf4e036bc679e894f360a258dd13640c0a13b63c8ea91605b34c57aff0f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'projects',
        column: col('platform_ranks', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
