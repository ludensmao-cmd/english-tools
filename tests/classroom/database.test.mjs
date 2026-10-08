import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tempDataDir, implementation } from './helpers.mjs';

async function modules() {
  return { ...(await implementation('../../server/classroom/database.mjs')), ...(await implementation('../../server/classroom/config.mjs')) };
}
const insert = store => store.db.prepare("INSERT INTO users(id,role,name,username,password_hash,must_change_password) VALUES('u1','teacher','Учитель','teacher','hash',0)").run();
test('persists_after_reopen', async t => {
  const { openStore } = await modules(); const dir = tempDataDir(t);
  const store = openStore(dir); insert(store); store.close();
  const reopened = openStore(dir); t.after(() => reopened.close());
  assert.equal(reopened.db.prepare('SELECT name FROM users').get().name, 'Учитель');
});
test('rejects_broken_relationship', async t => {
  const { openStore } = await modules(); const store = openStore(tempDataDir(t)); t.after(() => store.close());
  assert.throws(() => store.db.prepare("INSERT INTO assignments(id,lesson_id,student_id,teacher_id,title,description) VALUES('a','missing','s','t','Task','Description')").run(), /FOREIGN KEY/);
});
test('rolls_back_partial_write', async t => {
  const { openStore } = await modules(); const store = openStore(tempDataDir(t)); t.after(() => store.close());
  assert.throws(() => store.transaction(() => { insert(store); throw new Error('stop'); }), /stop/);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
});
test('readonly_rejects_insert', async t => {
  const { openStore } = await modules(); const dir = tempDataDir(t); openStore(dir).close();
  const store = openStore(dir, { readOnly: true }); t.after(() => store.close()); assert.throws(() => insert(store), /readonly/);
});
test('rejects_public_data_dir', async () => {
  const { loadConfig } = await modules(); assert.throws(() => loadConfig({ CLASSROOM_DATA_DIR: join(process.cwd(), 'dist/private') }), /публич/);
});
