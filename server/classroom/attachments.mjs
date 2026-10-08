import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, unlink, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { ClassroomError, invalid, missing } from './errors.mjs';
import { createClassroom, attachmentDto } from './service.mjs';

function imageType(head) {
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (head.length >= 3 && head[0] === 255 && head[1] === 216 && head[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(head.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
function fileName(value) {
  if (typeof value !== 'string') throw invalid('Введите имя файла');
  const name = value.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!name || [...name].length > 200) throw invalid('Имя файла должно содержать от 1 до 200 символов');
  return name;
}
function encodedName(name) { return encodeURIComponent(name).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase()); }
export function createAttachments(store, config) {
  const dir = join(store.dataDir, 'uploads'); const access = createClassroom(store);
  return {
    async receive(actor, { name, stream }) {
      access.dashboard(actor); name = fileName(name);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const id = randomUUID(); const temporary = join(dir, id + '.part'); const target = join(dir, id);
      let handle; let size = 0; let head = Buffer.alloc(0);
      try {
        handle = await open(temporary, 'wx', 0o600);
        const iterator = stream.iterator ? stream.iterator({ destroyOnReturn: false }) : stream;
        for await (const chunk of iterator) {
          const bytes = Buffer.from(chunk); size += bytes.length;
          if (size > config.fileBytes) throw new ClassroomError(413, 'FILE_TOO_LARGE', 'Файл должен быть не больше 20 МБ');
          if (head.length < 32) head = Buffer.concat([head, bytes.subarray(0, 32 - head.length)]);
          await handle.writeFile(bytes);
        }
        if (stream.aborted || stream.complete === false) throw invalid('Загрузка прервана. Попробуйте снова');
        await handle.sync(); await handle.close(); handle = null; await rename(temporary, target);
        const type = imageType(head);
        store.transaction(() => { access.dashboard(actor); store.db.prepare('INSERT INTO attachments(id,owner_id,name,storage_name,size,content_type,previewable,status,created_at) VALUES(?,?,?,?,?,?,?,\'accepted\',?)').run(id, actor.id, name, id, size, type || 'application/octet-stream', Number(Boolean(type)), Date.now()); });
        return attachmentDto(store.db.prepare('SELECT * FROM attachments WHERE id=?').get(id));
      } catch (error) { await handle?.close().catch(() => {}); await Promise.all([temporary, target].map(path => unlink(path).catch(e => { if (e.code !== 'ENOENT') throw e; }))); throw error; }
    },
    open(actor, id, { preview = false } = {}) {
      const row = access.resolveAttachmentAccess(actor, id);
      if (!/^[0-9a-f-]{36}$/.test(row.storage_name)) throw missing();
      const inline = preview && Boolean(row.previewable);
      return { stream: createReadStream(join(dir, row.storage_name)), headers: { 'Content-Type': inline ? row.content_type : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="attachment"; filename*=UTF-8''${encodedName(row.name)}`, 'Content-Length': String(row.size), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox; default-src 'none'" } };
    },
    async cleanupUnlinked({ olderThan = Date.now() - 86_400_000 } = {}) {
      const cutoff = Math.min(olderThan, Date.now() - 86_400_000); let count = 0;
      const rows = store.db.prepare('SELECT id,storage_name FROM attachments WHERE assignment_id IS NULL AND submission_id IS NULL AND lesson_id IS NULL AND created_at<?').all(cutoff);
      for (const row of rows) { if (!/^[0-9a-f-]{36}$/.test(row.storage_name)) continue; await unlink(join(dir, row.storage_name)).catch(e => { if (e.code !== 'ENOENT') throw e; }); store.db.prepare('DELETE FROM attachments WHERE id=? AND assignment_id IS NULL AND submission_id IS NULL AND lesson_id IS NULL').run(row.id); count++; }
      for (const name of await readdir(dir).catch(e => { if (e.code === 'ENOENT') return []; throw e; })) {
        if (/^[0-9a-f-]{36}(?:\.part)?$/.test(name) && !(store.db.prepare('SELECT id FROM attachments WHERE storage_name=?').get(name))) { const info = await stat(join(dir, name)); if (info.mtimeMs < cutoff) { await unlink(join(dir, name)); count++; } }
      }
      return count;
    }
  };
}
