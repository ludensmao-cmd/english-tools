# English.tools Classroom Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Native execution is recommended here; the user must review the plan and select the execution method before implementation.

**Goal:** Сделать рабочий обмен занятиями, домашними заданиями, вложениями и отзывами между отдельными учётными записями ученика и преподавателя.

**Architecture:** Один локальный Node.js-сервер обслуживает существующий `dist` и защищённый учебный API. SQLite и файлы находятся вне публичной папки; доступ определяется серверной сессией и связью преподавателя с учеником. Публичный каталог сохраняется, а демонстрационные записи кабинетов заменяются данными API.

**Tech Stack:** Установленный Node.js v26.8.1, `node:sqlite` (`DatabaseSync`, `backup` — проверены локально), `node:crypto`, `node:http`, `node:fs`, `node:test`; существующие HTML/CSS/JavaScript. npm-зависимости не устанавливаются.

**Spec:** [Согласованная схема](../specs/2026-10-08-classroom-backend-design.md).

Статус: план подготовлен для просмотра; код ещё не написан. Вход по логину и паролю — рабочее предположение из согласованной схемы. Если пользователь ответит на открытый вопрос выбором Telegram, перед реализацией пересмотреть задачу 2 и экран входа.

## Global Constraints

- Вход, права и данные кабинетов добавляются в собственный English.tools; Moneyflow не используется.
- «Текущие главная, каталог, блог, ИИ-урок, бренд и цвета сохраняются. Открытая часть сайта остаётся без регистрации».
- Новая версия запускается на `127.0.0.1:4174`; текущий просмотр на `4173` не останавливается.
- «До 20 МБ на файл, до 10 файлов на задание или ответ, до 50 МБ суммарно»: в реализации МБ = 1 000 000 байт.
- «База и файлы не лежат в публичном каталоге»; исключить весь `var/classroom/` и `backups/classroom/` из Git, включая журналы SQLite и служебные файлы.
- Роль берётся из серверной учётной записи; URL `?role=teacher` ничего не разрешает.
- Самостоятельная регистрация, оплата, автоматическое списание уроков, Telegram, MCP и словарный API не входят в этот план.
- Прежняя IndexedDB не очищается и не переносится. Примерные ученики создаются только в отдельных тестовых папках.
- Перед выполнением использовать `using-git-worktrees`; при изоляции работать с одним и тем же выбранным checkout до конца. Код не писать в текущем обсуждении плана.

## Review Focus

1. Повторная отправка после потерянного ответа сервера: одно задание/ответ, конфликт при повторном ключе с иным содержимым — задача 3.
2. Окончившаяся сессия посреди домашки: текст и выбранные файлы остаются в форме; нет ложного успеха — задачи 4–5.
3. Подмена ученика или идентификатора вложения: чужая запись недоступна, даже если идентификатор известен — задачи 3–4.
4. Незавершённая загрузка, кириллица в имени, HTML под видом картинки: нет повреждённого ответа, выхода из папки или исполнения HTML — задача 4.
5. Восстановление базы без нужного файла: резервная копия не объявляется пригодной; существующая папка никогда не перезаписывается — задача 6.

## Файлы и границы модулей

| Файл | Ответственность |
| --- | --- |
| `server/classroom/config.mjs` | Порты, абсолютные папки, ограничения и проверка окружения |
| `server/classroom/database.mjs`, `migrations/001_classroom.sql` | База, миграция, транзакции и внешние ключи |
| `server/classroom/errors.mjs` | `ClassroomError(status, code, message)` для ожидаемых ошибок |
| `server/classroom/auth.mjs` | Учётные записи, пароли, сессии, сброс доступа и ограничение входа |
| `server/classroom/service.mjs` | Учебные действия, права на конкретные записи и безопасные DTO |
| `server/classroom/attachments.mjs` | Потоковая загрузка, приватные файлы и скачивание |
| `server/classroom/http.mjs`, `index.mjs` | HTTP, cookie, CSRF, публичная статика и запуск приложения |
| `server/classroom/backup.mjs` | Согласованная резервная копия и восстановление в новую папку |
| `scripts/classroom_admin.mjs`, `classroom_backup.mjs` | Локальное создание первой учётной записи и резервные копии |
| `dist/lessons/login.html`, `auth.css`, `classroom-api.mjs` | Вход, смена временного пароля и браузерный клиент API |
| `dist/lessons/index.html`, `lessons.js`, `classroom-lobby.css` | Существующие кабинеты с реальными данными и необходимыми формами |
| `tests/classroom/helpers.mjs`, `*.test.mjs` | Изолированные базы, два HTTP-клиента и проверки функций/сценариев |

