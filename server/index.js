import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { initDb, getOne, getAll, run } from './db.js'

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

app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: '모든 필드를 입력하세요.' })
  }

  const existing = getOne('SELECT id FROM users WHERE username = ?', [username])
  if (existing) {
    return res.status(409).json({ error: '이미 존재하는 아이디입니다.' })
  }

  const hashed = bcrypt.hashSync(password, 10)
  const result = run('INSERT INTO users (username, password, displayName) VALUES (?, ?, ?)', [username, hashed, displayName])

  const token = createSession(result.lastId)
  res.json({ token, user: { id: result.lastId, username, displayName } })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' })
  }

  const user = getOne('SELECT * FROM users WHERE username = ?', [username])
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' })
  }

  const token = createSession(user.id)
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName } })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getOne('SELECT id, username, displayName FROM users WHERE id = ?', [req.userId])
  res.json({ user })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '')
  if (token) delete sessions[token]
  res.json({ success: true })
})

// ════════════════════════════════════════
//  팀원 목록 API
// ════════════════════════════════════════

app.get('/api/users', authMiddleware, (req, res) => {
  const users = getAll('SELECT id, username, displayName FROM users WHERE id != ?', [req.userId])
  res.json({ users })
})

// ════════════════════════════════════════
//  할일(Todo) CRUD API
// ════════════════════════════════════════

app.get('/api/todos', authMiddleware, (req, res) => {
  const myTodos = getAll('SELECT * FROM todos WHERE ownerId = ? ORDER BY createdAt DESC', [req.userId])

  const sharedTodos = getAll(`
    SELECT t.*, u.displayName as ownerName
    FROM todos t
    JOIN shares s ON s.todoId = t.id
    JOIN users u ON u.id = t.ownerId
    WHERE s.sharedWithId = ?
    ORDER BY t.createdAt DESC
  `, [req.userId])

  const addShareInfo = (todo) => {
    const shares = getAll(`
      SELECT u.id, u.displayName
      FROM shares s JOIN users u ON u.id = s.sharedWithId
      WHERE s.todoId = ?
    `, [todo.id])
    return { ...todo, checklist: JSON.parse(todo.checklist), shares }
  }

  res.json({
    myTodos: myTodos.map(addShareInfo),
    sharedTodos: sharedTodos.map((t) => ({ ...t, checklist: JSON.parse(t.checklist), isShared: true })),
  })
})

app.post('/api/todos', authMiddleware, (req, res) => {
  const { title, status = 'todo', deadline = '', comment = '', checklist = [] } = req.body
  if (!title) return res.status(400).json({ error: '제목을 입력하세요.' })

  const result = run(
    'INSERT INTO todos (ownerId, title, status, deadline, comment, checklist) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, title, status, deadline, comment, JSON.stringify(checklist)]
  )

  const todo = getOne('SELECT * FROM todos WHERE id = ?', [result.lastId])
  res.json({ todo: { ...todo, checklist: JSON.parse(todo.checklist), shares: [] } })
})

app.put('/api/todos/:id', authMiddleware, (req, res) => {
  const todo = getOne('SELECT * FROM todos WHERE id = ?', [Number(req.params.id)])
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })

  const isSharedWith = getOne('SELECT id FROM shares WHERE todoId = ? AND sharedWithId = ?', [todo.id, req.userId])
  if (todo.ownerId !== req.userId && !isSharedWith) {
    return res.status(403).json({ error: '수정 권한이 없습니다.' })
  }

  const { title, status, deadline, comment, checklist } = req.body

  const newTitle = title !== undefined ? title : todo.title
  const newStatus = status !== undefined ? status : todo.status
  const newDeadline = deadline !== undefined ? deadline : todo.deadline
  const newComment = comment !== undefined ? comment : todo.comment
  const newChecklist = checklist !== undefined ? JSON.stringify(checklist) : todo.checklist

  run(`UPDATE todos SET title=?, status=?, deadline=?, comment=?, checklist=? WHERE id=?`,
    [newTitle, newStatus, newDeadline, newComment, newChecklist, todo.id])

  const updated = getOne('SELECT * FROM todos WHERE id = ?', [todo.id])
  res.json({ todo: { ...updated, checklist: JSON.parse(updated.checklist) } })
})

app.delete('/api/todos/:id', authMiddleware, (req, res) => {
  const todo = getOne('SELECT * FROM todos WHERE id = ?', [Number(req.params.id)])
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })
  if (todo.ownerId !== req.userId) {
    return res.status(403).json({ error: '삭제 권한이 없습니다.' })
  }

  run('DELETE FROM shares WHERE todoId = ?', [todo.id])
  run('DELETE FROM todos WHERE id = ?', [todo.id])
  res.json({ success: true })
})

// ════════════════════════════════════════
//  공유 API
// ════════════════════════════════════════

app.post('/api/todos/:id/share', authMiddleware, (req, res) => {
  const { userIds } = req.body
  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: '공유 대상을 선택하세요.' })
  }

  const todo = getOne('SELECT * FROM todos WHERE id = ?', [Number(req.params.id)])
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })
  if (todo.ownerId !== req.userId) {
    return res.status(403).json({ error: '소유자만 공유할 수 있습니다.' })
  }

  run('DELETE FROM shares WHERE todoId = ?', [todo.id])

  for (const uid of userIds) {
    if (uid !== req.userId) {
      run('INSERT OR IGNORE INTO shares (todoId, sharedWithId) VALUES (?, ?)', [todo.id, uid])
    }
  }

  const shares = getAll(`
    SELECT u.id, u.displayName
    FROM shares s JOIN users u ON u.id = s.sharedWithId
    WHERE s.todoId = ?
  `, [todo.id])

  res.json({ shares })
})

app.delete('/api/todos/:id/share', authMiddleware, (req, res) => {
  const todo = getOne('SELECT * FROM todos WHERE id = ?', [Number(req.params.id)])
  if (!todo) return res.status(404).json({ error: '할일을 찾을 수 없습니다.' })
  if (todo.ownerId !== req.userId) {
    return res.status(403).json({ error: '소유자만 공유를 해제할 수 있습니다.' })
  }

  run('DELETE FROM shares WHERE todoId = ?', [todo.id])
  res.json({ success: true })
})

// ════════════════════════════════════════

async function start() {
  await initDb()
  app.listen(PORT, () => {
    console.log(`✅ Todo Board Server running on http://localhost:${PORT}`)
  })
}

start()
