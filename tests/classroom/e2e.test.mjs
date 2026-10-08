import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { serviceFixture, tempDataDir, implementation } from './helpers.mjs';

async function launch(t, dataDir) {
  const child = spawn(process.execPath, ['server/classroom/index.mjs'], { env: { ...process.env, CLASSROOM_DATA_DIR: dataDir, CLASSROOM_PORT: '0', CLASSROOM_ORIGIN: 'http://127.0.0.1:0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; });
  let stopped = false;
  const stop = async () => { if (!stopped && child.exitCode === null) { stopped = true; const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; } };
  t.after(stop);
  const origin = await new Promise((resolve, reject) => { const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(Error('Server did not start: ' + stderr)); }, 10000); child.stdout.on('data', bytes => { const match = /http:\/\/127\.0\.0\.1:\d+/.exec(bytes.toString()); if (match) { clearTimeout(timeout); resolve(match[0]); } }); child.once('exit', () => { clearTimeout(timeout); reject(Error('Server exited: ' + stderr)); }); child.once('error', reject); });
  const client = () => {
    let cookie = '', csrf = '';
    return { async request(path, method = 'GET', input, headers = {}, body) { const response = await fetch(origin + path, { method, headers: { Cookie: cookie, ...(method !== 'GET' ? { Origin: origin, 'X-CSRF-Token': csrf } : {}), ...(input ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: input ? JSON.stringify(input) : body }); if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]; return response; }, async login(username, password) { const r = await this.request('/api/auth/login', 'POST', { username, password }); assert.equal(r.status, 200); const value = await r.json(); csrf = value.csrfToken; }, async action(path, input) { const r = await this.request(path, 'POST', input, { 'Idempotency-Key': randomUUID() }); assert.ok(r.ok, JSON.stringify(await r.clone().json())); return r.json(); } };
  };
  return { origin, stop, client };
}
test('full_flow_after_restart_and_foreign_student_still_denied_after_restore', async t => {
  const { createBackup, restoreBackup } = await implementation('../../server/classroom/backup.mjs');
  const f = await serviceFixture(t); f.store.close();
  let app = await launch(t, f.dataDir); const teacher = app.client(), student = app.client(); await teacher.login('teacher', f.password); await student.login('student', f.password);
  const lesson = await teacher.action('/api/lessons', { studentId: f.student.id, title: 'Проверочный урок', startAt: '2026-11-01T12:00:00Z', durationMinutes: 45 });
  const document = Buffer.from('Test homework document'); const image = Buffer.from([137,80,78,71,13,10,26,10,1,2]);
  const upload = async (client, bytes, name) => { const r = await client.request('/api/attachments', 'POST', undefined, { 'X-File-Name': encodeURIComponent(name) }, bytes); assert.equal(r.status, 201); return r.json(); };
  const doc = await upload(teacher, document, 'задание.doc'); const img = await upload(teacher, image, 'пример.png');
  const assignment = await teacher.action('/api/lessons/' + lesson.id + '/assignments', { title: 'Три фразы', description: 'Повторите и используйте три фразы', attachmentIds: [doc.id, img.id] });
  const answerFile = await upload(student, document, 'ответ.doc'); const answer = await student.action('/api/assignments/' + assignment.id + '/submissions', { text: 'I have used these phrases.', attachmentIds: [answerFile.id] });
  await teacher.action('/api/submissions/' + answer.id + '/feedback', { text: 'Повтори эти три фразы' });
  await app.stop(); app = await launch(t, f.dataDir); const restartedStudent = app.client(); await restartedStudent.login('student', f.password);
  const dashboard = await (await restartedStudent.request('/api/classroom')).json(); assert.equal(dashboard.assignments[0].submission.feedback.text, 'Повтори эти три фразы'); assert.deepEqual(Buffer.from(await (await restartedStudent.request(answerFile.downloadUrl)).arrayBuffer()), document);
  await app.stop(); const parent = tempDataDir(t), destination = join(parent, 'backup'), restored = join(parent, 'restored'); await createBackup({ dataDir: f.dataDir, destination }); await restoreBackup({ source: destination, destination: restored });
  app = await launch(t, restored); const foreign = app.client(); await foreign.login('other_student', f.password); assert.equal((await foreign.request(answerFile.downloadUrl)).status, 404); const restoredStudent = app.client(); await restoredStudent.login('student', f.password); assert.deepEqual(Buffer.from(await (await restoredStudent.request(answerFile.downloadUrl)).arrayBuffer()), document); await app.stop();
});
