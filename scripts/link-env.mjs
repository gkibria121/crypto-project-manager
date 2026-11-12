import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rootEnvPath = path.join(rootDir, ".env");
const rootEnvExamplePath = path.join(rootDir, ".env.example");

if (!fs.existsSync(rootEnvPath)) {
  if (fs.existsSync(rootEnvExamplePath)) {
    fs.copyFileSync(rootEnvExamplePath, rootEnvPath);
    console.log("Created root .env from .env.example");
  } else {
    console.error("Error: root .env does not exist.");
    process.exit(1);
  }
}

const targetDirs = [
  "apps/api",
  "apps/web",
  "apps/scraper",
  "packages/database",
];

for (const relDir of targetDirs) {
  const absDir = path.join(rootDir, relDir);
  if (!fs.existsSync(absDir)) continue;

  const targetEnv = path.join(absDir, ".env");
  const relativeSource = path.relative(absDir, rootEnvPath);

  try {
    if (fs.existsSync(targetEnv) || fs.lstatSync(targetEnv, { throwIfNoEntry: false })) {
      fs.unlinkSync(targetEnv);
    }
  } catch {
    // ignore if not found
  }

  try {
    fs.symlinkSync(relativeSource, targetEnv, "file");
    console.log(`Linked (symlink) ${relDir}/.env -> ${relativeSource}`);
  } catch {
    try {
      fs.linkSync(rootEnvPath, targetEnv);
      console.log(`Linked (hardlink) ${relDir}/.env <=> .env`);
    } catch {
      fs.copyFileSync(rootEnvPath, targetEnv);
      console.log(`Copied .env -> ${relDir}/.env`);
    }
  }
}
