import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import db from './db.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

// ─── 세션 저장소 (메모리) ───
const sessions = {}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions[token] = { userId, createdAt: Date.now() }
  return token
}

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '')
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: '로그인이 필요합니다.' })
  }
  req.userId = sessions[token].userId
  next()
}

// ════════════════════════════════════════
//  인증 API
// ════════════════════════════════════════

// 회원가입
app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: '모든 필드를 입력하세요.' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    return res.status(409).json({ error: '이미 존재하는 아이디입니다.' })
  }

  const hashed = bcrypt.hashSync(password, 10)
  const result = db.prepare('INSERT INTO users (username, password, displayName) VALUES (?, ?, ?)').run(username, hashed, displayName)

  const token = createSession(result.lastInsertRowid)
  res.json({ token, user: { id: result.lastInsertRowid, username, displayName } })
})

// 로그인
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' })
  }

  const token = createSession(user.id)
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName } })
})

// 현재 사용자 정보
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, displayName FROM users WHERE id = ?').get(req.userId)
  res.json({ user })
})

// 로그아웃
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '')
  if (token) delete sessions[token]
  res.json({ success: true })
})

// ════════════════════════════════════════
//  팀원 목록 API
// ════════════════════════════════════════

app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, displayName FROM users WHERE id != ?').all(req.userId)
  res.json({ users })
})

// ════════════════════════════════════════
//  할일(Todo) CRUD API
// ════════════════════════════════════════

// 내 할일 + 공유받은 할일 조회
app.get('/api/todos', authMiddleware, (req, res) => {
  // 내 할일
  const myTodos = db.prepare('SELECT * FROM todos WHERE ownerId = ? ORDER BY createdAt DESC').all(req.userId)

  // 공유받은 할일
  const sharedTodos = db.prepare(`
    SELECT t.*, u.displayName as ownerName
    FROM todos t
    JOIN shares s ON s.todoId = t.id
    JOIN users u ON u.id = t.ownerId
    WHERE s.sharedWithId = ?
    ORDER BY t.createdAt DESC
  `).all(req.userId)

  // 각 할일의 공유 대상 목록 추가
  const addShareInfo = (todo) => {
    const shares = db.prepare(`
      SELECT u.id, u.displayName
      FROM shares s JOIN users u ON u.id = s.sharedWithId
      WHERE s.todoId = ?
    `).all(todo.id)
    return { ...todo, checklist: JSON.parse(todo.checklist), shares }
  }

  res.json({
    myTodos: myTodos.map(addShareInfo),
    sharedTodos: sharedTodos.map((t) => ({ ...t, checklist: JSON.parse(t.checklist), isShared: true })),
  })
})

// 할일 생성
app.post('/api/todos', authMiddleware, (req, res) => {
  const { title, status = 'todo', deadline = '', comment = '', checklist = [] } = req.body
  if (!title) return res.status(400).json({ error: '제목을 입력하세요.' })

  const result = db.prepare(
    'INSERT INTO todos (ownerId, title, status, deadline, comment, checklist) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, title, status, deadline, comment, JSON.stringify(checklist))

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid)
  res.json({ todo: { ...todo, checklist: JSON.parse(todo.checklist), shares: [] } })
})

// 할일 수정
app.put('/api/todos/:id', authMiddleware, (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })

  // 소유자이거나 공유받은 사람만 수정 가능
  const isSharedWith = db.prepare('SELECT id FROM shares WHERE todoId = ? AND sharedWithId = ?').get(todo.id, req.userId)
  if (todo.ownerId !== req.userId && !isSharedWith) {
    return res.status(403).json({ error: '수정 권한이 없습니다.' })
  }

  const { title, status, deadline, comment, checklist } = req.body
  db.prepare(`
    UPDATE todos SET
      title = COALESCE(?, title),
      status = COALESCE(?, status),
      deadline = COALESCE(?, deadline),
      comment = COALESCE(?, comment),
      checklist = COALESCE(?, checklist)
    WHERE id = ?
  `).run(
    title ?? null,
    status ?? null,
    deadline ?? null,
    comment ?? null,
    checklist !== undefined ? JSON.stringify(checklist) : null,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
  res.json({ todo: { ...updated, checklist: JSON.parse(updated.checklist) } })
})

// 할일 삭제
app.delete('/api/todos/:id', authMiddleware, (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })
  if (todo.ownerId !== req.userId) {
    return res.status(403).json({ error: '삭제 권한이 없습니다.' })
  }

  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ════════════════════════════════════════
//  공유 API
// ════════════════════════════════════════

// 할일 공유하기
app.post('/api/todos/:id/share', authMiddleware, (req, res) => {
  const { userIds } = req.body // [userId1, userId2, ...]
  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: '공유 대상을 선택하세요.' })
  }

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })
  if (todo.ownerId !== req.userId) {
    return res.status(403).json({ error: '소유자만 공유할 수 있습니다.' })
  }

  // 기존 공유 제거 후 새로 설정
  db.prepare('DELETE FROM shares WHERE todoId = ?').run(todo.id)

  const insert = db.prepare('INSERT OR IGNORE INTO shares (todoId, sharedWithId) VALUES (?, ?)')
  for (const uid of userIds) {
    if (uid !== req.userId) {
      insert.run(todo.id, uid)
    }
  }

  const shares = db.prepare(`
    SELECT u.id, u.displayName
    FROM shares s JOIN users u ON u.id = s.sharedWithId
    WHERE s.todoId = ?
  `).all(todo.id)

  res.json({ shares })
})

// 공유 해제
app.delete('/api/todos/:id/share', authMiddleware, (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })
  if (todo.ownerId !== req.userId) {
    return res.status(403).json({ error: '소유자만 공유를 해제할 수 있습니다.' })
  }

  db.prepare('DELETE FROM shares WHERE todoId = ?').run(todo.id)
  res.json({ success: true })
})

// ════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`✅ Todo Board Server running on http://localhost:${PORT}`)
})