## Общие контракты

- `Actor = {id, role: 'student'|'teacher', name, mustChangePassword}`. Это результат авторизации, а не поля из тела запроса. `User = Actor & {username}` — безопасная учётная запись без хеша пароля.
- `StudentDto = {id, name, username, level, remainingLessons}`. Пароль возвращается отдельно и единожды при создании/сбросе доступа.
- `AttachmentDto = {id, name, size, contentType, previewable, downloadUrl}`. Пути на диске и чужие идентификаторы не возвращаются.
- `LessonDto = {id, studentId, title, startAt, durationMinutes, status, summary, vocabulary, materials}`. `startAt` — ISO 8601 UTC; `status` — `scheduled|completed|cancelled`; слово — `{word, meaning, example}`, материал — `{title, url|null, attachmentId|null}`.
- `AssignmentDto = {id, lessonId, studentId, title, description, dueAt|null, attachments, submission|null}`; ответ — `{id, assignmentId, text, attachments, submittedAt, feedback|null}`; отзыв — `{text, reviewedAt}`.
- `DashboardDto = {user, students, lessons, assignments}`: ученик получает пустой `students` и только своё; преподаватель — только назначенных учеников и их записи.
- Ошибки: JSON `{error:{code,message}}`; 401 — нет действующей сессии, 403 — действие не для этой роли/не сменён временный пароль/CSRF, 404 — нет доступной конкретной записи, 409 — конфликт, 413 — размер, 422 — поля. Не отдавать стек и внутренние пути.
- Для создания задания, ответа и отзыва клиент передаёт UUID в `Idempotency-Key`; одна и та же операция с тем же содержимым возвращает прежний результат. Изменённое содержание с тем же ключом даёт 409.
- Успех записи — только после завершённой транзакции. Все строки отображаются как текст; ссылка допускает только `https:` или `http:`.

---

### Task 1: Файловая база и проверяемые связи

**Files:** Create `server/classroom/config.mjs`, `database.mjs`, `errors.mjs`, `migrations/001_classroom.sql`, `tests/classroom/helpers.mjs`, `database.test.mjs`; Modify `.gitignore`.

**Interfaces:** Produces `loadConfig(env = process.env) -> Config {host,port,origin,dataDir,publicDir,fileBytes,maxFiles,totalBytes,jsonBytes}`; `openStore(dataDir, {readOnly=false}={}) -> Store {db,dataDir,transaction(fn),close()}`; `ClassroomError(status,code,message)`; test helper `tempDataDir(t) -> absolutePath`.

- [ ] **Step 1: Написать `database.test.mjs`:** `persists_after_reopen` проверяет неизменность записанного пользователя; `rejects_broken_relationship` ожидает ошибку FK для задания без занятия; `rolls_back_partial_write` проверяет ноль записей после ошибки в `transaction`; `readonly_rejects_insert` ожидает отказ записи; `rejects_public_data_dir` ожидает отказ папки внутри `dist`.

```js
// persists_after_reopen: после записи, close() и нового openStore той же папки
assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
// rolls_back_partial_write: после исключения внутри transaction
assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM lessons').get().n, 0);
```
- [ ] **Step 2: Запустить** `node --test tests/classroom/database.test.mjs`. Ожидается FAIL из-за отсутствующего модуля.
- [ ] **Step 3: Реализовать конфигурацию, миграцию и Store.** Таблицы: `users`, `teacher_students`, `lessons`, `lesson_words`, `lesson_materials`, `assignments`, `submissions`, `feedback`, `attachments`, `sessions`, `operations`, `audit_events`, `schema_migrations`. ID — UUID; `users.role` имеет CHECK; `teacher_students` имеет уникального ученика и составную пару `(teacher_id,student_id)`; занятия ссылаются на эту пару. Включить foreign keys и busy timeout 5000 мс. Транзакционный callback синхронный: хеширование/файлы выполняются до него. Миграция не вставляет учеников.
- [ ] **Step 4: Установить значения Config:** `host=127.0.0.1`, `port=4174`, `dataDir=var/classroom`, `publicDir=dist`, `fileBytes=20_000_000`, `maxFiles=10`, `totalBytes=50_000_000`, `jsonBytes=1_048_576`; существующие файлы не очищаются. Допустить порт 0 в тестах. В `.gitignore` добавить `/var/classroom/` и `/backups/classroom/`.
- [ ] **Step 5: Повторить проверку задачи:** все тесты PASS. `git check-ignore var/classroom/uploads/example.png var/classroom/classroom.sqlite-wal` должен вывести оба пути.
- [ ] **Step 6: Commit:** только конфигурация, схема, Store, ошибки, helper, тесты и `.gitignore`; сообщение `feat: add classroom storage and ownership schema`.

