import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function acquireDataLock(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, 'writer.lock');
  const content = JSON.stringify({ pid: process.pid, token: randomUUID() });
  for (let attempt = 0; attempt < 2; attempt++) {
    try { writeFileSync(path, content, { flag: 'wx', mode: 0o600 }); return () => { try { if (readFileSync(path, 'utf8') === content) unlinkSync(path); } catch (e) { if (e.code !== 'ENOENT') throw e; } }; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const old = readFileSync(path, 'utf8'); let entry; try { entry = JSON.parse(old); } catch { throw new Error('Папка используется: некорректная блокировка требует проверки владельцем'); }
      if (!Number.isInteger(entry.pid) || entry.pid <= 0) throw new Error('Папка используется: проверьте блокировку');
      try { process.kill(entry.pid, 0); throw new Error('Папка используется другим процессом. Сначала остановите сервер'); }
      catch (e) { if (e.code !== 'ESRCH') throw e; }
      if (readFileSync(path, 'utf8') !== old) throw new Error('Папка используется другим процессом');
      unlinkSync(path); // Only a verified dead process's unchanged lock is recovered.
    }
  }
  throw new Error('Папка используется другим процессом');
}
