import { createAuth } from '../server/classroom/auth.mjs';
import { loadConfig } from '../server/classroom/config.mjs';
import { openStore } from '../server/classroom/database.mjs';

async function hiddenPassword(label) {
  if (!process.stdin.isTTY) throw new Error('Введите пароль в локальном интерактивном терминале');
  process.stdout.write(label); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => { process.stdin.off('data', listener); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const listener = chunk => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') { cleanup(); reject(new Error('Отменено')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') value = [...value].slice(0, -1).join('');
        else if (char >= ' ') value += char;
      }
    }; process.stdin.on('data', listener);
  });
}
let store;
try {
  const args = process.argv.slice(2);
  if (args[0] !== 'create-teacher' || args.some((a, i) => i > 0 && i % 2 === 1 && !['--username', '--name'].includes(a)) || args.length !== 5) throw new Error('Создание: create-teacher --username ЛОГИН --name ИМЯ. Пароль аргументом не принимается');
  const values = Object.fromEntries([[args[1], args[2]], [args[3], args[4]]]);
  const password = await hiddenPassword('Новый пароль (минимум 15 символов): ');
  if (password !== await hiddenPassword('Повторите пароль: ')) throw new Error('Пароли не совпали');
  store = openStore(loadConfig().dataDir);
  const created = await createAuth(store).createUser({ role: 'teacher', username: values['--username'], name: values['--name'], password, mustChangePassword: false });
  process.stdout.write(`Учётная запись преподавателя создана: ${created.username}\n`);
} catch (error) { process.stderr.write((error.status || !store ? error.message : 'Не удалось создать учётную запись') + '\n'); process.exitCode = 1; }
finally { store?.close(); }