### Task 2: Учётные записи и настоящие сессии

**Files:** Create `server/classroom/auth.mjs`, `scripts/classroom_admin.mjs`, `tests/classroom/auth.test.mjs`.

**Interfaces:** Consumes Store и ClassroomError. Produces `createAuth(store,{now=Date.now}={}) -> Auth`; методы `prepareUser({role,name,username,password,mustChangePassword}) -> Promise<PreparedUser>`, `insertPreparedUser(prepared) -> User`, `createUser(input) -> Promise<User>`, `generateTemporaryPassword() -> string`, `login({username,password,ip}) -> Promise<{token,csrfToken,user}>`, `getSession(token) -> {user,csrfToken}|null`, `logout(token) -> void`, `changePassword(actor,{currentPassword,newPassword}) -> Promise<void>`, `resetStudentPassword(actor,studentId) -> Promise<{temporaryPassword}>`. `PreparedUser = {id,role,name,username,passwordHash,mustChangePassword}` — только внутри сервера. `createUser` объединяет подготовку и вставку; публичного endpoint для произвольной роли нет.

- [ ] **Step 1: Написать тесты:** `salts_equal_passwords_differently` проверяет разные хеши и отсутствие исходного пароля в записи; `unknown_and_wrong_login_same_error` сравнивает код/сообщение; `session_expires` с часами `now` проверяет отказ через 8 часов; `temporary_password_blocks_classroom` проверяет `mustChangePassword`; `reset_revokes_all_sessions` и `student_cannot_reset_other_user` проверяют отзыв и 403.

```js
// session_expires: t0 задан через now, затем часы передвинуты на 8 часов
assert.equal(auth.getSession(login.token), null);
// reset_revokes_all_sessions: после сброса пароля нужного ученика
assert.equal(auth.getSession(firstLogin.token), null);
assert.equal(auth.getSession(secondLogin.token), null);
```
- [ ] **Step 2: Запустить** `node --test tests/classroom/auth.test.mjs`; ожидается FAIL из-за отсутствующего Auth.
- [ ] **Step 3: Реализовать Auth.** Асинхронный `scrypt`: N=131072, r=8, p=1, maxmem=256 MiB, случайная соль минимум 16 байт, результат 64 байта; сравнение constant time. Проверять пароль целиком, без trim/тихого усечения: 15–128 Unicode-символов. Логин: trim, NFKC, lower case; 3–64 символа, буквы/цифры/`._-`, включая кириллицу. Временный пароль — случайные 24 base64url-символа.
- [ ] **Step 4: Реализовать сессии и восстановление.** Токен 32 случайных байта; в базе SHA-256 токена, независимый CSRF-token и срок 8 часов. Смена/сброс пароля отзывает все сессии. Лимит неудачных входов: 5 на пару IP/логин и 20 на IP за 15 минут; превышение 429, проверка до дорогого хеширования. Отдельным тестом `login_throttles_with_fake_clock` подтвердить истечение окна; одновременно хешировать не более двух паролей.
- [ ] **Step 5: Реализовать CLI** `node scripts/classroom_admin.mjs create-teacher --username teacher --name Преподаватель`: скрытый интерактивный ввод пароля, отказ от передачи пароля аргументом, отказ менять уже существующего пользователя. Тест `admin_output_contains_no_password` проверяет вывод и отсутствие пароля в audit/log. Настоящую первую запись создавать только при настройке владельцем; тесты создают свою в tempDataDir.
- [ ] **Step 6: Запустить тесты задачи 1–2:** оба файла PASS; commit `feat: add classroom login sessions and access recovery`.

### Task 3: Занятия, домашнее задание и отзыв для нужного ученика

**Files:** Create `server/classroom/service.mjs`, `tests/classroom/service.test.mjs`, `access.test.mjs`.

