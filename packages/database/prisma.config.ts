import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../../.env"),
]) {
  if (fs.existsSync(candidate) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(candidate);
    } catch {
      // ignore if already loaded or invalid
    }
  }
}

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: process.env["DATABASE_URL"],
    },
    migrations: {
      dir: "./migrations",
    },
  }),
});
