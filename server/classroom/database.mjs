import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

export function openStore(dataDir, { readOnly = false } = {}) {
  if (!readOnly) mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, 'classroom.sqlite');
  const db = new DatabaseSync(path, { readOnly });
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if (!readOnly) {
    chmodSync(path, 0o600);
    db.exec('PRAGMA journal_mode=WAL;');
    if (!db.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get()) {
      db.exec('BEGIN IMMEDIATE');
      try { db.exec(readFileSync(new URL('./migrations/001_classroom.sql', import.meta.url), 'utf8')); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
    }
  }
  let closed = false;
  return { db, dataDir, transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); if (result?.then) throw new Error('Транзакция должна быть синхронной'); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }, close() { if (!closed) { db.close(); closed = true; } } };
}