**Interfaces:** Consumes Store/Auth/Actor. Produces `createClassroom(store,{auth,now=Date.now}={}) -> ClassroomService`; методы `createStudent(actor,{name,username,level,remainingLessons}) -> Promise<{student,temporaryPassword}>`, `updateStudent(actor,id,{level,remainingLessons}) -> StudentDto`, `createLesson(actor,{studentId,title,startAt,durationMinutes}) -> LessonDto`, `completeLesson(actor,id,{summary,vocabulary,materials}) -> LessonDto`, `assignHomework(actor,lessonId,input,operationId) -> AssignmentDto`, `submitAnswer(actor,assignmentId,input,operationId) -> SubmissionDto`, `reviewAnswer(actor,submissionId,{text},operationId) -> FeedbackDto`, `dashboard(actor) -> DashboardDto`, `resolveAttachmentAccess(actor,id) -> internalMetadata`. `input` задания/ответа содержит `attachmentIds`, а не дисковые пути.

- [ ] **Step 1: Написать `complete_teacher_student_flow`:** создать преподавателя и двух учеников, занятие, задание, ответ и отзыв; `assert.equal(studentDashboard.assignments[0].submission.feedback.text, expectedText)`; чужой dashboard не содержит записей. `repeat_operation_same_id` сравнивает ID двух отправок и количество строк = 1; `repeat_operation_changed_body` ожидает 409.

```js
// repeat_operation_same_id: повтор submitAnswer с тем же operationId и входом
assert.equal(repeated.id, original.id);
assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 1);
// manual_balance_only: после создания и завершения урока остаток не списывается
assert.equal(service.dashboard(teacher).students[0].remainingLessons, 5);
```
- [ ] **Step 2: Запустить** `node --test tests/classroom/service.test.mjs tests/classroom/access.test.mjs`; ожидается FAIL из-за отсутствующего сервиса.
- [ ] **Step 3: Реализовать учебные методы и DTO.** Проверять Actor и пару владельцев в каждой операции; студент не создаёт уроки/учеников, посторонние IDs дают 404. Создание ученика: временный пароль через Auth.generateTemporaryPassword, `await auth.prepareUser` до транзакции, затем `auth.insertPreparedUser` и связь преподавателя в одной синхронной транзакции; тест `student_creation_failure_leaves_no_account` проверяет полный откат. Уровень — A1/A2/B1/B2/C1/C2, остаток занятий — целое неотрицательное число; тест `manual_balance_only` проверяет сохранение остатка после урока. Название задания до 80 символов, описание 8–20 000, ответ до 20 000 и не пустой без файлов, отзыв 8–20 000; время ISO UTC, длительность — положительное целое до 240 минут. Завершённый урок содержит саммари, массив слов и материалов; URI `javascript:` запрещён. Тест `rejects_ambiguous_date_and_unsafe_material_url` проверяет отказ от даты без часового пояса и небезопасной ссылки.
- [ ] **Step 4: Реализовать атомарную запись и операции повторной отправки.** Внешний UUID ключа обязателен для трёх операций из общего контракта; сохранять отпечаток нормализованного входа и результат вместе с записью. Вложения связывать в той же транзакции: владелец — Actor, состояние — принятый файл, правильный лимит числа/суммы. SQL rollback не оставляет успешного ответа. Отзыв связывается с выбранным submissionId, без специальных имён учеников.
- [ ] **Step 5: Дополнить проверки:** `other_teacher_cannot_review`, `foreign_student_cannot_submit`, `cross_student_assignment_link_rejected`, `missing_file_reference_rejected`, `rollback_keeps_previous_state`, `completed_lesson_exposes_repeat_data`, `blank_homework_state_is_empty`. Все должны PASS; ошибки не возвращают чужие поля.
- [ ] **Step 6: Commit:** сервис и тесты; `feat: add shared lessons homework and feedback`.

### Task 4: Приватные файлы и защищённый HTTP API

**Files:** Create `server/classroom/attachments.mjs`, `http.mjs`, `index.mjs`, `tests/classroom/http.test.mjs`, `attachments.test.mjs`; Modify `tests/classroom/helpers.mjs`, `package.json`.

