import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

export function tempDataDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'english-classroom-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
export async function implementation(path) {
  const module = await import(path).catch(() => null);
  assert.ok(module, `Implementation required: ${path}`);
  return module;
}
export function errorStatus(status) { return e => e.status === status; }
