import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'todo-board.db')

let db

export async function initDb() {
  const SQL = await initSqlJs()

  // 기존 DB 파일이 있으면 로드, 없으면 새로 생성
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      displayName TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
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
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todoId INTEGER NOT NULL,
      sharedWithId INTEGER NOT NULL,
      sharedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(todoId, sharedWithId),
      FOREIGN KEY (todoId) REFERENCES todos(id),
      FOREIGN KEY (sharedWithId) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      videoId TEXT NOT NULL,
      title TEXT NOT NULL,
      channel TEXT DEFAULT '',
      thumbnail TEXT DEFAULT '',
      addedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, videoId),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `)

  saveDb()
  return db
}

export function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

export function getDb() {
  return db
}

// 헬퍼: SELECT 한 행
export function getOne(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

// 헬퍼: SELECT 여러 행
export function getAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

// 헬퍼: INSERT/UPDATE/DELETE
export function run(sql, params = []) {
  db.run(sql, params)
  saveDb()
  // sql.js에서 last_insert_rowid 가져오기
  const stmt = db.prepare("SELECT last_insert_rowid() as id")
  stmt.step()
  const lastId = stmt.getAsObject().id
  stmt.free()
  return { lastId }
}
