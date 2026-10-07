'use strict';

const practicePanel = document.querySelector('#practice');
const flow = document.querySelector('#hero-flow');
const flowTask = document.querySelector('#flow-task');
const flowInstruction = document.querySelector('#flow-instruction');
const flowOutcome = document.querySelector('#flow-outcome');

if (practicePanel && flow && flowTask && flowInstruction && flowOutcome) {
  const defaults = { conversation: 'заказ кофе', writing: 'письмо коллеге', words: 'путешествие' };
  const descriptions = {
    conversation: {
      title: 'Разговор',
      instruction: 'Вопросы по одному, без ответов за вас',
      outcome: 'Отвечаете сами и разбираете ошибки'
    },
    writing: {
      title: 'Письмо',
      instruction: 'ИИ ждёт ваш текст, не пишет его за вас',
      outcome: 'Правите текст сами после объяснения'
    },
    words: {
      title: 'Слова',
      instruction: 'Примеры и короткие вопросы по одному',
      outcome: 'Используете выражения в своих ответах'
    }
  };

  let remixTimer;
  let lastFlowKey;

  function selected(attribute, fallback) {
    return practicePanel.querySelector(`[${attribute}][aria-pressed="true"]`)?.getAttribute(attribute) || fallback;
  }

  function updateFlow(animate = false) {
    const goal = selected('data-goal', 'conversation');
    const topic = practicePanel.querySelector('#practice-topic')?.value.trim() || defaults[goal];
    const description = descriptions[goal];
    const flowKey = `${goal}|${topic}`;
    if (flowKey === lastFlowKey) return;
    lastFlowKey = flowKey;

    flowTask.textContent = `${description.title} · ${topic}`;
    flowInstruction.textContent = description.instruction;
    flowOutcome.textContent = description.outcome;

    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    flow.classList.remove('is-remixing');
    void flow.offsetWidth;
    flow.classList.add('is-remixing');
    clearTimeout(remixTimer);
    remixTimer = window.setTimeout(() => {
      flow.classList.remove('is-remixing');
    }, 650);
  }

  practicePanel.addEventListener('click', event => {
    if (event.target.closest('[data-goal]')) updateFlow(true);
  });
  practicePanel.querySelector('#practice-topic')?.addEventListener('input', () => updateFlow());
  updateFlow();
}
