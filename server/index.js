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

// ─── SSE 클라이언트 저장소 ───
const sseClients = new Map() // userId -> Set of response objects

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

function adminMiddleware(req, res, next) {
  const user = getOne('SELECT isAdmin FROM users WHERE id = ?', [req.userId])
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' })
  }
  next()
}

// SSE: 특정 사용자에게 이벤트 전송
function notifyUser(userId, event, data) {
  const clients = sseClients.get(userId)
  if (clients) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    clients.forEach((res) => res.write(msg))
  }
}

// SSE: 할일 관련 사용자들에게 알림 (소유자 + 공유 대상)
function notifyTodoUpdate(todoId, excludeUserId) {
  const todo = getOne('SELECT * FROM todos WHERE id = ?', [todoId])
  if (!todo) return

  const shares = getAll('SELECT sharedWithId FROM shares WHERE todoId = ?', [todoId])
  const userIds = [todo.ownerId, ...shares.map((s) => s.sharedWithId)]
    .filter((id) => id !== excludeUserId)

  userIds.forEach((uid) => notifyUser(uid, 'refresh', { todoId }))
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

  const newUser = getOne('SELECT id, username, displayName, isAdmin FROM users WHERE username = ?', [username])
  const token = createSession(newUser.id)
  res.json({ token, user: { id: newUser.id, username: newUser.username, displayName: newUser.displayName, isAdmin: !!newUser.isAdmin } })
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
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: !!user.isAdmin } })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getOne('SELECT id, username, displayName, isAdmin FROM users WHERE id = ?', [req.userId])
  res.json({ user: { ...user, isAdmin: !!user.isAdmin } })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '')
  if (token) delete sessions[token]
  res.json({ success: true })
})

// 프로필 이름 변경
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { displayName } = req.body
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: '이름을 입력하세요.' })
  }
  run('UPDATE users SET displayName = ? WHERE id = ?', [displayName.trim(), req.userId])
  const user = getOne('SELECT id, username, displayName FROM users WHERE id = ?', [req.userId])
  res.json({ user })
})

// 비밀번호 변경
app.put('/api/auth/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '모든 필드를 입력하세요.' })
  }

  const user = getOne('SELECT * FROM users WHERE id = ?', [req.userId])
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: '현재 비밀번호가 틀립니다.' })
  }

  const hashed = bcrypt.hashSync(newPassword, 10)
  run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.userId])
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
  if (!todo) {
    const fallback = getOne('SELECT * FROM todos WHERE ownerId = ? ORDER BY id DESC LIMIT 1', [req.userId])
    return res.json({ todo: { ...fallback, checklist: JSON.parse(fallback.checklist), shares: [] } })
  }
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
  notifyTodoUpdate(todo.id, req.userId)
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
  notifyTodoUpdate(todo.id, req.userId)
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

  // 공유 대상에게 알림
  for (const uid of userIds) {
    if (uid !== req.userId) notifyUser(uid, 'refresh', { todoId: todo.id })
  }

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
//  관리자 API
// ════════════════════════════════════════

// 전체 사용자 목록 조회
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = getAll('SELECT id, username, displayName, isAdmin, createdAt FROM users ORDER BY createdAt DESC')
  res.json({ users: users.map((u) => ({ ...u, isAdmin: !!u.isAdmin })) })
})

// 사용자 삭제
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id)
  if (userId === req.userId) {
    return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' })
  }

  const user = getOne('SELECT id FROM users WHERE id = ?', [userId])
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })

  // 관련 데이터 삭제
  run('DELETE FROM shares WHERE sharedWithId = ?', [userId])
  run('DELETE FROM shares WHERE todoId IN (SELECT id FROM todos WHERE ownerId = ?)', [userId])
  run('DELETE FROM todos WHERE ownerId = ?', [userId])
  run('DELETE FROM playlist WHERE userId = ?', [userId])
  run('DELETE FROM users WHERE id = ?', [userId])

  res.json({ success: true })
})

// 관리자 권한 부여/해제
app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id)
  const { isAdmin } = req.body

  if (userId === req.userId) {
    return res.status(400).json({ error: '본인 권한은 변경할 수 없습니다.' })
  }

  run('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId])
  res.json({ success: true })
})

// 사용자 비밀번호 초기화
app.put('/api/admin/users/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id)
  const { newPassword } = req.body
  if (!newPassword) return res.status(400).json({ error: '새 비밀번호를 입력하세요.' })

  const hashed = bcrypt.hashSync(newPassword, 10)
  run('UPDATE users SET password = ? WHERE id = ?', [hashed, userId])
  res.json({ success: true })
})

// ════════════════════════════════════════
//  YouTube 음악 검색 API
// ════════════════════════════════════════

app.get('/api/music/search', authMiddleware, async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: '검색어를 입력하세요.' })

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'YouTube API 키가 설정되지 않았습니다.' })

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: q + ' music',
      type: 'video',
      videoCategoryId: '10', // Music category
      maxResults: '8',
      key: apiKey,
    })

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'YouTube API 오류' })
    }

    const results = (data.items || []).map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.default.url,
    }))

    res.json({ results })
  } catch (err) {
    console.error('YouTube search error:', err)
    res.status(500).json({ error: '검색 실패' })
  }
})

// ════════════════════════════════════════
//  재생목록 API
// ════════════════════════════════════════

// 내 재생목록 조회
app.get('/api/music/playlist', authMiddleware, (req, res) => {
  const songs = getAll('SELECT * FROM playlist WHERE userId = ? ORDER BY addedAt DESC', [req.userId])
  res.json({ songs })
})

// 재생목록에 추가
app.post('/api/music/playlist', authMiddleware, (req, res) => {
  const { videoId, title, channel, thumbnail } = req.body
  if (!videoId || !title) return res.status(400).json({ error: '곡 정보가 필요합니다.' })

  const existing = getOne('SELECT id FROM playlist WHERE userId = ? AND videoId = ?', [req.userId, videoId])
  if (existing) return res.status(409).json({ error: '이미 재생목록에 있습니다.' })

  run('INSERT INTO playlist (userId, videoId, title, channel, thumbnail) VALUES (?, ?, ?, ?, ?)',
    [req.userId, videoId, title, channel || '', thumbnail || ''])

  const songs = getAll('SELECT * FROM playlist WHERE userId = ? ORDER BY addedAt DESC', [req.userId])
  res.json({ songs })
})

// 재생목록에서 삭제
app.delete('/api/music/playlist/:videoId', authMiddleware, (req, res) => {
  run('DELETE FROM playlist WHERE userId = ? AND videoId = ?', [req.userId, req.params.videoId])
  res.json({ success: true })
})

// ════════════════════════════════════════
//  실시간 동기화 (SSE)
// ════════════════════════════════════════

app.get('/api/events', (req, res) => {
  const token = req.query.token
  if (!token || !sessions[token]) {
    return res.status(401).end()
  }

  const userId = sessions[token].userId

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  res.write(`event: connected\ndata: {}\n\n`)

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set())
  }
  sseClients.get(userId).add(res)

  req.on('close', () => {
    const clients = sseClients.get(userId)
    if (clients) {
      clients.delete(res)
      if (clients.size === 0) sseClients.delete(userId)
    }
  })
})

// ════════════════════════════════════════

async function start() {
  await initDb()
  app.listen(PORT, () => {
    console.log(`✅ Todo Board Server running on http://localhost:${PORT}`)
  })
}

start()
