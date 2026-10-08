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

export async function serviceFixture(t) {
  const { createClassroom } = await implementation('../../server/classroom/service.mjs');
  const { openStore } = await import('../../server/classroom/database.mjs');
  const { createAuth } = await import('../../server/classroom/auth.mjs');
  const dataDir = tempDataDir(t); const store = openStore(dataDir); t.after(() => store.close());
  const auth = createAuth(store); const service = createClassroom(store, { auth });
  const password = 'Учебный тестовый пароль!';
  const make = (username, role) => auth.createUser({ username, role, name: username, password, mustChangePassword: false });
  const teacher = await make('teacher', 'teacher'); const student = await make('student', 'student'); const otherStudent = await make('other_student', 'student');
  for (const person of [student, otherStudent]) store.db.prepare("INSERT INTO teacher_students VALUES(?,?,'A2',5)").run(teacher.id, person.id);
  const lesson = service.createLesson(teacher, { studentId: student.id, title: 'Разговор о поездке', startAt: '2026-10-20T14:00:00Z', durationMinutes: 60 });
  return { store, auth, service, teacher, student, otherStudent, lesson, dataDir, password };
}

export async function httpFixture(t) {
  const { createApp } = await implementation('../../server/classroom/http.mjs');
  const { createAttachments } = await implementation('../../server/classroom/attachments.mjs');
  const { loadConfig } = await import('../../server/classroom/config.mjs');
  const f = await serviceFixture(t); const config = loadConfig({ CLASSROOM_PORT: '0', CLASSROOM_DATA_DIR: f.dataDir });
  const attachments = createAttachments(f.store, config);
  const server = createApp({ config, store: f.store, auth: f.auth, classroom: f.service, attachments });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  config.origin = `http://127.0.0.1:${server.address().port}`;
  let stopped = false;
  const stop = async () => { if (!stopped) { stopped = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
  t.after(stop);
  const client = () => {
    let cookie = ''; let csrf = '';
    return { async request(path, { method = 'GET', input, headers = {}, body } = {}) {
      const response = await fetch(config.origin + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { Origin: config.origin, 'X-CSRF-Token': csrf } : {}), ...(input ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: input ? JSON.stringify(input) : body });
      const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
      return response;
    }, async login(username, password = f.password) { const response = await this.request('/api/auth/login', { method: 'POST', input: { username, password } }); const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); csrf = data.csrfToken; return response; } };
  };
  const teacher = client(); const student = client(); const otherStudent = client();
  await teacher.login('teacher'); await student.login('student'); await otherStudent.login('other_student');
  return { ...f, config, server, attachments, origin: config.origin, teacherActor: f.teacher, studentActor: f.student, otherStudentActor: f.otherStudent, teacher, student, otherStudent, anonymous: client(), stop };
}
