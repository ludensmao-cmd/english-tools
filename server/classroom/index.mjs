import { loadConfig } from './config.mjs';
import { openStore } from './database.mjs';
import { createAuth } from './auth.mjs';
import { createClassroom } from './service.mjs';
import { createAttachments } from './attachments.mjs';
import { createApp } from './http.mjs';
import { acquireDataLock } from './lock.mjs';

let store, release, server;
try {
  const config = loadConfig(); release = acquireDataLock(config.dataDir); store = openStore(config.dataDir);
  const auth = createAuth(store); const attachments = createAttachments(store, config);
  await attachments.cleanupUnlinked();
  server = createApp({ config, store, auth, classroom: createClassroom(store, { auth }), attachments });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); });
  if (config.port === 0) config.origin = `http://${config.host}:${server.address().port}`;
  process.stdout.write(`English.tools: ${config.origin}/lessons/\n`);
  let stopping = false;
  const stop = () => { if (stopping) return; stopping = true; server.closeAllConnections(); server.close(() => { store.close(); release(); }); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch (error) { store?.close(); release?.(); process.stderr.write(`Не удалось запустить кабинеты: ${error.message}\n`); process.exitCode = 1; }
