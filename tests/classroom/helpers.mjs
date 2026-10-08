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
