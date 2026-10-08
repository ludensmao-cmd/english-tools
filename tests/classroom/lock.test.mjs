import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempDataDir, implementation } from './helpers.mjs';
test('second_writer_is_rejected_until_release', async t => { const { acquireDataLock } = await implementation('../../server/classroom/lock.mjs'); const dir = tempDataDir(t); const release = acquireDataLock(dir); assert.throws(() => acquireDataLock(dir), /используется/); release(); const second = acquireDataLock(dir); second(); });