**Interfaces:** Consumes Config/Store/Auth/ClassroomService. Produces `createAttachments(store,config) -> AttachmentService` с `receive(actor,{name,contentType,stream}) -> Promise<AttachmentDto>`, `open(actor,id,{preview=false}={}) -> {stream,headers}`, `cleanupUnlinked({olderThan}) -> Promise<number>`; `createApp({config,store,auth,classroom,attachments}) -> http.Server`; helper `httpFixture(t) -> {origin,teacher,student,otherStudent,stop(),dataDir}`, где каждый HTTP-клиент имеет своё cookie-хранилище.

- [ ] **Step 1: Написать тесты:** `unauthenticated_requests_401`, `session_role_not_query_role`, `csrf_and_foreign_origin_rejected`, `download_foreign_attachment_404`, `download_bytes_equal_upload`, `private_paths_not_static`. Для файлов: `upload_20mb_allowed`, `upload_over_20mb_413`, `aborted_upload_not_ready`, `ten_files_allowed_eleven_rejected`, `sum_over_50mb_rejected`, `html_named_png_never_inline`, `cyrillic_filename_preserved`.

```js
// download_bytes_equal_upload: response доступен отправившему файл ученику
assert.deepEqual(Buffer.from(await response.arrayBuffer()), uploadedBytes);
// download_foreign_attachment_404: другой клиент запрашивает тот же ID
assert.equal(foreignResponse.status, 404);
// upload_over_20mb_413: фактически отправлено 20_000_001 байт
assert.equal(tooLargeResponse.status, 413);
```
- [ ] **Step 2: Запустить** `node --test tests/classroom/http.test.mjs tests/classroom/attachments.test.mjs`; ожидается FAIL из-за отсутствующих адаптеров.
- [ ] **Step 3: Реализовать загрузку и выдачу.** Принимать по одному файлу бинарным POST с `X-File-Name` в percent-encoded UTF-8; сохранять поток во временный файл под случайным именем, проверять фактический размер и завершение, затем фиксировать запись. Брошенный запрос не становится доступным вложением. Превью только JPEG/PNG/WebP/GIF с подходящей сигнатурой; всё остальное скачивается как attachment. Имена в заголовках очищаются от путей/управляющих символов и кодируются через `filename*`; ставить `nosniff`, `Cache-Control: no-store` и запрет исполнения. Очистка касается только непривязанных файлов старше 24 часов.
- [ ] **Step 4: Реализовать маршруты** по таблице ниже, серверную cookie `classroom_session` с `HttpOnly; SameSite=Lax; Path=/` и CSRF-header `X-CSRF-Token` для действий с действующей сессией. Сам логин проверяет Origin, но не требует токена ещё не созданной сессии. Secure-cookie обязательна для будущего HTTPS; локальный HTTP допускается только на loopback. Проверять Host и Origin относительно `config.origin`, запретить CORS для сторонних адресов. IP брать из socket, не из пользовательского X-Forwarded-For. GET session не выдаёт cookie-токен; все учебные endpoints запрещены до смены временного пароля. JSON ограничен Config, ошибки унифицированы, журнал не содержит тела запросов и секретов.
- [ ] **Step 5: Реализовать безопасную статику и запуск.** `/lessons/` без сессии направляет на вход; публичные страницы остаются без входа, `/var/`, dotfiles и выход за `dist` недоступны. `npm run classroom` запускает `node server/classroom/index.mjs` на 4174; SIGTERM закрывает соединение. Два пишущих сервера для одной dataDir запрещены локальной блокировкой; не удалять чужую активную блокировку и не убивать процессы.
- [ ] **Step 6: Повторить все тесты задач 1–4:** PASS; commit `feat: add protected classroom api and attachments`.

| Method / path | Сервис и результат |
| --- | --- |
| POST `/api/auth/login` | Auth.login; Set-Cookie; user и csrfToken |
| GET `/api/session` | Auth.getSession; user и csrfToken |
| POST `/api/auth/logout` | Отозвать токен и очистить cookie |
| POST `/api/auth/password` | Auth.changePassword; завершить сессию |
| POST `/api/students/:id/reset-password` | Auth.resetStudentPassword |
| GET `/api/classroom` | ClassroomService.dashboard |
| POST `/api/students`, PATCH `/api/students/:id` | Создать ученика / изменить уровень и остаток |
| POST `/api/lessons`, PATCH `/api/lessons/:id/complete` | Создать / завершить занятие |
| POST `/api/lessons/:id/assignments` | Назначить домашку, Idempotency-Key |
| POST `/api/assignments/:id/submissions` | Отправить ответ, Idempotency-Key |
| POST `/api/submissions/:id/feedback` | Отзыв, Idempotency-Key |
| POST `/api/attachments` | Принять файл, AttachmentDto |
| GET `/api/attachments/:id` | Скачать; `?preview=1` только для безопасного изображения |

