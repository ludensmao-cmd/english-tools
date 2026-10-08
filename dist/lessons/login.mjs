import { createApiClient } from './classroom-api.mjs';
const api = createApiClient(); const $ = id => document.getElementById(id);
const show = (message, error = false) => { $('auth-result').textContent = message; $('auth-result').classList.toggle('error', error); };
function changeScreen(user) {
  if (!user.mustChangePassword) { location.replace('/lessons/'); return; }
  $('login-form').hidden = true; $('password-form').hidden = false;
  $('auth-title').textContent = 'Придумайте свой пароль'; $('auth-description').textContent = 'Временный пароль нужно заменить при первом входе'; $('current-password').focus();
}
async function busy(form, action) { const button = form.querySelector('button'); button.disabled = true; try { await action(); } catch (e) { show(e.message, true); } finally { button.disabled = false; } }
$('login-form').addEventListener('submit', event => { event.preventDefault(); busy(event.currentTarget, async () => { const result = await api.mutate('/api/auth/login', { username: $('username').value, password: $('password').value }); $('password').value = ''; show(''); changeScreen(result.user); }); });
$('password-form').addEventListener('submit', event => { event.preventDefault(); busy(event.currentTarget, async () => { if ($('new-password').value !== $('confirm-password').value) throw new Error('Пароли не совпадают'); await api.mutate('/api/auth/password', { currentPassword: $('current-password').value, newPassword: $('new-password').value }); event.target.reset(); $('password-form').hidden = true; $('login-form').hidden = false; $('auth-title').textContent = 'Пароль сохранён'; $('auth-description').textContent = 'Войдите с новым паролем'; show(''); $('password').focus(); }); });
api.session().then(result => changeScreen(result.user)).catch(e => { if (e.status !== 401) show(e.message, true); });
