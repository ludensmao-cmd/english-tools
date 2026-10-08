export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function createApiClient({ fetchImpl = fetch } = {}) {
  let csrfToken = ''; const retries = new Map();
  async function request(path, options = {}) {
    let response;
    try { response = await fetchImpl(path, { ...options, credentials: 'same-origin' }); }
    catch { throw new ApiError(0, 'NETWORK_ERROR', 'Нет соединения. Текст и файлы остались в форме'); }
    let data;
    try { data = await response.json(); }
    catch { throw new ApiError(response.status, response.status === 404 ? 'API_UNAVAILABLE' : 'SERVER_ERROR', response.status === 404 ? 'Рабочие кабинеты доступны на локальном сервере: http://127.0.0.1:4174/lessons/' : 'Сервер не ответил. Повторите позже'); }
    if (!response.ok) throw new ApiError(response.status, data.error?.code || 'SERVER_ERROR', data.error?.message || 'Не удалось сохранить данные');
    if (data.csrfToken) csrfToken = data.csrfToken;
    return data;
  }
  return {
    session: () => request('/api/session'),
    dashboard: () => request('/api/classroom'),
    async mutate(path, input, { operationId, method = 'POST' } = {}) {
      const body = JSON.stringify(input); const signature = path + '\0' + body;
      if (/\/(assignments|submissions|feedback)$/.test(path)) { operationId ||= retries.get(signature) || crypto.randomUUID(); retries.set(signature, operationId); }
      const result = await request(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, ...(operationId ? { 'Idempotency-Key': operationId } : {}) }, body });
      retries.delete(signature);
      if (path === '/api/auth/logout' || path === '/api/auth/password') csrfToken = '';
      return result;
    },
    upload(file) {
      if (file.size > 20_000_000) return Promise.reject(new ApiError(413, 'FILE_TOO_LARGE', 'Файл должен быть не больше 20 МБ'));
      return request('/api/attachments', { method: 'POST', headers: { 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': file.type || 'application/octet-stream', 'X-CSRF-Token': csrfToken }, body: file });
    }
  };
}