### Task 5: Подключение существующих экранов к общей базе

**Files:** Create `dist/lessons/login.html`, `auth.css`, `classroom-api.mjs`, `tests/classroom/client.test.mjs`; Modify `dist/lessons/index.html`, `lessons.js`, `classroom-lobby.css`.

**Interfaces:** Consumes HTTP API и DTO. Produces `createApiClient({fetchImpl=fetch}={}) -> Client` из `classroom-api.mjs`: `session()`, `dashboard()`, `mutate(path,input,{operationId}={})`, `upload(file)`; `ApiError {status,code,message}`. Класс хранит csrfToken в памяти; cookie обрабатывает браузер. `lessons.js` — `type=module`, использует Client и существующие диалоги.

- [ ] **Step 1: Написать тесты клиента:** `sends_csrf_and_credentials`, `retains_operation_key_for_retry`, `expired_session_returns_401_not_success`, `upload_preserves_file_name`, `server_error_not_empty_success`; fake fetch проверяет настоящий формат запросов/ошибок, без тестов, повторяющих вёрстку.

```js
// sends_csrf_and_credentials: после Client.session() и mutate
assert.equal(request.options.credentials, 'same-origin');
assert.equal(request.options.headers['X-CSRF-Token'], session.csrfToken);
// expired_session_returns_401_not_success: подставленный fetch вернул HTTP 401
await assert.rejects(client.mutate(path, input), {status: 401});
```
- [ ] **Step 2: Запустить** `node --test tests/classroom/client.test.mjs`; ожидается FAIL из-за отсутствующего клиента.
- [ ] **Step 3: Реализовать вход и Client.** Вход/обязательная смена пароля/выход в текущей палитре и Manrope, связанные labels и autocomplete. Пароль/сессии не сохранять в localStorage. Учитывать отсутствие серверного API при обычном статическом просмотре: понятное сообщение о запуске рабочих кабинетов, без фиктивного сохранения и автоматического ухода на несуществующую страницу.
- [ ] **Step 4: Подключить кабинеты.** Убрать установку роли из URL и подставные имена/даты/ответы; до загрузки показывать ожидание. По session.user.role оставить свой экран и меню. Преподавателю добавить формы создания ученика/занятия, завершения занятия с саммари/словами/материалами, выдачи и сброса доступа. Существующие формы домашки и отзыва направить к API; очередь проверки выбирает реальный submissionId. Ученик выбирает назначенную домашку, отправляет ответ и читает отзыв; три диалога читают последний завершённый урок. Временный пароль показывать преподавателю единожды, не в списке учеников.
- [ ] **Step 5: Обработать сохранение.** Во время отправки блокировать повторное нажатие; держать operationId для повторного запроса с тем же телом. Ошибка/401 оставляет текст и выбор файлов; вход для восстановления сессии доступен отдельно, без уничтожения текущей формы. После нового входа получить Client.session() и новый CSRF-token до повторной отправки; подтверждение чужой учётной записи не отправляет старую домашку автоматически. Очистить форму только после подтверждённого результата. Отказ/лимиты объяснить на русском; длинные имена файлов переносятся, меню другой роли отсутствует. Текст вставляется через textContent, URL проверяется до рендера.
- [ ] **Step 6: Проверить клиент и источники:** `node --test tests/classroom/client.test.mjs`, затем `npm run check` — PASS. В разрешённом браузере пройти сценарий из Review Focus 2 и три диалога, клавиатуру/Escape, ширины 390 и 1440 px. Если административная проверка браузера откажет, не обходить её и пометить визуальную приёмку невыполненной.
- [ ] **Step 7: Commit:** только кабинет, Client и тесты; `feat: connect student and teacher cabinets to shared data`.

### Task 6: Восстановление и сквозная приёмка

**Files:** Create `server/classroom/backup.mjs`, `scripts/classroom_backup.mjs`, `tests/classroom/backup.test.mjs`, `e2e.test.mjs`, `docs/classroom-setup.md`; Modify `package.json`, `README.md`, `prd.md`, `design/classroom-lobby-2026-10-07.md`.

