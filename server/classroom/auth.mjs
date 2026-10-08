import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { ClassroomError, invalid, forbidden, missing } from './errors.mjs';

const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const digest = token => createHash('sha256').update(token).digest('hex');
export const safeUser = row => ({ id: row.id, role: row.role, name: row.name, username: row.username, mustChangePassword: Boolean(row.must_change_password) });
export function normalizeUsername(value) {
  if (typeof value !== 'string') throw invalid('Введите логин');
  const username = value.trim().normalize('NFKC').toLowerCase();
  if (!/^[\p{L}\p{N}._-]{3,64}$/u.test(username)) throw invalid('Логин: от 3 до 64 букв, цифр, точек, дефисов или подчёркиваний');
  return username;
}
function validatePassword(password) {
  if (typeof password !== 'string' || [...password].length < 15 || [...password].length > 128) throw invalid('Пароль должен содержать от 15 до 128 символов');
}
// One process-wide queue caps memory-intensive hashes even when several stores exist.
let running = 0; const waiters = [];
async function derive(password, salt) {
  if (running >= 2) { if (waiters.length >= 32) throw new ClassroomError(429, 'BUSY', 'Попробуйте немного позже'); await new Promise(resolve => waiters.push(resolve)); }
  else running++;
  try { return await new Promise((resolve, reject) => scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key))); }
  finally { const next = waiters.shift(); if (next) next(); else running--; }
}
async function hashPassword(password) { validatePassword(password); const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`; }
async function verify(password, encoded) {
  const [, salt, expected] = encoded.split(':');
  const key = await derive(password, salt);
  const stored = Buffer.from(expected, 'hex');
  return stored.length === key.length && timingSafeEqual(key, stored);
}
const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
const wrongLogin = () => new ClassroomError(401, 'INVALID_LOGIN', 'Неверный логин или пароль');

export function createAuth(store, { now = Date.now } = {}) {
  const { db } = store; const attempts = new Map();
  function audit(actor, action, target) { db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').run(randomUUID(), actor, action, target, new Date(now()).toISOString()); }
  function current(actor) { const row = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(actor?.id); if (!row) throw forbidden(); return row; }
  const auth = {
    async prepareUser({ role, name, username, password, mustChangePassword = true }) {
      username = normalizeUsername(username);
      if (!['teacher', 'student'].includes(role) || typeof name !== 'string' || !name.trim() || [...name.trim()].length > 100) throw invalid('Проверьте имя и роль');
      return { id: randomUUID(), role, name: name.trim(), username, passwordHash: await hashPassword(password), mustChangePassword: Boolean(mustChangePassword) };
    },
    insertPreparedUser(prepared) {
      if (db.prepare('SELECT id FROM users WHERE username=?').get(prepared.username)) throw new ClassroomError(409, 'USERNAME_EXISTS', 'Этот логин уже используется');
      db.prepare('INSERT INTO users(id,role,name,username,password_hash,must_change_password) VALUES(?,?,?,?,?,?)').run(prepared.id, prepared.role, prepared.name, prepared.username, prepared.passwordHash, Number(prepared.mustChangePassword));
      audit(prepared.id, 'user_created', prepared.id);
      return safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(prepared.id));
    },
    async createUser(input) { const prepared = await auth.prepareUser(input); return store.transaction(() => auth.insertPreparedUser(prepared)); },
    generateTemporaryPassword() { return randomBytes(18).toString('base64url'); },
    async login({ username, password, ip = 'local' }) {
      try { username = normalizeUsername(username); } catch { throw wrongLogin(); }
      const time = now(); const pair = `${ip}\0${username}`; const keys = [`ip:${ip}`, `pair:${pair}`];
      for (const [key, values] of attempts) { const live = values.filter(a => a.time > time - 900_000); if (live.length) attempts.set(key, live); else attempts.delete(key); }
      if ((attempts.get(keys[0])?.length || 0) >= 20 || (attempts.get(keys[1])?.length || 0) >= 5) throw new ClassroomError(429, 'LOGIN_LIMIT', 'Слишком много попыток. Попробуйте через 15 минут');
      const reservation = { time }; for (const key of keys) attempts.set(key, [...(attempts.get(key) || []), reservation]);
      const row = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
      const validInput = typeof password === 'string' && [...password].length >= 15 && [...password].length <= 128;
      const valid = await verify(validInput ? password : 'invalid-password-placeholder', row?.password_hash || dummy);
      if (!validInput || !valid || !row) throw wrongLogin();
      return store.transaction(() => {
        const fresh = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(row.id);
        if (!fresh || fresh.password_hash !== row.password_hash) throw wrongLogin();
        for (const key of keys) attempts.set(key, (attempts.get(key) || []).filter(a => a !== reservation));
        const token = randomBytes(32).toString('base64url'); const csrfToken = randomBytes(32).toString('base64url');
        db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
        db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token), row.id, csrfToken, now() + 28_800_000);
        return { token, csrfToken, user: safeUser(fresh) };
      });
    },
    getSession(token) {
      if (typeof token !== 'string' || token.length !== 43) return null;
      const row = db.prepare('SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(digest(token), now());
      return row ? { user: safeUser(row), csrfToken: row.csrf_token } : null;
    },
    logout(token) { if (typeof token === 'string') db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); },
    async changePassword(actor, { currentPassword, newPassword }) {
      const row = current(actor); validatePassword(newPassword); validatePassword(currentPassword);
      if (!(await verify(currentPassword, row.password_hash))) throw invalid('Текущий пароль неверен');
      if (currentPassword === newPassword) throw invalid('Выберите новый пароль');
      const hash = await hashPassword(newPassword);
      store.transaction(() => {
        if (current(actor).password_hash !== row.password_hash) throw new ClassroomError(409, 'PASSWORD_CHANGED', 'Пароль уже изменён. Войдите снова');
        db.prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?').run(hash, actor.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(actor.id); audit(actor.id, 'password_changed', actor.id);
      });
    },
    async resetStudentPassword(actor, studentId) {
      const row = current(actor); if (row.role !== 'teacher' || row.must_change_password) throw forbidden();
      if (!db.prepare('SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?').get(actor.id, studentId)) throw missing();
      const temporaryPassword = auth.generateTemporaryPassword(); const hash = await hashPassword(temporaryPassword);
      store.transaction(() => { db.prepare('UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?').run(hash, studentId); db.prepare('DELETE FROM sessions WHERE user_id=?').run(studentId); audit(actor.id, 'password_reset', studentId); });
      return { temporaryPassword };
    }
  };
  return auth;
}
