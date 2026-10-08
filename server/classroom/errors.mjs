export class ClassroomError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const invalid = message => new ClassroomError(422, 'INVALID_INPUT', message);
export const missing = () => new ClassroomError(404, 'NOT_FOUND', 'Запись не найдена');
export const forbidden = () => new ClassroomError(403, 'FORBIDDEN', 'Нет доступа к этому действию');
