import { createApiClient, ApiError } from './classroom-api.mjs';

const api = createApiClient(); const $ = id => document.getElementById(id);
let user, data, selectedStudent = '', selectedAssignment = '', selectedReview = '', inFlight = false;
const answerDrafts = new Map(), taskDrafts = new Map(), reviewDrafts = new Map(), completeDrafts = new Map();
const uploaded = new WeakMap();
const dateLabel = value => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const el = (tag, content, className) => { const node = document.createElement(tag); if (content !== undefined) node.textContent = content; if (className) node.className = className; return node; };
function result(node, message, error = false) { node.textContent = message; node.hidden = !message; node.classList.toggle('is-error', error); }
function handleError(error, node = $('cabinet-storage-status')) { result(node, error.message, true); if (error.status === 401 || error.code === 'PASSWORD_REQUIRED') $('relogin-panel').hidden = false; }
async function verifyIdentity() {
  const session = await api.session();
  if (session.user.id !== user.id) throw new ApiError(403, 'DIFFERENT_ACCOUNT', 'Вы вошли под другим логином. Вернитесь в исходную учётную запись, чтобы отправить этот черновик');
  if (session.user.mustChangePassword) throw new ApiError(403, 'PASSWORD_REQUIRED', 'Смените временный пароль в отдельной вкладке');
}
async function run(form, action) {
  if (inFlight) return;
  inFlight = true;
  // Block interaction without overwriting availability decided by the render.
  const main = document.querySelector('main'); const wasInert = main.inert;
  main.inert = true; main.setAttribute('aria-busy', 'true');
  const status = form?.querySelector('.form-result') || $('cabinet-storage-status');
  result(status, 'Сохраняем…');
  try { await verifyIdentity(); const message = await action(); result(status, message || 'Сохранено'); }
  catch (error) { handleError(error, status); }
  finally { inFlight = false; main.inert = wasInert; main.removeAttribute('aria-busy'); }
}
function options(node, rows, label, wanted = node.value) {
  node.replaceChildren(...rows.map(row => { const option = el('option', label(row)); option.value = row.id; return option; }));
  if (rows.some(row => row.id === wanted)) node.value = wanted;
  node.disabled = !rows.length;
}
function filesList(node, files) {
  node.replaceChildren();
  for (const file of files) {
    const item = el('li');
    if (file.previewable) { const image = el('img', undefined, 'preview-image'); image.src = file.downloadUrl + '?preview=1'; image.alt = ''; image.loading = 'lazy'; item.append(image); }
    const link = el('a', file.name); link.href = file.downloadUrl; link.download = file.name;
    item.append(link, el('span', new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(file.size / 1_000_000) + ' МБ', 'form-note')); node.append(item);
  }
}
function selectedFiles(node, files) { node.replaceChildren(...files.map(file => el('li', file.name))); }
function limits(files) {
  if (files.length > 10) throw Error('Прикрепите не больше 10 файлов');
  if (files.some(file => file.size > 20_000_000)) throw Error('Файл должен быть не больше 20 МБ');
  if (files.reduce((sum, file) => sum + file.size, 0) > 50_000_000) throw Error('Все файлы вместе должны быть не больше 50 МБ');
}
async function uploadFiles(files) {
  limits(files); const ids = [];
  for (const file of files) { let value = uploaded.get(file); if (!value) { value = await api.upload(file); uploaded.set(file, value); } ids.push(value.id); }
  return ids;
}
function localDate(value) { if (!value || !Number.isFinite(new Date(value).valueOf())) throw Error('Укажите дату и время'); return new Date(value).toISOString(); }
function safeLink(value) { try { const url = new URL(value, location.origin); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } }
async function refresh() { data = await api.dashboard(); if (data.user.id !== user.id) throw new ApiError(403, 'DIFFERENT_ACCOUNT', 'Войдите под исходным логином'); render(); }
async function refreshAfterSave() { try { await refresh(); } catch (error) { handleError(error); } }
function answerDraft() { if (!answerDrafts.has(selectedAssignment)) answerDrafts.set(selectedAssignment, { text: '', files: [] }); return answerDrafts.get(selectedAssignment); }
function renderStudent() {
  $('student-name').textContent = user.name; $('student-initials').textContent = user.name.split(' ').slice(0, 2).map(word => [...word][0]).join('');
  const next = data.lessons.find(lesson => lesson.status === 'scheduled' && new Date(lesson.startAt).valueOf() >= Date.now());
  $('next-title').textContent = next?.title || 'Урок пока не назначен'; $('next-time').textContent = next ? dateLabel(next.startAt) + ' · ' + next.durationMinutes + ' мин · ' + timezone : 'Дата появится здесь, когда преподаватель добавит занятие';
  $('student-lesson-count').textContent = 'Проведено занятий: ' + data.lessons.filter(lesson => lesson.status === 'completed').length;
  if (!data.assignments.some(a => a.id === selectedAssignment)) selectedAssignment = data.assignments.find(a => !a.submission)?.id || data.assignments[0]?.id || '';
  options($('assignment-select'), data.assignments, a => a.title + (a.submission ? (a.submission.feedback ? ' · проверено' : ' · отправлено') : ''), selectedAssignment);
  $('assignment-empty').hidden = Boolean(data.assignments.length); renderAssignment(); renderRepeat();
}
function renderAssignment() {
  const assignment = data.assignments.find(a => a.id === selectedAssignment); $('assignment-detail').hidden = !assignment;
  if (!assignment) return;
  $('assignment-title').textContent = assignment.title; $('assignment-description').textContent = assignment.description; $('assignment-deadline').textContent = assignment.dueAt ? 'До ' + dateLabel(assignment.dueAt) : '';
  filesList($('assignment-files'), assignment.attachments);
  const draft = answerDraft(); $('student-answer').value = draft.text; $('student-answer-files').value = ''; selectedFiles($('student-selected-files'), draft.files);
  $('student-answer-form').hidden = Boolean(assignment.submission); $('student-saved-answer').hidden = !assignment.submission;
  if (assignment.submission) { $('student-saved-text').textContent = assignment.submission.text; filesList($('student-saved-files'), assignment.submission.attachments); $('student-feedback').textContent = assignment.submission.feedback?.text || 'Преподаватель ещё не проверил ответ'; }
}
function renderRepeat() {
  const previous = [...data.lessons].reverse().find(lesson => lesson.status === 'completed');
  $('repeat-topic').textContent = previous ? previous.title + ' · ' + dateLabel(previous.startAt) : 'Материалы появятся после первого занятия';
  $('summary-content').textContent = previous?.summary || 'Саммари пока не добавлено';
  const words = $('vocabulary-content'); words.replaceChildren();
  for (const word of previous?.vocabulary || []) { const item = el('div', undefined, 'repeat-word'); item.append(el('h3', word.word), el('p', word.meaning), el('p', word.example, 'form-note')); words.append(item); }
  if (!words.childNodes.length) words.append(el('p', 'Словарь пока не добавлен'));
  const materials = $('materials-content'); materials.replaceChildren();
  for (const material of previous?.materials || []) {
    const url = material.url ? safeLink(material.url) : material.attachmentId ? '/api/attachments/' + encodeURIComponent(material.attachmentId) : null;
    if (url) { const link = el('a', material.title); link.href = url; if (material.url) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } const p = el('p'); p.append(link); materials.append(p); }
  }
  if (!materials.childNodes.length) materials.append(el('p', 'Материалы пока не добавлены'));
}
function taskDraft() { if (!taskDrafts.has(selectedStudent)) taskDrafts.set(selectedStudent, { title: '', description: '', due: '', lesson: '', files: [] }); return taskDrafts.get(selectedStudent); }
function saveTaskDraft() { if (!selectedStudent) return; Object.assign(taskDraft(), { title: $('task-title').value, description: $('task-description').value, due: $('task-due').value, lesson: $('task-lesson').value }); }
function renderTeacher() {
  if (!data.students.some(s => s.id === selectedStudent)) selectedStudent = data.students[0]?.id || '';
  const list = $('student-list'); list.replaceChildren();
  if (!data.students.length) list.append(el('p', 'Добавьте первого ученика', 'empty-state'));
  for (const student of data.students) {
    const button = el('button', undefined, 'student-choice'); button.type = 'button'; button.setAttribute('aria-pressed', String(student.id === selectedStudent));
    const outstanding = data.assignments.some(a => a.studentId === student.id && a.submission && !a.submission.feedback);
    button.append(el('strong', student.name), el('small', student.level + ' · осталось занятий: ' + student.remainingLessons), el('small', outstanding ? 'Есть ответ на проверку' : ''));
    button.addEventListener('click', () => { if (inFlight) return; saveTaskDraft(); saveCompleteDraft(); selectedStudent = student.id; renderTeacher(); }); list.append(button);
  }
  options($('lesson-student'), data.students, s => s.name);
  const body = $('schedule-body'); body.replaceChildren();
  for (const lesson of data.lessons) { const row = el('tr'); const student = data.students.find(s => s.id === lesson.studentId); row.append(el('td', dateLabel(lesson.startAt)), el('td', (student?.name || '') + ' · ' + lesson.title), el('td', { scheduled: 'Запланировано', completed: 'Проведено', cancelled: 'Отменено' }[lesson.status])); body.append(row); }
  $('schedule-empty').hidden = Boolean(data.lessons.length); $('timezone-note').textContent = 'Время в вашем часовом поясе: ' + timezone;
  const student = data.students.find(s => s.id === selectedStudent); $('student-profile').hidden = !student;
  if (student) {
    $('profile-heading').textContent = student.name; $('profile-subtitle').textContent = 'Логин: ' + student.username; $('profile-level').value = student.level; $('profile-balance').value = student.remainingLessons;
    const lessons = data.lessons.filter(l => l.studentId === selectedStudent); const draft = taskDraft();
    options($('task-lesson'), lessons, l => l.title + ' · ' + dateLabel(l.startAt), draft.lesson);
    $('task-title').value = draft.title; $('task-description').value = draft.description; $('task-due').value = draft.due; $('task-files').value = ''; selectedFiles($('teacher-selected-files'), draft.files);
    options($('complete-lesson'), lessons, l => l.title + ' · ' + dateLabel(l.startAt)); loadCompleteDraft();
  }
  const answers = data.assignments.filter(a => a.submission && !a.submission.feedback);
  if (!answers.some(a => a.submission.id === selectedReview)) selectedReview = answers[0]?.submission.id || '';
  options($('review-select'), answers.map(a => ({ id: a.submission.id, assignment: a })), x => (data.students.find(s => s.id === x.assignment.studentId)?.name || '') + ' · ' + x.assignment.title, selectedReview);
  $('review-empty').hidden = Boolean(answers.length); renderReview();
}
function renderReview() {
  const assignment = data.assignments.find(a => a.submission?.id === selectedReview); $('review-layout').hidden = !assignment;
  if (!assignment) return;
  $('review-person').textContent = (data.students.find(s => s.id === assignment.studentId)?.name || '') + ' · ' + assignment.title;
  $('review-text').textContent = assignment.submission.text || 'Ответ приложен файлом'; filesList($('review-files'), assignment.submission.attachments); $('feedback-text').value = reviewDrafts.get(selectedReview) || '';
}
let lastCompleteId = '';
function saveCompleteDraft() {
  if (!lastCompleteId) return;
  const files = completeDrafts.get(lastCompleteId)?.files ?? [...$('lesson-material-files').files];
  completeDrafts.set(lastCompleteId, { summary: $('lesson-summary').value, words: $('lesson-words').value, materials: $('lesson-materials').value, files });
}
function loadCompleteDraft() {
  const id = $('complete-lesson').value; lastCompleteId = id;
  const lesson = data.lessons.find(l => l.id === id); const draft = completeDrafts.get(id);
  $('lesson-summary').value = draft?.summary ?? lesson?.summary ?? '';
  $('lesson-words').value = draft?.words ?? lesson?.vocabulary.map(v => [v.word, v.meaning, v.example].join(' | ')).join('\n') ?? '';
  $('lesson-materials').value = draft?.materials ?? lesson?.materials.filter(m => m.url).map(m => [m.title, m.url].join(' | ')).join('\n') ?? '';
  // File inputs cannot be repopulated; retained File objects live in the draft.
  $('lesson-material-files').value = '';
  selectedFiles($('lesson-selected-files'), draft?.files || []);
}
function render() { if (user.role === 'student') renderStudent(); else renderTeacher(); }
function credentials(username, password) { $('credentials-text').textContent = 'Логин: ' + username + '\nВременный пароль: ' + password; $('credentials-dialog').showModal(); }
function initializeDialogs() {
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.lesson-resource-close').addEventListener('click', () => dialog.close());
    let startedOutside = false; const outside = e => { const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    dialog.addEventListener('pointerdown', e => { startedOutside = e.target === dialog && outside(e); });
    dialog.addEventListener('click', e => { if (startedOutside && e.target === dialog && outside(e)) dialog.close(); startedOutside = false; });
    dialog.addEventListener('close', () => { document.documentElement.classList.remove('classroom-resource-open'); if (dialog.id === 'credentials-dialog') $('credentials-text').textContent = ''; });
  });
  document.querySelectorAll('.resource-open').forEach(button => button.addEventListener('click', () => { $(button.getAttribute('aria-controls')).showModal(); document.documentElement.classList.add('classroom-resource-open'); }));
}
function wireStudent() {
  $('assignment-select').addEventListener('change', () => { selectedAssignment = $('assignment-select').value; renderAssignment(); });
  $('student-answer').addEventListener('input', () => { answerDraft().text = $('student-answer').value; });
  $('student-answer-files').addEventListener('change', () => { answerDraft().files = [...$('student-answer-files').files]; selectedFiles($('student-selected-files'), answerDraft().files); });
  $('student-clear-files').addEventListener('click', () => { answerDraft().files = []; $('student-answer-files').value = ''; selectedFiles($('student-selected-files'), []); });
  $('student-answer-form').addEventListener('submit', event => { event.preventDefault(); const id = selectedAssignment; const draft = answerDraft(); run(event.currentTarget, async () => { limits(draft.files); if (!draft.text.trim() && !draft.files.length) throw Error('Добавьте текст или файл'); const attachmentIds = await uploadFiles(draft.files); await api.mutate('/api/assignments/' + id + '/submissions', { text: draft.text, attachmentIds }); answerDrafts.delete(id); await refreshAfterSave(); return 'Ответ отправлен преподавателю'; }); });
  $('refresh-student').addEventListener('click', () => run(null, async () => { await refresh(); return 'Данные обновлены'; }));
}
function wireTeacher() {
  $('student-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; const input = { name: $('new-name').value, username: $('new-username').value, level: $('new-level').value, remainingLessons: Number($('new-balance').value) }; run(form, async () => { const created = await api.mutate('/api/students', input); form.reset(); selectedStudent = created.student.id; credentials(created.student.username, created.temporaryPassword); await refreshAfterSave(); return 'Доступ создан'; }); });
  $('student-update-form').addEventListener('submit', event => { event.preventDefault(); const id = selectedStudent; const input = { level: $('profile-level').value, remainingLessons: Number($('profile-balance').value) }; run(event.currentTarget, async () => { await api.mutate('/api/students/' + id, input, { method: 'PATCH' }); await refreshAfterSave(); return 'Данные ученика сохранены'; }); });
  $('reset-password').addEventListener('click', () => { const student = data.students.find(s => s.id === selectedStudent); run(null, async () => { const response = await api.mutate('/api/students/' + student.id + '/reset-password', {}); credentials(student.username, response.temporaryPassword); return 'Прежний доступ отозван'; }); });
  $('lesson-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; run(form, async () => { await api.mutate('/api/lessons', { studentId: $('lesson-student').value, title: $('lesson-title').value, startAt: localDate($('lesson-start').value), durationMinutes: Number($('lesson-duration').value) }); form.reset(); await refreshAfterSave(); return 'Занятие назначено'; }); });
  $('task-files').addEventListener('change', () => { taskDraft().files = [...$('task-files').files]; selectedFiles($('teacher-selected-files'), taskDraft().files); });
  $('teacher-clear-files').addEventListener('click', () => { taskDraft().files = []; $('task-files').value = ''; selectedFiles($('teacher-selected-files'), []); });
  $('teacher-task-form').addEventListener('input', saveTaskDraft); $('teacher-task-form').addEventListener('change', saveTaskDraft);
  $('teacher-task-form').addEventListener('submit', event => { event.preventDefault(); saveTaskDraft(); const student = selectedStudent; const draft = taskDraft(); run(event.currentTarget, async () => { if (!draft.lesson) throw Error('Сначала назначьте занятие'); const input = { title: draft.title, description: draft.description, dueAt: draft.due ? localDate(draft.due) : null, attachmentIds: await uploadFiles(draft.files) }; await api.mutate('/api/lessons/' + draft.lesson + '/assignments', input); taskDrafts.delete(student); await refreshAfterSave(); return 'Задание отправлено ученику'; }); });
  $('complete-lesson').addEventListener('change', () => { saveCompleteDraft(); loadCompleteDraft(); });
  $('complete-form').addEventListener('input', saveCompleteDraft);
  $('lesson-material-files').addEventListener('change', () => {
    if (!lastCompleteId) return;
    saveCompleteDraft(); const draft = completeDrafts.get(lastCompleteId);
    draft.files = [...$('lesson-material-files').files]; selectedFiles($('lesson-selected-files'), draft.files);
  });
  $('lesson-clear-files').addEventListener('click', () => {
    if (lastCompleteId) { saveCompleteDraft(); completeDrafts.get(lastCompleteId).files = []; }
    $('lesson-material-files').value = ''; selectedFiles($('lesson-selected-files'), []);
  });
  $('complete-form').addEventListener('submit', event => { event.preventDefault(); saveCompleteDraft(); const id = $('complete-lesson').value; const draft = completeDrafts.get(id); run(event.currentTarget, async () => { if (!id) throw Error('Сначала назначьте занятие'); const vocabulary = draft.words.split('\n').filter(line => line.trim()).map(line => { const [word, meaning, ...example] = line.split('|').map(v => v.trim()); if (!word || !meaning) throw Error('Словарь: укажите слово и перевод в каждой строке'); return { word, meaning, example: example.join(' | ') }; }); const materials = draft.materials.split('\n').filter(line => line.trim()).map(line => { const [title, url] = line.split('|').map(v => v.trim()); if (!title || !safeLink(url)) throw Error('Материалы: укажите название и ссылку http или https'); return { title, url }; }); const attachmentIds = await uploadFiles(draft.files); const lesson = data.lessons.find(l => l.id === id); materials.push(...lesson.materials.filter(m => m.attachmentId), ...attachmentIds.map((attachmentId, i) => ({ title: draft.files[i].name, attachmentId }))); await api.mutate('/api/lessons/' + id + '/complete', { summary: draft.summary, vocabulary, materials }, { method: 'PATCH' }); completeDrafts.delete(id); await refreshAfterSave(); return 'Итоги доступны ученику в повторении'; }); });
  $('review-select').addEventListener('change', () => { selectedReview = $('review-select').value; renderReview(); });
  $('feedback-text').addEventListener('input', () => reviewDrafts.set(selectedReview, $('feedback-text').value));
  $('review-form').addEventListener('submit', event => { event.preventDefault(); const id = selectedReview; const text = $('feedback-text').value; run(event.currentTarget, async () => { await api.mutate('/api/submissions/' + id + '/feedback', { text }); reviewDrafts.delete(id); await refreshAfterSave(); return 'Отзыв отправлен ученику'; }); });
  $('refresh-teacher').addEventListener('click', () => run(null, async () => { saveTaskDraft(); saveCompleteDraft(); await refresh(); return 'Данные обновлены'; }));
}
$('resume-session').addEventListener('click', async () => { try { await verifyIdentity(); await refresh(); $('relogin-panel').hidden = true; result($('cabinet-storage-status'), 'Вход восстановлен. Проверьте черновик и отправьте его'); } catch (e) { handleError(e); } });
$('logout').addEventListener('click', async () => { if (inFlight) return; try { await api.mutate('/api/auth/logout', {}); location.assign('./login.html'); } catch (e) { handleError(e); } });
try {
  const session = await api.session(); user = session.user;
  if (user.mustChangePassword) location.replace('./login.html');
  else {
    document.documentElement.dataset.role = user.role; document.title = (user.role === 'teacher' ? 'Преподаватель' : 'Ученик') + ' — English.tools';
    $(user.role === 'teacher' ? 'student-view' : 'teacher-view').remove();
    const view = $(user.role + '-view'); view.hidden = false;
    $('role-label').textContent = user.role === 'teacher' ? 'Кабинет преподавателя' : 'Кабинет ученика';
    $('sidebar-person').textContent = user.name; $('classroom-sidebar').hidden = false; $('logout').hidden = false;
    const navigation = user.role === 'teacher' ? [['teacher-schedule', 'Расписание', 'calendar'], ['teacher-students', 'Ученики', 'students'], ['teacher-task-panel', 'Домашние задания', 'homework'], ['teacher-review', 'Проверка ответов', 'review']] : [['student-lesson', 'Следующий урок', 'calendar'], ['student-homework', 'Домашнее задание', 'homework'], ['student-materials', 'Повторение', 'repeat']];
    navigation.forEach(([id, label, icon]) => { const a = el('a'); a.href = '#' + id; const image = el('img'); image.src = './icons/' + icon + '.svg'; image.alt = ''; a.append(image, el('span', label)); $('classroom-nav').append(a); });
    initializeDialogs(); if (user.role === 'teacher') wireTeacher(); else wireStudent();
    await refresh(); result($('cabinet-storage-status'), '');
  }
} catch (error) { if (error.status === 401) location.replace('./login.html'); else handleError(error); }
