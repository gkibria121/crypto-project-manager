#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/12fdf4409b6d3ae12d8e0503e0bc189283b2b2ab3af89965175c3dd40dad2cb9/contract';
import endContract from '../../snapshots/12fdf4409b6d3ae12d8e0503e0bc189283b2b2ab3af89965175c3dd40dad2cb9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/45cfb769bf44ea6cbbd7d310a4d2ac56d5c1c8056f14582e39df018900ecd0fa/contract';
import startContract from '../../snapshots/45cfb769bf44ea6cbbd7d310a4d2ac56d5c1c8056f14582e39df018900ecd0fa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'projects',
        constraint: 'projects_business_status_check_dc9ae1b2',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'projects',
        constraint: 'projects_business_status_check_42214c72',
        expression: sql`"business_status" IN ('new', 'active', 'contacted', 'collaborated', 'completed', 'unresponsive', 'archived')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
