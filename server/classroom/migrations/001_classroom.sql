CREATE TABLE users (
 id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('teacher','student')),
 name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN(0,1)),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1))
);
CREATE TABLE teacher_students (
 teacher_id TEXT NOT NULL REFERENCES users(id), student_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 level TEXT NOT NULL CHECK(level IN('A1','A2','B1','B2','C1','C2')),
 remaining_lessons INTEGER NOT NULL CHECK(remaining_lessons>=0),
 PRIMARY KEY(teacher_id,student_id)
);
CREATE TABLE lessons (
 id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, student_id TEXT NOT NULL,
 title TEXT NOT NULL, start_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 240),
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','completed','cancelled')),
 summary TEXT NOT NULL DEFAULT '', UNIQUE(id,student_id,teacher_id),
 FOREIGN KEY(teacher_id,student_id) REFERENCES teacher_students(teacher_id,student_id)
);
CREATE TABLE lesson_words (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), position INTEGER NOT NULL,
 word TEXT NOT NULL, meaning TEXT NOT NULL, example TEXT NOT NULL DEFAULT ''
);
CREATE TABLE lesson_materials (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), position INTEGER NOT NULL,
 title TEXT NOT NULL, url TEXT, attachment_id TEXT REFERENCES attachments(id),
 CHECK((url IS NOT NULL) != (attachment_id IS NOT NULL))
);
CREATE TABLE assignments (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, student_id TEXT NOT NULL, teacher_id TEXT NOT NULL,
 title TEXT NOT NULL, description TEXT NOT NULL, due_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,student_id), FOREIGN KEY(lesson_id,student_id,teacher_id) REFERENCES lessons(id,student_id,teacher_id)
);
CREATE TABLE submissions (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL UNIQUE, student_id TEXT NOT NULL, text TEXT NOT NULL,
 submitted_at TEXT NOT NULL, FOREIGN KEY(assignment_id,student_id) REFERENCES assignments(id,student_id)
);
CREATE TABLE feedback (
 submission_id TEXT PRIMARY KEY REFERENCES submissions(id), teacher_id TEXT NOT NULL REFERENCES users(id),
 text TEXT NOT NULL, reviewed_at TEXT NOT NULL
);
CREATE TABLE attachments (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, storage_name TEXT NOT NULL UNIQUE,
 size INTEGER NOT NULL CHECK(size>=0), content_type TEXT NOT NULL, previewable INTEGER NOT NULL CHECK(previewable IN(0,1)),
 status TEXT NOT NULL CHECK(status IN('accepted')), created_at INTEGER NOT NULL,
 assignment_id TEXT REFERENCES assignments(id), submission_id TEXT REFERENCES submissions(id), lesson_id TEXT REFERENCES lessons(id),
 CHECK((assignment_id IS NOT NULL)+(submission_id IS NOT NULL)+(lesson_id IS NOT NULL)<=1)
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE operations (
 actor_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, kind TEXT NOT NULL, body_hash TEXT NOT NULL, result TEXT NOT NULL,
 PRIMARY KEY(actor_id,operation_id)
);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, target_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);
INSERT INTO schema_migrations VALUES(1);
CREATE INDEX assignments_student ON assignments(student_id);
CREATE INDEX lessons_student ON lessons(student_id,start_at);
CREATE INDEX sessions_user ON sessions(user_id);
