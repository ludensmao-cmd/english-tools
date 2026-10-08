import { randomUUID, createHash } from 'node:crypto';
import { safeUser } from './auth.mjs';
import { ClassroomError, invalid, missing, forbidden } from './errors.mjs';

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const chars = value => [...value].length;
function text(value, label, min = 1, max = 20_000) {
  if (typeof value !== 'string' || chars(value.trim()) < min || chars(value.trim()) > max) throw invalid(`${label}: от ${min} до ${max} символов`);
  return value.trim();
}
export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw invalid('Дата должна содержать время и часовой пояс');
  const [year, month, day, hour, minute, second] = value.match(/\d+/g).slice(0, 6).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59 || !Number.isFinite(Date.parse(value))) throw invalid('Проверьте дату');
  return new Date(value).toISOString();
}
export function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw invalid('Проверьте ссылку');
  let url; try { url = new URL(value); } catch { throw invalid('Проверьте ссылку'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw invalid('Разрешены ссылки http и https без пароля');
  return url.href;
}
export const attachmentDto = row => ({ id: row.id, name: row.name, size: row.size, contentType: row.content_type, previewable: Boolean(row.previewable), downloadUrl: `/api/attachments/${row.id}` });

export function createClassroom(store, { auth, now = Date.now } = {}) {
  const { db } = store;
  const timestamp = () => new Date(now()).toISOString();
  function actorRow(actor, role) {
    const row = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(actor?.id);
    if (!row || row.role !== actor.role || (role && row.role !== role)) throw forbidden();
    if (row.must_change_password) throw new ClassroomError(403, 'PASSWORD_REQUIRED', 'Сначала смените временный пароль');
    return row;
  }
  function studentRow(actor, id) {
    const row = db.prepare('SELECT u.*,ts.level,ts.remaining_lessons FROM teacher_students ts JOIN users u ON u.id=ts.student_id WHERE ts.teacher_id=? AND ts.student_id=?').get(actor.id, id);
    if (!row) throw missing(); return row;
  }
  const studentDto = row => ({ id: row.id, name: row.name, username: row.username, level: row.level, remainingLessons: row.remaining_lessons });
  function lessonRow(actor, id) {
    const row = db.prepare('SELECT * FROM lessons WHERE id=?').get(id);
    if (!row || (actor.role === 'student' ? row.student_id !== actor.id : row.teacher_id !== actor.id)) throw missing();
    return row;
  }
  function assignmentRow(actor, id) {
    const row = db.prepare('SELECT * FROM assignments WHERE id=?').get(id);
    if (!row || (actor.role === 'student' ? row.student_id !== actor.id : row.teacher_id !== actor.id)) throw missing(); return row;
  }
  function checkStudentInfo({ level, remainingLessons }) {
    if (!levels.includes(level) || !Number.isSafeInteger(remainingLessons) || remainingLessons < 0) throw invalid('Проверьте уровень и остаток занятий');
  }
  function attachments(field, id) { return db.prepare(`SELECT * FROM attachments WHERE ${field}=? ORDER BY created_at,id`).all(id).map(attachmentDto); }
  function lessonDto(row) {
    return { id: row.id, studentId: row.student_id, title: row.title, startAt: row.start_at, durationMinutes: row.duration_minutes, status: row.status, summary: row.summary,
      vocabulary: db.prepare('SELECT word,meaning,example FROM lesson_words WHERE lesson_id=? ORDER BY position').all(row.id).map(v => ({ ...v })),
      materials: db.prepare('SELECT title,url,attachment_id FROM lesson_materials WHERE lesson_id=? ORDER BY position').all(row.id).map(m => ({ title: m.title, url: m.url, attachmentId: m.attachment_id })) };
  }
  function feedbackDto(row) { return row ? { text: row.text, reviewedAt: row.reviewed_at } : null; }
  function submissionDto(row) { return { id: row.id, assignmentId: row.assignment_id, text: row.text, attachments: attachments('submission_id', row.id), submittedAt: row.submitted_at, feedback: feedbackDto(db.prepare('SELECT * FROM feedback WHERE submission_id=?').get(row.id)) }; }
  function assignmentDto(row) { const submission = db.prepare('SELECT * FROM submissions WHERE assignment_id=?').get(row.id); return { id: row.id, lessonId: row.lesson_id, studentId: row.student_id, title: row.title, description: row.description, dueAt: row.due_at, attachments: attachments('assignment_id', row.id), submission: submission ? submissionDto(submission) : null }; }
  function audit(actor, action, target) { db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').run(randomUUID(), actor.id, action, target, timestamp()); }
  function fileIds(value = []) { if (!Array.isArray(value) || value.some(id => typeof id !== 'string') || new Set(value).size !== value.length) throw invalid('Проверьте список файлов'); return value; }
  function bindFiles(actor, ids, field, id) {
    if (ids.length > 10) throw new ClassroomError(413, 'FILES_LIMIT', 'Не больше 10 файлов');
    const rows = ids.map(id => { const row = db.prepare('SELECT * FROM attachments WHERE id=? AND owner_id=? AND status=\'accepted\'').get(id, actor.id); if (!row || ((row.assignment_id || row.submission_id || row.lesson_id) && row[field] !== id)) throw missing(); return row; });
    if (rows.some(row => row.size > 20_000_000) || rows.reduce((sum, row) => sum + row.size, 0) > 50_000_000) throw new ClassroomError(413, 'FILES_LIMIT', 'Размер файлов превышает 50 МБ или 20 МБ на файл');
    for (const row of rows) db.prepare(`UPDATE attachments SET ${field}=? WHERE id=?`).run(id, row.id);
  }
  function operation(actor, kind, key, body, fn) {
    if (typeof key !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(key)) throw invalid('Нужен идентификатор операции');
    const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    return store.transaction(() => {
      const previous = db.prepare('SELECT * FROM operations WHERE actor_id=? AND operation_id=?').get(actor.id, key);
      if (previous) { if (previous.kind !== kind || previous.body_hash !== fingerprint) throw new ClassroomError(409, 'OPERATION_CONFLICT', 'Эта операция уже выполнена с другим содержимым'); return JSON.parse(previous.result); }
      const result = fn(); db.prepare('INSERT INTO operations VALUES(?,?,?,?,?)').run(actor.id, key, kind, fingerprint, JSON.stringify(result)); return result;
    });
  }
  const service = {
    async createStudent(actor, input) {
      actorRow(actor, 'teacher'); checkStudentInfo(input);
      const temporaryPassword = auth.generateTemporaryPassword();
      const prepared = await auth.prepareUser({ role: 'student', name: input.name, username: input.username, password: temporaryPassword, mustChangePassword: true });
      const student = store.transaction(() => { actorRow(actor, 'teacher'); auth.insertPreparedUser(prepared); db.prepare('INSERT INTO teacher_students VALUES(?,?,?,?)').run(actor.id, prepared.id, input.level, input.remainingLessons); audit(actor, 'student_assigned', prepared.id); return studentDto(studentRow(actor, prepared.id)); });
      return { student, temporaryPassword };
    },
    updateStudent(actor, id, input) { actorRow(actor, 'teacher'); studentRow(actor, id); checkStudentInfo(input); return store.transaction(() => { db.prepare('UPDATE teacher_students SET level=?,remaining_lessons=? WHERE teacher_id=? AND student_id=?').run(input.level, input.remainingLessons, actor.id, id); audit(actor, 'student_updated', id); return studentDto(studentRow(actor, id)); }); },
    createLesson(actor, input) { actorRow(actor, 'teacher'); studentRow(actor, input.studentId); const title = text(input.title, 'Тема урока', 1, 120); const startAt = isoDate(input.startAt); if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 240) throw invalid('Продолжительность: от 1 до 240 минут'); return store.transaction(() => { const id = randomUUID(); db.prepare('INSERT INTO lessons(id,teacher_id,student_id,title,start_at,duration_minutes) VALUES(?,?,?,?,?,?)').run(id, actor.id, input.studentId, title, startAt, input.durationMinutes); audit(actor, 'lesson_created', id); return lessonDto(lessonRow(actor, id)); }); },
    completeLesson(actor, id, input) {
      actorRow(actor, 'teacher'); lessonRow(actor, id); const summary = text(input.summary || '', 'Саммари', 0);
      if (!Array.isArray(input.vocabulary) || input.vocabulary.length > 200 || !Array.isArray(input.materials) || input.materials.length > 100) throw invalid('Проверьте слова и материалы');
      const vocabulary = input.vocabulary.map(v => ({ word: text(v.word, 'Слово', 1, 200), meaning: text(v.meaning, 'Значение', 1, 1000), example: text(v.example || '', 'Пример', 0, 2000) }));
      const materials = input.materials.map(m => { if (!!m.url === !!m.attachmentId) throw invalid('Материалу нужна ссылка или файл'); return { title: text(m.title, 'Материал', 1, 200), url: m.url ? safeUrl(m.url) : null, attachmentId: m.attachmentId ? text(m.attachmentId, 'Файл', 1, 100) : null }; });
      return store.transaction(() => { db.prepare('DELETE FROM lesson_words WHERE lesson_id=?').run(id); db.prepare('DELETE FROM lesson_materials WHERE lesson_id=?').run(id); db.prepare('UPDATE attachments SET lesson_id=NULL WHERE lesson_id=?').run(id); bindFiles(actor, fileIds(materials.filter(m => m.attachmentId).map(m => m.attachmentId)), 'lesson_id', id); db.prepare("UPDATE lessons SET status='completed',summary=? WHERE id=?").run(summary, id); vocabulary.forEach((v, i) => db.prepare('INSERT INTO lesson_words VALUES(?,?,?,?,?,?)').run(randomUUID(), id, i, v.word, v.meaning, v.example)); materials.forEach((m, i) => db.prepare('INSERT INTO lesson_materials VALUES(?,?,?,?,?,?)').run(randomUUID(), id, i, m.title, m.url, m.attachmentId)); audit(actor, 'lesson_completed', id); return lessonDto(lessonRow(actor, id)); });
    },
    assignHomework(actor, lessonId, input, operationId) { actorRow(actor, 'teacher'); const lesson = lessonRow(actor, lessonId); const normalized = { lessonId, title: text(input.title, 'Название задания', 1, 80), description: text(input.description, 'Описание задания', 8), dueAt: input.dueAt ? isoDate(input.dueAt) : null, attachmentIds: fileIds(input.attachmentIds) }; return operation(actor, 'assignment', operationId, normalized, () => { const id = randomUUID(); db.prepare('INSERT INTO assignments(id,lesson_id,student_id,teacher_id,title,description,due_at) VALUES(?,?,?,?,?,?,?)').run(id, lessonId, lesson.student_id, actor.id, normalized.title, normalized.description, normalized.dueAt); bindFiles(actor, normalized.attachmentIds, 'assignment_id', id); audit(actor, 'homework_assigned', id); return assignmentDto(assignmentRow(actor, id)); }); },
    submitAnswer(actor, assignmentId, input, operationId) { actorRow(actor, 'student'); assignmentRow(actor, assignmentId); const normalized = { assignmentId, text: text(input.text ?? '', 'Ответ', 0), attachmentIds: fileIds(input.attachmentIds) }; if (!normalized.text && !normalized.attachmentIds.length) throw invalid('Добавьте текст или файл'); return operation(actor, 'submission', operationId, normalized, () => { if (db.prepare('SELECT id FROM submissions WHERE assignment_id=?').get(assignmentId)) throw new ClassroomError(409, 'ANSWER_EXISTS', 'Ответ на это задание уже отправлен'); const id = randomUUID(); db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?)').run(id, assignmentId, actor.id, normalized.text, timestamp()); bindFiles(actor, normalized.attachmentIds, 'submission_id', id); audit(actor, 'answer_submitted', id); return submissionDto(db.prepare('SELECT * FROM submissions WHERE id=?').get(id)); }); },
    reviewAnswer(actor, submissionId, input, operationId) { actorRow(actor, 'teacher'); const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(submissionId); if (!submission) throw missing(); assignmentRow(actor, submission.assignment_id); const normalized = { submissionId, text: text(input.text, 'Отзыв', 8) }; return operation(actor, 'feedback', operationId, normalized, () => { if (db.prepare('SELECT submission_id FROM feedback WHERE submission_id=?').get(submissionId)) throw new ClassroomError(409, 'FEEDBACK_EXISTS', 'Отзыв уже сохранён'); db.prepare('INSERT INTO feedback VALUES(?,?,?,?)').run(submissionId, actor.id, normalized.text, timestamp()); audit(actor, 'answer_reviewed', submissionId); return feedbackDto(db.prepare('SELECT * FROM feedback WHERE submission_id=?').get(submissionId)); }); },
    dashboard(actor) { const row = actorRow(actor); const field = row.role === 'teacher' ? 'teacher_id' : 'student_id'; return { user: safeUser(row), students: row.role === 'teacher' ? db.prepare('SELECT u.*,ts.level,ts.remaining_lessons FROM teacher_students ts JOIN users u ON u.id=ts.student_id WHERE ts.teacher_id=? ORDER BY u.name').all(actor.id).map(studentDto) : [], lessons: db.prepare(`SELECT * FROM lessons WHERE ${field}=? ORDER BY start_at`).all(actor.id).map(lessonDto), assignments: db.prepare(`SELECT * FROM assignments WHERE ${field}=? ORDER BY created_at DESC,id`).all(actor.id).map(assignmentDto) }; },
    resolveAttachmentAccess(actor, id) {
      actorRow(actor); const row = db.prepare('SELECT * FROM attachments WHERE id=?').get(id); if (!row) throw missing();
      if (row.assignment_id) assignmentRow(actor, row.assignment_id);
      else if (row.submission_id) { const s = db.prepare('SELECT assignment_id FROM submissions WHERE id=?').get(row.submission_id); if (!s) throw missing(); assignmentRow(actor, s.assignment_id); }
      else if (row.lesson_id) lessonRow(actor, row.lesson_id);
      else if (row.owner_id !== actor.id) throw missing();
      return row;
    }
  };
  return service;
}
