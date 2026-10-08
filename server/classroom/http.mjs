import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { inside } from './config.mjs';
import { ClassroomError, invalid, missing } from './errors.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };
function json(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); res.end(JSON.stringify(value)); }
function sessionToken(req) { return (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('classroom_session='))?.slice(18); }
function readJson(req, max) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw invalid('Нужен JSON-запрос');
  if (Number(req.headers['content-length']) > max) { req.resume(); throw new ClassroomError(413, 'BODY_TOO_LARGE', 'Слишком большой запрос'); }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let failed = false;
    req.on('data', chunk => { size += chunk.length; if (size > max) { if (!failed) { failed = true; reject(new ClassroomError(413, 'BODY_TOO_LARGE', 'Слишком большой запрос')); } } else if (!failed) chunks.push(chunk); });
    req.on('end', () => { if (failed) return; try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); resolve(data); } catch { reject(invalid('Некорректный JSON')); } });
    req.on('error', reject); req.on('aborted', () => reject(invalid('Запрос прерван')));
  });
}
export function createApp({ config, auth, classroom, attachments }) {
  const cookie = (token, clear = false) => `classroom_session=${clear ? '' : token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : 28800}${config.origin.startsWith('https:') ? '; Secure' : ''}`;
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(config.origin).host) throw new ClassroomError(403, 'HOST_REJECTED', 'Недопустимый адрес');
      const url = new URL(req.url, config.origin); const path = url.pathname; const method = req.method;
      if (path.startsWith('/api/')) {
        if (method !== 'GET' && req.headers.origin !== config.origin) throw new ClassroomError(403, 'ORIGIN_REJECTED', 'Запрос со стороннего сайта запрещён');
        if (path === '/api/auth/login' && method === 'POST') { const input = await readJson(req, config.jsonBytes); const result = await auth.login({ ...input, ip: req.socket.remoteAddress }); return json(res, 200, { user: result.user, csrfToken: result.csrfToken }, { 'Set-Cookie': cookie(result.token) }); }
        const token = sessionToken(req); const session = auth.getSession(token);
        if (!session) throw new ClassroomError(401, 'SESSION_EXPIRED', 'Войдите в кабинет');
        if (method !== 'GET' && req.headers['x-csrf-token'] !== session.csrfToken) throw new ClassroomError(403, 'CSRF_REJECTED', 'Обновите вход и повторите действие');
        if (path === '/api/session' && method === 'GET') return json(res, 200, session);
        if (path === '/api/auth/logout' && method === 'POST') { auth.logout(token); return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', true) }); }
        if (path === '/api/auth/password' && method === 'POST') { await auth.changePassword(session.user, await readJson(req, config.jsonBytes)); return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', true) }); }
        if (session.user.mustChangePassword) throw new ClassroomError(403, 'PASSWORD_REQUIRED', 'Сначала смените временный пароль');
        const actor = session.user;
        if (path === '/api/classroom' && method === 'GET') return json(res, 200, classroom.dashboard(actor));
        if (path === '/api/attachments' && method === 'POST') {
          if (Number(req.headers['content-length']) > config.fileBytes) { req.resume(); throw new ClassroomError(413, 'FILE_TOO_LARGE', 'Файл должен быть не больше 20 МБ'); }
          let name; try { name = decodeURIComponent(req.headers['x-file-name'] || ''); } catch { throw invalid('Некорректное имя файла'); }
          const result = await attachments.receive(actor, { name, stream: req }); return json(res, 201, result);
        }
        let match;
        if ((match = /^\/api\/attachments\/([^/]+)$/.exec(path)) && method === 'GET') {
          const opened = attachments.open(actor, match[1], { preview: url.searchParams.get('preview') === '1' });
          opened.stream.once('open', () => { res.writeHead(200, opened.headers); opened.stream.pipe(res); });
          opened.stream.once('error', () => { if (!res.headersSent) json(res, 404, { error: { code: 'NOT_FOUND', message: 'Файл не найден' } }); else res.destroy(); });
          res.once('close', () => opened.stream.destroy()); return;
        }
        const key = req.headers['idempotency-key']; let result; let created = false;
        if (path === '/api/students' && method === 'POST') { result = await classroom.createStudent(actor, await readJson(req, config.jsonBytes)); created = true; }
        else if ((match = /^\/api\/students\/([^/]+)$/.exec(path)) && method === 'PATCH') result = classroom.updateStudent(actor, match[1], await readJson(req, config.jsonBytes));
        else if ((match = /^\/api\/students\/([^/]+)\/reset-password$/.exec(path)) && method === 'POST') result = await auth.resetStudentPassword(actor, match[1]);
        else if (path === '/api/lessons' && method === 'POST') { result = classroom.createLesson(actor, await readJson(req, config.jsonBytes)); created = true; }
        else if ((match = /^\/api\/lessons\/([^/]+)\/complete$/.exec(path)) && method === 'PATCH') result = classroom.completeLesson(actor, match[1], await readJson(req, config.jsonBytes));
        else if ((match = /^\/api\/lessons\/([^/]+)\/assignments$/.exec(path)) && method === 'POST') { result = classroom.assignHomework(actor, match[1], await readJson(req, config.jsonBytes), key); created = true; }
        else if ((match = /^\/api\/assignments\/([^/]+)\/submissions$/.exec(path)) && method === 'POST') { result = classroom.submitAnswer(actor, match[1], await readJson(req, config.jsonBytes), key); created = true; }
        else if ((match = /^\/api\/submissions\/([^/]+)\/feedback$/.exec(path)) && method === 'POST') { result = classroom.reviewAnswer(actor, match[1], await readJson(req, config.jsonBytes), key); created = true; }
        else throw missing();
        return json(res, created ? 201 : 200, result);
      }
      if (!['GET', 'HEAD'].includes(method)) throw missing();
      let decoded; try { decoded = decodeURIComponent(path); } catch { throw missing(); }
      if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(part => part.startsWith('.')) || decoded.startsWith('/var/') || decoded.startsWith('/backups/')) throw missing();
      if (/^\/lessons(?:\/(?:index\.html)?)?$/.test(decoded)) { const session = auth.getSession(sessionToken(req)); if (!session || session.user.mustChangePassword) { res.writeHead(303, { Location: '/lessons/login.html', 'Cache-Control': 'no-store' }); return res.end(); } }
      if (decoded === '/lessons') { res.writeHead(303, { Location: '/lessons/', 'Cache-Control': 'no-store' }); return res.end(); }
      let file = resolve(config.publicDir, '.' + decoded); if (!inside(file, config.publicDir)) throw missing();
      let info; try { info = await stat(file); if (info.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file); } file = await realpath(file); } catch { throw missing(); }
      if (!inside(file, config.publicDir) || !info.isFile() || !types[extname(file)]) throw missing();
      res.writeHead(200, { 'Content-Type': types[extname(file)], 'Content-Length': String(info.size), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' });
      if (method === 'HEAD') return res.end();
      const stream = createReadStream(file); stream.on('error', () => res.destroy()); res.once('close', () => stream.destroy()); stream.pipe(res);
    } catch (error) {
      if (!req.complete) req.resume();
      if (!res.headersSent && !res.destroyed) json(res, error instanceof ClassroomError ? error.status : 500, { error: { code: error instanceof ClassroomError ? error.code : 'INTERNAL_ERROR', message: error instanceof ClassroomError ? error.message : 'Не удалось сохранить данные. Повторите позже' } });
      else if (!res.destroyed) res.destroy();
    }
  });
  server.requestTimeout = 60_000; server.headersTimeout = 15_000;
  return server;
}
