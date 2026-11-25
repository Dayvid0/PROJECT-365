#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("Usage: node scripts/db-restore.mjs <backup-file>");
  process.exit(1);
}

const cwd = process.cwd();
for (const f of [".env.local", ".env"]) {
  const p = path.join(cwd, f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
if (!url.startsWith("file:")) {
  console.error("db:restore currently supports local file databases only (file:...).");
  process.exit(1);
}

const dbPath = path.resolve(cwd, url.replace(/^file:/, ""));
const src = path.resolve(cwd, backupPath);
if (!fs.existsSync(src)) {
  console.error(`Backup file not found: ${src}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.copyFileSync(src, dbPath);
for (const suffix of ["-wal", "-shm"]) {
  const side = `${src}${suffix}`;
  const dest = `${dbPath}${suffix}`;
  if (fs.existsSync(side)) fs.copyFileSync(side, dest);
  else if (fs.existsSync(dest)) fs.rmSync(dest);
}
console.log(`Restored ${src} -> ${dbPath}`);
