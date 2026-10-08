import { createBackup, restoreBackup } from '../server/classroom/backup.mjs';
import { loadConfig } from '../server/classroom/config.mjs';
try {
  const args = process.argv.slice(2); const mode = args.shift(); const values = new Map();
  while (args.length) { const key = args.shift(), value = args.shift(); if (!['--source', '--output'].includes(key) || !value || values.has(key)) throw Error('Проверьте аргументы'); values.set(key, value); }
  if (!values.get('--output')) throw Error('Укажите новую папку: --output ПУТЬ');
  if (mode === 'backup' && !values.has('--source')) { await createBackup({ dataDir: loadConfig().dataDir, destination: values.get('--output') }); process.stdout.write('Резервная копия создана и проверена\n'); }
  else if (mode === 'restore' && values.has('--source')) { await restoreBackup({ source: values.get('--source'), destination: values.get('--output') }); process.stdout.write('Данные восстановлены в новую папку. Войдите заново\n'); }
  else throw Error('Команды: backup --output ПАПКА; restore --source КОПИЯ --output НОВАЯ_ПАПКА');
} catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
