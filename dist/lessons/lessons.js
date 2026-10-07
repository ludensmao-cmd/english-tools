(() => {
  'use strict';
  const role = document.documentElement.dataset.role === 'teacher' ? 'teacher' : 'student';
  document.title = `${role === 'teacher' ? 'Преподаватель' : 'Ученик'} — учебный кабинет English.tools`;
  document.getElementById('role-label').textContent = role === 'teacher' ? 'Кабинет преподавателя' : 'Кабинет ученика';
  // A role chooses a separate demonstration screen. It does not grant or protect access.
  document.getElementById(role === 'teacher' ? 'student-view' : 'teacher-view')?.remove();
  document.getElementById(role === 'teacher' ? 'student-sidebar-links' : 'teacher-sidebar-links')?.remove();

  // Cabinet navigation uses the same icons as its section headings.
  const sectionIcons = {
    '#student-lesson': 'calendar', '#student-homework': 'homework', '#student-materials': 'repeat',
    '#teacher-schedule': 'calendar', '#teacher-students': 'students',
    '#teacher-task-panel': 'homework', '#teacher-review': 'review'
  };
  const sidebar = document.querySelector('.VPSidebar');
  sidebar?.querySelectorAll('a').forEach(link => {
    const icon = sectionIcons[link.getAttribute('href')];
    const image = link.querySelector('.sb-icon img');
    if (image && icon) image.src = `/lessons/icons/${icon}.svg`;
  });
  if (!location.hash) {
    const firstLink = sidebar?.querySelector('a');
    firstLink?.classList.add('active');
    firstLink?.setAttribute('aria-current', 'page');
  }
  const profile = document.createElement('div');
  profile.className = 'classroom-sidebar-profile';
  profile.innerHTML = role === 'student'
    ? '<span class="avatar">АМ</span><span><strong>Анна М.</strong><small>Индивидуальные занятия · B1</small></span>'
    : '<span class="avatar"><img src="/lessons/icons/lessons.svg" width="22" height="22" alt=""></span><span><strong>Преподаватель</strong><small>Индивидуальные занятия</small></span>';
  sidebar?.append(profile);
  const mode = document.createElement('span');
  mode.className = 'classroom-mode';
  mode.textContent = 'Макет';
  mode.title = 'Демонстрационные данные. Сохранение только в этом браузере.';
  document.getElementById('role-label')?.after(mode);

  document.querySelectorAll('.resource-open[aria-controls]').forEach(trigger => {
    const dialog = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!dialog) return;
    // The native modal keeps keyboard focus inside and supports Escape.
    trigger.addEventListener('click', () => {
      if (dialog.open) return;
      dialog.showModal();
      document.documentElement.classList.add('classroom-resource-open');
    });
    dialog.querySelector('.lesson-resource-close').addEventListener('click', () => dialog.close());
    const outsideDialog = event => {
      const bounds = dialog.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    };
    let startedOnBackdrop = false;
    dialog.addEventListener('pointerdown', event => {
      startedOnBackdrop = event.target === dialog && outsideDialog(event);
    });
    dialog.addEventListener('click', event => {
      if (startedOnBackdrop && event.target === dialog && outsideDialog(event)) dialog.close();
      startedOnBackdrop = false;
    });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('.lesson-resource-dialog[open]')) document.documentElement.classList.remove('classroom-resource-open');
      trigger.focus({preventScroll: true});
    });
  });

  let fileSequence = 0;
  const students = {
    anna: {name: 'Анна М.', level: 'B1', state: 'Ответ ожидается', next: '7 октября · 18:00', balance: '5 из 8 осталось', topic: 'Разговор о планах', task: 'Рассказать о планах на выходные и подготовить два вопроса.', files: []},
    maxim: {name: 'Максим К.', level: 'A2', state: 'На проверку', next: '8 октября · 17:00', balance: '2 из 8 осталось', topic: 'Короткий рассказ о себе', task: 'Написать пять предложений о себе и своих интересах.', files: []},
    olga: {name: 'Ольга С.', level: 'B1', state: 'Без задания', next: '9 октября · 12:00', balance: '7 из 8 осталось', topic: 'Вопросы в поездке', task: 'Задание пока не добавлено.', files: []}
  };
  const taskDrafts = Object.fromEntries(Object.keys(students).map(key => [key, {title: '', description: '', files: []}]));
  let selectedStudent = 'anna';
  let answerFiles = [];
  let feedback = '';
  let reviewed = false;
  let saving = false;
  const fileUrls = new Map();
  const databaseName = 'english-tools-classroom-demo-v1';
  const storageStatus = document.getElementById('cabinet-storage-status');

  function setResult(id, message, isError = false) {
    const result = document.getElementById(id);
    if (!result) return;
    result.textContent = message;
    result.dataset.state = isError ? 'error' : 'success';
    result.hidden = !message;
  }

  // No network request: the two roles have separate records in this browser.
  function openStorage() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('storage-unavailable')); return; }
      let settled = false;
      const request = indexedDB.open(databaseName, 1);
      const timeout = setTimeout(() => finish(new Error('storage-timeout')), 6000);
      function finish(error, database) {
        if (settled) { database?.close(); return; }
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error); else resolve(database);
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('roles')) request.result.createObjectStore('roles');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        finish(null, request.result);
      };
      request.onerror = () => finish(request.error || new Error('storage-unavailable'));
      request.onblocked = () => finish(new Error('storage-blocked'));
    });
  }

  async function storedRole(value) {
    const database = await openStorage();
    return new Promise((resolve, reject) => {
      let transaction;
      let result;
      try {
        transaction = database.transaction('roles', value === undefined ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('roles');
        const request = value === undefined ? store.get(role) : store.put(value, role);
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => { database.close(); resolve(result); };
        transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error || new Error('storage-failed')); };
      } catch (error) { database.close(); reject(error); }
    });
  }

  function validFiles(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && item.file instanceof Blob && typeof item.file.name === 'string').map(item => ({id: ++fileSequence, file: item.file}));
  }

  function fileSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toLocaleString('ru-RU', {maximumFractionDigits: 1})} МБ`;
  }

  function appendFiles(existing, incoming) {
    const files = [...existing];
    Array.from(incoming).forEach(file => {
      if (files.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) return;
      files.push({id: ++fileSequence, file});
    });
    return files;
  }

  function renderFiles(id, files, removeFile) {
    const list = document.getElementById(id);
    if (!list) return;
    (fileUrls.get(id) || []).forEach(url => URL.revokeObjectURL(url));
    const urls = [];
    fileUrls.set(id, urls);
    list.replaceChildren();
    list.hidden = files.length === 0;
    files.forEach(item => {
      const row = document.createElement('li');
      const preview = document.createElement('span');
      preview.className = 'file-preview';
      const image = document.createElement('img');
      if (item.file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(item.file);
        urls.push(previewUrl);
        image.src = previewUrl;
        image.alt = `Превью файла ${item.file.name}`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.src = '/lessons/icons/homework.svg';
          image.className = 'file-type-icon';
          image.alt = '';
        }, {once: true});
      } else {
        image.src = '/lessons/icons/homework.svg';
        image.className = 'file-type-icon';
        image.alt = '';
      }
      preview.append(image);
      const copy = document.createElement('div');
      const name = document.createElement(removeFile ? 'strong' : 'a');
      name.textContent = item.file.name;
      if (!removeFile) {
        const url = URL.createObjectURL(item.file);
        urls.push(url);
        name.href = url;
        name.download = item.file.name;
        name.setAttribute('aria-label', `Скачать файл ${item.file.name}`);
      }
      const size = document.createElement('span');
      size.textContent = fileSize(item.file.size);
      copy.append(name, size);
      row.append(preview, copy);
      if (removeFile) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'file-remove';
        button.textContent = 'Убрать';
        button.setAttribute('aria-label', `Убрать файл ${item.file.name}`);
        button.addEventListener('click', () => removeFile(item.id));
        row.append(button);
      }
      list.append(row);
    });
  }

  function renderAnswerFiles() {
    renderFiles('student-selected-files', answerFiles, id => {
      answerFiles = answerFiles.filter(item => item.id !== id);
      renderAnswerFiles();
      setResult('student-answer-result', '');
    });
    document.getElementById('student-file-selection').hidden = answerFiles.length === 0;
  }

  function renderSavedAnswer(text, files) {
    const savedText = document.getElementById('student-saved-text');
    savedText.textContent = text;
    savedText.hidden = !text;
    renderFiles('student-saved-files', files);
    document.getElementById('student-saved-answer').hidden = false;
  }

  function renderDraftFiles() {
    const draft = taskDrafts[selectedStudent];
    renderFiles('teacher-selected-files', draft.files, id => {
      draft.files = draft.files.filter(item => item.id !== id);
      renderDraftFiles();
      setResult('teacher-task-result', '');
    });
    document.getElementById('teacher-file-selection').hidden = draft.files.length === 0;
  }

  function showStudent(key, scrollToProfile = false) {
    const data = students[key];
    if (!data || role !== 'teacher') return;
    selectedStudent = key;
    for (const [id, value] of Object.entries({'profile-heading': data.name, 'profile-subtitle': `${data.level} · индивидуальные занятия`, 'profile-state': data.state, 'profile-next': data.next, 'profile-balance': data.balance, 'profile-topic': data.topic, 'profile-task': data.task})) document.getElementById(id).textContent = value;
    renderFiles('profile-task-files', data.files);
    document.querySelectorAll('[data-student]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.student === key));
      button.querySelector('.student-choice-end').textContent = students[button.dataset.student].state;
    });
    const draft = taskDrafts[key];
    document.getElementById('task-title').value = draft.title;
    document.getElementById('task-description').value = draft.description;
    document.getElementById('task-files').value = '';
    renderDraftFiles();
    setResult('teacher-task-result', '');
    if (scrollToProfile) document.getElementById('teacher-students').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  }

  function teacherSnapshot(overrides = {}) {
    return {version: 1, students: Object.fromEntries(Object.entries(students).map(([key, student]) => [key, {task: student.task, state: student.state, files: [...student.files]}])), feedback, reviewed, ...overrides};
  }

  async function save(value, resultId, onSaved) {
    if (saving) return;
    saving = true;
    const controls = [...document.querySelectorAll('.role-view input, .role-view textarea, .role-view button')];
    const disabledBefore = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    const forms = [...document.querySelectorAll('.role-view form')];
    forms.forEach(form => form.setAttribute('aria-busy', 'true'));
    setResult(resultId, 'Сохраняем в этом браузере…');
    try {
      await storedRole(value);
      onSaved();
      storageStatus.hidden = true;
    } catch {
      setResult(resultId, 'Браузер не сохранил данные. Текст и выбранные файлы остались в форме. Попробуйте ещё раз или сохраните ответ отдельно.', true);
    } finally {
      controls.forEach((control, index) => { control.disabled = disabledBefore[index]; });
      forms.forEach(form => form.removeAttribute('aria-busy'));
      saving = false;
    }
  }

  if (role === 'student') {
    document.getElementById('student-answer-files').addEventListener('change', event => {
      answerFiles = appendFiles(answerFiles, event.currentTarget.files);
      event.currentTarget.value = '';
      renderAnswerFiles();
      setResult('student-answer-result', '');
    });
    document.getElementById('student-clear-files').addEventListener('click', () => {
      answerFiles = [];
      renderAnswerFiles();
      setResult('student-answer-result', '');
    });
    document.getElementById('student-answer').addEventListener('input', () => setResult('student-answer-result', ''));
    document.getElementById('student-answer-form').addEventListener('submit', event => {
      event.preventDefault();
      const text = document.getElementById('student-answer').value.trim();
      if (!text && !answerFiles.length) { setResult('student-answer-result', 'Добавьте файл или напишите ответ, затем сохраните задание.', true); return; }
      const files = [...answerFiles];
      save({version: 1, text, files}, 'student-answer-result', () => {
        renderSavedAnswer(text, files);
        setResult('student-answer-result', 'Ответ и файлы сохранены в этом браузере. Преподавателю они не отправлены.');
      });
    });
    document.getElementById('copy-ai-practice').addEventListener('click', async () => {
      const text = document.getElementById('ai-practice-text');
      const status = document.getElementById('copy-status');
      try {
        await navigator.clipboard.writeText(text.textContent.trim());
        status.textContent = 'Скопировано';
      } catch {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(text);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        status.textContent = 'Текст выделен. Скопируйте его сочетанием Ctrl+C или ⌘C.';
      }
    });
  } else {
    document.getElementById('teacher-task-nav')?.addEventListener('click', () => { document.getElementById('teacher-task-panel').open = true; });
    document.querySelectorAll('[data-student]').forEach(button => button.addEventListener('click', () => { if (!saving) showStudent(button.dataset.student); }));
    document.querySelectorAll('[data-open-student]').forEach(button => button.addEventListener('click', () => { if (!saving) showStudent(button.dataset.openStudent, true); }));
    document.getElementById('task-title').addEventListener('input', event => { taskDrafts[selectedStudent].title = event.currentTarget.value; setResult('teacher-task-result', ''); });
    document.getElementById('task-description').addEventListener('input', event => { taskDrafts[selectedStudent].description = event.currentTarget.value; setResult('teacher-task-result', ''); });
    document.getElementById('task-files').addEventListener('change', event => {
      taskDrafts[selectedStudent].files = appendFiles(taskDrafts[selectedStudent].files, event.currentTarget.files);
      event.currentTarget.value = '';
      renderDraftFiles();
      setResult('teacher-task-result', '');
    });
    document.getElementById('teacher-clear-files').addEventListener('click', () => {
      taskDrafts[selectedStudent].files = [];
      renderDraftFiles();
      setResult('teacher-task-result', '');
    });
    document.getElementById('teacher-task-form').addEventListener('submit', event => {
      event.preventDefault();
      const title = document.getElementById('task-title').value.trim();
      const description = document.getElementById('task-description').value.trim();
      if (!title || description.length < 8) { setResult('teacher-task-result', 'Укажите название и опишите задание: не менее 8 символов без пробелов по краям.', true); return; }
      const target = selectedStudent;
      const nextStudent = {...students[target], task: `${title}\n${description}`, files: [...taskDrafts[target].files], state: 'Добавлено в макете'};
      const candidate = teacherSnapshot();
      candidate.students[target] = {task: nextStudent.task, files: nextStudent.files, state: nextStudent.state};
      save(candidate, 'teacher-task-result', () => {
        students[target] = nextStudent;
        taskDrafts[target] = {title: '', description: '', files: []};
        showStudent(target);
        setResult('teacher-task-result', `Задание и файлы сохранены в этом браузере в карточке «${students[target].name}». Ученику они не отправлены.`);
      });
    });
    document.getElementById('feedback-text').addEventListener('input', () => setResult('review-result', ''));
    document.getElementById('review-form').addEventListener('submit', event => {
      event.preventDefault();
      const text = document.getElementById('feedback-text').value.trim();
      if (text.length < 8) { setResult('review-result', 'Напишите отзыв: не менее 8 символов без пробелов по краям.', true); return; }
      const candidate = teacherSnapshot({feedback: text, reviewed: true});
      candidate.students.maxim.state = 'Проверено в макете';
      save(candidate, 'review-result', () => {
        feedback = text;
        reviewed = true;
        students.maxim.state = 'Проверено в макете';
        document.getElementById('review-count').textContent = 'Проверено в макете';
        showStudent(selectedStudent);
        setResult('review-result', 'Отзыв сохранён в этом браузере. Ученик его не получил.');
      });
    });
    showStudent(selectedStudent);
  }

  const initialControls = [...document.querySelectorAll('.role-view input, .role-view textarea, .role-view button')];
  const initialDisabled = initialControls.map(control => control.disabled);
  initialControls.forEach(control => { control.disabled = true; });
  storageStatus.textContent = 'Проверяем сохранённые данные в этом браузере…';
  storageStatus.hidden = false;
  storedRole().then(saved => {
    if (!saved || saved.version !== 1) return;
    if (role === 'student') {
      const text = typeof saved.text === 'string' ? saved.text : '';
      answerFiles = validFiles(saved.files);
      document.getElementById('student-answer').value = text;
      renderAnswerFiles();
      if (text || answerFiles.length) renderSavedAnswer(text, [...answerFiles]);
    } else {
      for (const key of Object.keys(students)) {
        const item = saved.students?.[key];
        if (!item) continue;
        if (typeof item.task === 'string') students[key].task = item.task;
        if (typeof item.state === 'string') students[key].state = item.state;
        students[key].files = validFiles(item.files);
      }
      feedback = typeof saved.feedback === 'string' ? saved.feedback : '';
      reviewed = saved.reviewed === true;
      document.getElementById('feedback-text').value = feedback;
      if (reviewed) document.getElementById('review-count').textContent = 'Проверено в макете';
      showStudent(selectedStudent);
    }
  }).then(() => { storageStatus.hidden = true; }).catch(() => {
    storageStatus.textContent = 'Сохранённые данные недоступны. Вы можете заполнить форму; если браузер не разрешит сохранение, текст и файлы останутся в открытой вкладке.';
    storageStatus.dataset.state = 'error';
  }).finally(() => initialControls.forEach((control, index) => { control.disabled = initialDisabled[index]; }));
  window.addEventListener('pagehide', () => fileUrls.forEach(urls => urls.forEach(url => URL.revokeObjectURL(url))));
})();
