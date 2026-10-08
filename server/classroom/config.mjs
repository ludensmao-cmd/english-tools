import { resolve, dirname, basename, join, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function canonicalPath(path) {
  path = resolve(path);
  if (existsSync(path)) return realpathSync(path);
  return join(canonicalPath(dirname(path)), basename(path));
}
export function inside(path, parent) { return path === parent || path.startsWith(parent + sep); }
export function loadConfig(env = process.env) {
  const publicDir = canonicalPath(env.CLASSROOM_PUBLIC_DIR || join(root, 'dist'));
  const dataDir = canonicalPath(env.CLASSROOM_DATA_DIR || join(root, 'var/classroom'));
  if (inside(dataDir, publicDir)) throw new Error('Данные не могут находиться в публичной папке');
  const host = env.CLASSROOM_HOST || '127.0.0.1';
  const port = Number(env.CLASSROOM_PORT ?? 4174);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Некорректный порт');
  const origin = env.CLASSROOM_ORIGIN || `http://${host}:${port}`;
  const url = new URL(origin);
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Некорректный адрес приложения');
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Для внешнего адреса требуется HTTPS');
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('HTTP доступен только на локальном интерфейсе');
  return { host, port, origin, publicDir, dataDir, fileBytes: 20_000_000, maxFiles: 10, totalBytes: 50_000_000, jsonBytes: 1_048_576 };
}
