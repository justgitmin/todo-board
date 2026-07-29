import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'todo-board.db'))

// WAL 모드 (동시 읽기 성능 향상)
db.pragma('journal_mode = WAL')

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    displayName TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ownerId INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    deadline TEXT DEFAULT '',
    comment TEXT DEFAULT '',
    checklist TEXT DEFAULT '[]',
    source TEXT DEFAULT 'manual',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ownerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todoId INTEGER NOT NULL,
    sharedWithId INTEGER NOT NULL,
    sharedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(todoId, sharedWithId),
    FOREIGN KEY (todoId) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (sharedWithId) REFERENCES users(id)
  );
`)

export default db
