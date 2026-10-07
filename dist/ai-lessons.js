'use strict';

(() => {
  const wizard = document.getElementById('lesson-wizard');
  if (!wizard) return;
  const find = selector => selector === '#lesson-wizard' ? wizard : wizard.querySelector(selector);
  const all = selector => [...wizard.querySelectorAll(selector)];
  const goals = {
    conversation: { name: 'Разговор', themes: ['Заказать кофе', 'Заселиться в отель', 'Познакомиться с коллегой'], objective: 'Поддержать короткий разговор по вашей теме.', warmup: 'Вспомните две фразы, с которых могли бы начать разговор. Попробуйте сказать их без перевода перед глазами.', task: 'Отвечайте собеседнику по одной реплике. Если не хватает слова, сначала объясните мысль теми словами, которые знаете.', check: 'Выберите две трудные фразы из диалога. Исправьте их сами, затем разыграйте похожую ситуацию ещё раз.' },
    writing: { name: 'Письмо', themes: ['Предложить коллеге встречу', 'Ответить на приглашение', 'Попросить помощь'], objective: 'Написать короткий текст и улучшить его своими силами.', warmup: 'Запишите три мысли, которые хотите передать. Решите, кому пишете и какого ответа ждёте.', task: 'Напишите несколько предложений сами. Попросите ИИ показать две важные правки и объяснить их, сохранив ваш смысл.', check: 'Перепишите трудный фрагмент самостоятельно. Сравните обе версии и сохраните одно выражение, которое пригодится снова.' },
    grammar: { name: 'Грамматика', themes: ['Present Simple', 'Past Simple', 'Предлоги места'], objective: 'Разобраться в одном правиле и применить его в своих примерах.', warmup: 'Сформулируйте, что именно непонятно в выбранной теме. Напишите одно предложение, в котором сомневаетесь.', task: 'Разберите короткое объяснение и два примера. Выполните несколько заданий по одному, не подглядывая в готовый ответ.', check: 'Объясните правило своими словами и составьте два новых примера. Попросите проверить именно их.' },
    words: { name: 'Словарный запас', themes: ['Путешествие', 'Рабочая встреча', 'Мои увлечения'], objective: 'Использовать несколько новых выражений в собственных ответах.', warmup: 'Вспомните три слова по теме. Решите, о чём хотели бы рассказать или спросить.', task: 'Прочитайте выражения с примерами. Используйте их в ответах на короткие вопросы, а не просто повторите перевод.', check: 'Закройте список и вспомните выражения. Составьте свои примеры с теми, которые пока забываются.' }
  };
  const partners = {
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', textGuide: 'https://learn.chatgpt.com/docs/quickstart', voiceGuide: 'https://learn.chatgpt.com/docs/features/voice', voiceHint: 'Включите разговорный режим, если он доступен в вашем приложении. Разрешите доступ к микрофону.' },
    claude: { name: 'Claude', url: 'https://claude.ai/', textGuide: 'https://support.claude.com/en/articles/8114491-get-started-with-claude', voiceGuide: 'https://support.claude.com/en/articles/11101966-use-voice-mode', voiceHint: 'Включите разговорный режим, если он доступен в вашем приложении. Если доступна только диктовка, выбирайте практику текстом: по тексту нельзя оценить произношение.' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', textGuide: 'https://support.google.com/gemini/answer/13275745', voiceGuide: 'https://support.google.com/gemini/answer/15274899', voiceHint: 'Если в вашем приложении доступен Gemini Live, откройте разговорный режим и разрешите доступ к микрофону. Если голос недоступен, пройдите тот же урок текстом.' }
  };
  const state = { step: 0, goal: null, level: null, format: 'text', partner: 'chatgpt', minutes: '10', phase: 'practice', topic: '' };
  let copying = false;
  let settingsVersion = 0;

  function prompt() {
    const goal = goals[state.goal];
    const topic = state.topic.trim();
    const turns = { 5: 3, 10: 5, 15: 7 }[state.minutes];
    const context = `Мой уровень английского примерно ${state.level}. Хочу потренировать ${goal.name.toLowerCase()} по теме «${topic}» за примерно ${state.minutes} минут. Общайся на английском подходящей сложности, пояснения давай по-русски. Если мне трудно, упрости задание. Задавай по одному вопросу и обязательно жди моего ответа. Не выполняй упражнения за меня.`;
    if (state.phase === 'review') {
      return `Мы закончили урок по теме «${topic}». Мой уровень английского — ${state.level}. Опирайся только на мои реальные ответы в этом чате: выбери не больше двух важных ошибок или трудностей, объясни их по-русски и попроси меня исправить самому. Если ошибок не было, скажи об этом и предложи усложнение. Не придумывай моих ответов и ошибок. Если истории занятия нет, попроси прислать её. Затем дай два новых коротких задания на повторение по одному и дождись каждого ответа. В конце предложи три выражения для повторения с моими примерами. По одному текстовому пересказу не оценивай моё произношение.`;
    }
    const format = state.format === 'voice' ? 'Мы будем заниматься голосом. Говори короткими репликами, давай мне время ответить. Не перебивай и не исправляй каждое слово по ходу разговора. Опирайся на то, что действительно услышал; если не разобрал ответ, переспроси. В конце покажи краткий разбор текстом.' : 'Мы будем заниматься в текстовом чате. Я пишу ответы сам. Не показывай готовый ответ до моей попытки.';
    const exercise = {
      conversation: `Сыграй собеседника в ситуации по моей теме. Сначала попроси меня вспомнить две полезные фразы, затем начни короткий диалог. После ${turns} моих реплик остановись и спроси, готов ли я перейти к разбору.`,
      writing: `Сначала уточни, кому и зачем я пишу, затем попроси мой черновик из нескольких предложений. Не пиши его за меня. Сохраняй мой смысл и стиль. Когда я пришлю текст, спроси, готов ли я разобрать две самые полезные правки. Если отвечаю голосом, попроси затем прислать текст, чтобы проверить написание.`,
      grammar: `Сначала спроси, что именно непонятно в моей теме. Коротко объясни одно правило и покажи два простых примера. Затем дай ${turns} коротких заданий по одному. После моей попытки объясняй ответ; не подсказывай его заранее. В конце попроси меня составить два своих примера.`,
      words: `Сначала спроси, какие слова по теме я уже знаю. Предложи ${state.minutes === '5' ? 'три' : 'пять'} полезных выражений с короткими примерами. Затем задавай вопросы по одному, чтобы я применил эти выражения в ${turns} собственных ответах. В конце попроси вспомнить их без списка.`
    }[state.goal];
    return `${context}\n\n${format}\n\n${exercise}\n\nНачни с первого вопроса, не перечисляй весь урок сразу.`;
  }

  function clearError() {
    find('#wizard-error').hidden = true;
    find('#wizard-error').textContent = '';
    find('#lesson-topic').removeAttribute('aria-invalid');
  }

  function error(message, target) {
    const element = find('#wizard-error');
    element.textContent = message;
    element.hidden = false;
    target?.focus();
    return false;
  }

  function validStep() {
    if (state.step === 0) {
      if (!state.goal) return error('Выберите, что хотите потренировать.', find('input[name="goal"]'));
      if (!state.level) return error('Выберите примерный уровень английского.', find('input[name="level"]'));
    }
    if (state.step === 2) {
      state.topic = find('#lesson-topic').value.trim();
      if (state.topic.length < 2) {
        find('#lesson-topic').setAttribute('aria-invalid', 'true');
        return error('Напишите тему хотя бы из двух символов или выберите пример ниже.', find('#lesson-topic'));
      }
    }
    return true;
  }

  function renderFormatHints() {
    find('#format-hint').textContent = state.format === 'voice'
      ? 'Нужен именно разговорный режим: вы говорите, ИИ отвечает вслух. Диктовка через микрофон только превращает речь в текст.'
      : 'Можно начать в браузере. Инструкцию вставим в новый чат.';
    const prefersText = ['writing', 'grammar'].includes(state.goal);
    find('#partner-hint').textContent = state.format === 'voice'
      ? `${state.partner === 'gemini' ? 'Для Gemini Live понадобится мобильное приложение. ' : 'Проверьте, есть ли разговорный режим в вашем приложении. '}${prefersText ? 'Для этой задачи удобно оставить разбор на экране текстом. ' : ''}Если голос недоступен, можно пройти тот же урок текстом.`
      : 'Выберите тот сервис, к которому у вас уже есть доступ. Одна и та же инструкция подходит для всех трёх чатов.';
  }

  function renderTopics() {
    const box = find('#topic-suggestions');
    box.replaceChildren();
    goals[state.goal].themes.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = theme;
      button.addEventListener('click', () => {
        find('#lesson-topic').value = theme;
        state.topic = theme;
        settingsVersion++;
        clearError();
        find('#lesson-topic').focus();
      });
      box.append(button);
    });
  }

  function renderPrompt() {
    find('#prompt-text').value = prompt();
    find('#prompt-label').textContent = state.phase === 'review' ? 'Продолжение для того же чата' : 'Инструкция для нового чата';
    find('#prompt-note').textContent = state.phase === 'review'
      ? 'После практики вставьте это в тот же чат. Так разбор будет опираться на ваши ответы.'
      : 'Скопируйте и отправьте инструкцию в новом чате. Начните с ответа на первый вопрос.';
    all('[data-phase]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.phase === state.phase)));
    find('#copy-status').textContent = '';
  }

  function renderResult() {
    const goal = goals[state.goal];
    const partner = partners[state.partner];
    find('#result-settings').textContent = `${goal.name} · ${state.level} · ${state.format === 'voice' ? 'Голос' : 'Текст'} · ${state.minutes} минут`;
    find('#step-result-title').textContent = state.topic;
    find('#result-objective').textContent = goal.objective;
    find('#lesson-warmup').textContent = goal.warmup;
    find('#lesson-task').textContent = goal.task;
    find('#lesson-check').textContent = goal.check;
    find('#result-settings').dataset.partner = state.partner;
    find('#start-title').textContent = `Как начать в ${partner.name}`;
    const items = [
      `Откройте ${partner.name}, при необходимости войдите в свой аккаунт и создайте новый обычный чат.`,
      'Скопируйте инструкцию на этой странице, вставьте её в поле сообщения и отправьте.'
    ];
    if (state.format === 'voice') {
      items.push(partner.voiceHint, 'Скажите: «Продолжим урок голосом. Дождись моего ответа». Отвечайте на английском по одной реплике.');
    } else {
      items.push('Прочитайте первый вопрос и напишите свой ответ на английском. Продолжайте в этом же чате.');
    }
    items.push('В конце нажмите здесь «Разобрать ответы» и отправьте вторую инструкцию в тот же чат.');
    const list = find('#start-instructions');
    list.replaceChildren();
    items.forEach(text => { const item = document.createElement('li'); item.textContent = text; list.append(item); });
    find('#open-partner').href = partner.url;
    find('#open-partner').textContent = `Открыть ${partner.name} ↗`;
    find('#partner-guide').href = state.format === 'voice' ? partner.voiceGuide : partner.textGuide;
    renderPrompt();
  }

  function showStep(step, focus = true) {
    state.step = Math.max(0, Math.min(3, step));
    step = state.step;
    settingsVersion++;
    clearError();
    all('[data-step]').forEach(panel => { panel.hidden = Number(panel.dataset.step) !== step; });
    all('[data-progress]').forEach(item => {
      const index = Number(item.dataset.progress);
      if (index === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
      item.classList.toggle('is-done', index < step);
    });
    find('#wizard-back').hidden = step === 0;
    find('#wizard-position').textContent = `Шаг ${step + 1} из 4`;
    find('#wizard-next').textContent = step === 3 ? 'Изменить настройки' : step === 2 ? 'Собрать урок →' : 'Дальше →';
    if (step === 1) renderFormatHints();
    if (step === 2) renderTopics();
    if (step === 3) renderResult();
    if (focus) {
      const title = find(`[data-step="${step}"] h3`);
      title?.focus({ preventScroll: true });
      title?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  all('input[type="radio"]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    clearError();
    const previousGoal = state.goal;
    if (!['goal','level','format','partner','minutes'].includes(input.name)) return;
    state[input.name] = input.value;
    settingsVersion++;
    if (input.name === 'goal') {
      const previousExamples = previousGoal ? goals[previousGoal].themes : [];
      if (!state.topic || previousExamples.includes(state.topic)) {
        state.topic = goals[state.goal].themes[0];
        find('#lesson-topic').value = state.topic;
      }
    }
    if (state.step === 1) renderFormatHints();
  }));
  find('#lesson-topic').addEventListener('input', () => {
    state.topic = find('#lesson-topic').value;
    settingsVersion++;
    clearError();
  });
  find('#lesson-topic').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); find('#wizard-next').click(); }
  });
  find('#wizard-next').addEventListener('click', () => {
    if (state.step === 3) { state.phase = 'practice'; showStep(0); return; }
    if (validStep()) { state.phase = 'practice'; showStep(state.step + 1); }
  });
  find('#wizard-back').addEventListener('click', () => { if (state.step > 0) showStep(state.step - 1); });
  all('[data-phase]').forEach(button => button.addEventListener('click', () => {
    state.phase = button.dataset.phase;
    settingsVersion++;
    renderPrompt();
  }));
  find('#copy-prompt').addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    const button = find('#copy-prompt');
    const version = settingsVersion;
    const text = prompt();
    const review = state.phase === 'review';
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (version === settingsVersion && state.step === 3) find('#copy-status').textContent = review ? 'Скопировано. Отправьте в тот же чат после практики.' : 'Скопировано. Теперь вставьте инструкцию в новый чат.';
    } catch (_) {
      if (version === settingsVersion && state.step === 3) {
        find('#prompt-text').focus();
        find('#prompt-text').select();
        find('#copy-status').textContent = 'Инструкция выделена. Нажмите ⌘C на Mac или Ctrl+C на Windows, затем вставьте её в чат.';
      }
    } finally { copying = false; button.disabled = false; }
  });
  find('#lesson-wizard').hidden = false;
  showStep(0, false);
})();
