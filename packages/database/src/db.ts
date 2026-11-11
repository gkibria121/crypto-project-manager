import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres, { type PostgresClient } from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import type { Contract } from "./prisma/contract.d.js";

const contractJsonPath = join(__dirname, "prisma", "contract.json");
const contractJson = JSON.parse(readFileSync(contractJsonPath, "utf8")) as unknown;

export const contract = contractFromJson<Contract>(contractJson);

export type PulseDbClient = PostgresClient<Contract>;

export function createDbClient(url?: string): PulseDbClient {
  return postgres({
    contract,
    url: url ?? process.env["DATABASE_URL"],
  });
}

const globalForDb = globalThis as unknown as {
  pulseDb?: PulseDbClient;
};

export const db: PulseDbClient =
  globalForDb.pulseDb ?? createDbClient(process.env["DATABASE_URL"]);

if (process.env["NODE_ENV"] !== "production") {
  globalForDb.pulseDb = db;
}
