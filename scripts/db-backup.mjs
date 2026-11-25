#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
for (const f of [".env.local", ".env"]) {
  const p = path.join(cwd, f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
if (!url.startsWith("file:")) {
  console.error("db:backup currently supports local file databases only (file:...).");
  console.error(`Current TURSO_DATABASE_URL=${url}`);
  process.exit(1);
}

const dbPath = path.resolve(cwd, url.replace(/^file:/, ""));
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

const backupsDir = path.join(cwd, ".backups");
fs.mkdirSync(backupsDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupsDir, `project365-db-${ts}.db`);
fs.copyFileSync(dbPath, backupPath);
for (const suffix of ["-wal", "-shm"]) {
  const side = `${dbPath}${suffix}`;
  if (fs.existsSync(side)) fs.copyFileSync(side, `${backupPath}${suffix}`);
}
console.log(backupPath);
