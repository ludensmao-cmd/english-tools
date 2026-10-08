import { backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import { lstat, mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { canonicalPath, inside, loadConfig } from './config.mjs';
import { openStore } from './database.mjs';
import { acquireDataLock } from './lock.mjs';

const filename = /^[0-9a-f-]{36}$/;
async function hashFile(path) { const hash = createHash('sha256'); const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) throw Error('В резервной копии недопустимый файл'); for await (const chunk of createReadStream(path)) hash.update(chunk); return { size: info.size, sha256: hash.digest('hex') }; }
async function newDestination(path, source) {
  const destination = canonicalPath(path);
  if (inside(destination, loadConfig().publicDir) || inside(destination, source) || inside(source, destination)) throw Error('Выберите новую папку вне публичных файлов и исходных данных');
  try { await lstat(destination); const error = new Error('Папка назначения уже существует'); error.code = 'DESTINATION_EXISTS'; throw error; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return destination;
}
async function makeDestination(destination) { await mkdir(dirname(destination), { recursive: true, mode: 0o700 }); try { await mkdir(destination, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') { error.code = 'DESTINATION_EXISTS'; error.message = 'Папка назначения уже существует'; } throw error; } }
function linkedRows(db) { return db.prepare('SELECT id,storage_name,size FROM attachments WHERE assignment_id IS NOT NULL OR submission_id IS NOT NULL OR lesson_id IS NOT NULL').all(); }
export async function createBackup({ dataDir, destination }) {
  dataDir = canonicalPath(dataDir); destination = await newDestination(destination, dataDir);
  const release = acquireDataLock(dataDir); let store, snapshot;
  try {
    store = openStore(dataDir, { readOnly: true });
    const rows = linkedRows(store.db);
    // Verify all required bytes before creating a directory that might look usable.
    const originals = [];
    for (const row of rows) {
      if (!filename.test(row.storage_name)) throw Error('Недопустимое имя вложения');
      let info; try { info = await hashFile(join(dataDir, 'uploads', row.storage_name)); } catch { throw Error('Не найдено или повреждено вложение. Резервная копия не создана'); }
      if (info.size !== row.size) throw Error('Повреждён файл вложения'); originals.push({ row, ...info });
    }
    await makeDestination(destination); await backup(store.db, join(destination, 'classroom.sqlite'));
    snapshot = openStore(destination);
    snapshot.db.prepare('DELETE FROM attachments WHERE assignment_id IS NULL AND submission_id IS NULL AND lesson_id IS NULL').run();
    snapshot.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); snapshot.close(); snapshot = null;
    const files = [{ path: 'classroom.sqlite', ...(await hashFile(join(destination, 'classroom.sqlite'))) }];
    await mkdir(join(destination, 'uploads'), { mode: 0o700 });
    for (const original of originals) { const path = 'uploads/' + original.row.storage_name; await copyFile(join(dataDir, path), join(destination, path), constants.COPYFILE_EXCL); await chmod(join(destination, path), 0o600); const verified = await hashFile(join(destination, path)); if (verified.size !== original.size || verified.sha256 !== original.sha256) throw Error('Файл изменился при копировании'); files.push({ path, ...verified }); }
    const manifestPath = join(destination, 'manifest.json'); await writeFile(manifestPath, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files }, null, 2), { flag: 'wx', mode: 0o600 });
    return { manifestPath };
  } finally { snapshot?.close(); store?.close(); release(); }
}
export async function restoreBackup({ source, destination }) {
  source = canonicalPath(source); destination = await newDestination(destination, source);
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length < 1) throw Error('Неверный состав резервной копии');
  const paths = new Set();
  for (const item of manifest.files) {
    if (typeof item.path !== 'string' || !(item.path === 'classroom.sqlite' || /^uploads\/[0-9a-f-]{36}$/.test(item.path)) || paths.has(item.path) || !Number.isSafeInteger(item.size) || item.size < 0 || !/^[0-9a-f]{64}$/.test(item.sha256)) throw Error('Недопустимый путь или состав резервной копии');
    paths.add(item.path); const actual = await hashFile(join(source, item.path)); if (actual.size !== item.size || actual.sha256 !== item.sha256) throw Error('Резервная копия повреждена: контрольная сумма не совпала');
  }
  if (!paths.has('classroom.sqlite')) throw Error('В составе копии отсутствует база');
  let verification;
  try { verification = openStore(source, { readOnly: true }); if (verification.db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || verification.db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Повреждена база резервной копии'); for (const row of linkedRows(verification.db)) { const file = manifest.files.find(file => file.path === 'uploads/' + row.storage_name); if (!file || file.size !== row.size) throw Error('В составе копии отсутствует нужное вложение'); } }
  finally { verification?.close(); }
  await makeDestination(destination); await mkdir(join(destination, 'uploads'), { mode: 0o700 });
  for (const item of manifest.files) { await copyFile(join(source, item.path), join(destination, item.path), constants.COPYFILE_EXCL); await chmod(join(destination, item.path), 0o600); }
  const restored = openStore(destination);
  try { restored.db.exec('DELETE FROM sessions; PRAGMA wal_checkpoint(TRUNCATE);'); } finally { restored.close(); }
}