**Interfaces:** Consumes Store/Config/httpFixture. Produces `createBackup({dataDir,destination}) -> Promise<{manifestPath}>`, `restoreBackup({source,destination}) -> Promise<void>`; manifest содержит относительные имена, размеры и SHA-256 базы/привязанных файлов. Destination должна быть новой папкой вне публичного каталога; пути из manifest проверяются.

- [ ] **Step 1: Написать проверки:** `backup_restores_all_linked_files`, `missing_attachment_rejects_backup`, `bad_hash_rejects_restore`, `existing_destination_never_overwritten`, `active_server_refuses_backup`; `full_flow_after_restart` выполняет HTTP-цепочку двумя клиентами, перезапускает сервер и сравнивает текст отзыва и байты файлов. `foreign_student_still_denied_after_restore` подтверждает права после восстановления.

```js
// full_flow_after_restart: dashboard получен после нового входа в новый процесс
assert.equal(dashboard.assignments[0].submission.feedback.text, 'Повтори эти три фразы');
// backup_restores_all_linked_files: файл прочитан из восстановленной папки
assert.deepEqual(restoredBytes, uploadedBytes);
// existing_destination_never_overwritten: папка уже содержит данные
await assert.rejects(restoreBackup({source, destination}), {code: 'DESTINATION_EXISTS'});
```
- [ ] **Step 2: Запустить** `node --test tests/classroom/backup.test.mjs tests/classroom/e2e.test.mjs`; ожидается FAIL из-за отсутствующего backup.
- [ ] **Step 3: Реализовать backup/restore и CLI.** Сначала остановить сервер: блокировка активного сервера запрещает команду, без принудительного снятия. Использовать встроенный `sqlite.backup`, затем копировать необходимые вложения и формировать manifest, проверяя размеры/хеши. Не копировать `.sqlite` поверх работающего WAL произвольным cp. Восстановление только в новую папку, проверки до запуска; старые сессии при восстановлении отзываются. CLI: `backup --output <new-dir>` и `restore --source <backup-dir> --output <new-data-dir>`.
- [ ] **Step 4: Добавить команды:** `check:classroom = node --test --test-concurrency=1 tests/classroom/*.test.mjs`, `classroom:admin = node scripts/classroom_admin.mjs`, `classroom:backup = node scripts/classroom_backup.mjs`. В документации объяснить создание первой учётной записи, выдачу доступа, старт на 4174, перезапуск и восстановление. Публичные npm start/preview/check/build остаются. Описывать только фактически выполненные сценарии; лимиты, локальный статус и отсутствие Telegram/MCP указать явно.
- [ ] **Step 5: Запустить** `npm run check:classroom`, затем `npm run check`; оба завершаются кодом 0. `git diff -- dist/index.html dist/brand dist/home-ready.css dist/catalog-lobby.css` пустой. Проверить список готовящегося коммита: нет var, загрузок, базы, паролей, секретов и личных записей. Отдельная проверка браузера из задачи 5 остаётся обязательной для заявления о полной готовности.
- [ ] **Step 6: Выполнить независимую проверку реализации по согласованному способу выполнения**, исправить существенные замечания и повторить затронутые проверки. Обновить чекбоксы только по фактам; commit `feat: add classroom backup and verify shared learning flow`.

## Порядок и принятие решения о выполнении

Задачи выполняются 1 → 2 → 3 → 4 → 5 → 6: общие интерфейсы и ограничения тесно связаны. Рекомендую Native — основной агент выполняет задачи здесь по очереди, затем независимый агент проверяет итоговую реализацию. Вариант Subagent-driven — отдельный исполнитель и отдельный проверяющий на каждую задачу; больше независимых проверок, но больше передач контекста.

Выбор способа и просмотр этого плана требуются перед написанием кода. Согласование схемы не отмечает тесты, вход и сервер уже выполненными. После завершения этого плана отдельно проектируем DBeaver, Telegram, словарь/карточки и MCP.

## Источники технических решений

- [OWASP: Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — параметры scrypt при использовании этого алгоритма; наличие `crypto.scrypt` проверено на установленном Node.js.
- [Node.js: sqlite.backup](https://nodejs.org/api/sqlite.html#sqlitebackupsource-dbpath-options) — согласованное копирование базы; экспорт `backup` и `DatabaseSync` проверен локально.
- Существующие `dist/lessons/index.html`, `lessons.js`, проверка `scripts/check_site_sources.py` и `.gitignore` прочитаны перед составлением плана.
