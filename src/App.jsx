import { useState, useRef, useEffect } from 'react'
import TodoCard from './components/TodoCard'
import AuthForm from './components/AuthForm'
import ShareModal from './components/ShareModal'
import HelpGuide from './components/HelpGuide'
import ProfileModal from './components/ProfileModal'
import MusicPlayer from './components/MusicPlayer'
import AdminPanel from './components/AdminPanel'
import { api, getToken, clearToken } from './api'

const COLUMNS = [
  { id: 'todo', label: '📝 할 일' },
  { id: 'shared', label: '🤝 공유 작업' },
  { id: 'done', label: '✅ 완료' },
]

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [todos, setTodos] = useState([])
  const [sharedTodos, setSharedTodos] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [shareModal, setShareModal] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')
  const dragItem = useRef(null)

  // 다크모드 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  // 자동 로그인 체크
  useEffect(() => {
    const token = getToken()
    if (token) {
      api.me()
        .then((data) => setUser(data.user))
        .catch(() => clearToken())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // 할일 불러오기
  useEffect(() => {
    if (user) fetchTodos()
  }, [user])

  // 실시간 동기화 (SSE) + 폴링 + 모바일 복귀 시 갱신
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('todo_token')
    if (!token) return

    let evtSource = null

    const connect = () => {
      if (evtSource) evtSource.close()
      evtSource = new EventSource(`/api/events?token=${token}`)
      evtSource.addEventListener('refresh', () => fetchTodos())
      evtSource.onerror = () => {}
    }

    connect()

    // 폴링: 10초마다 데이터 갱신 (모바일 SSE 불안정 대비)
    const pollInterval = setInterval(() => {
      fetchTodos()
    }, 10000)

    // 모바일: 화면 복귀 시 재연결 + 데이터 갱신
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        connect()
        fetchTodos()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (evtSource) evtSource.close()
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user])

  const fetchTodos = async () => {
    try {
      const data = await api.getTodos()
      setTodos(data.myTodos)
      setSharedTodos(data.sharedTodos)
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    api.logout()
    clearToken()
    setUser(null)
    setTodos([])
    setSharedTodos([])
  }

  const addTodo = async () => {
    if (!newTitle.trim()) return
    try {
      const data = await api.createTodo({ title: newTitle.trim() })
      setTodos([data.todo, ...todos])
      setNewTitle('')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addTodo()
  }

  const updateTodo = async (id, updates) => {
    try {
      const data = await api.updateTodo(id, updates)
      setTodos(todos.map((t) => (t.id === id ? { ...t, ...data.todo } : t)))
      setSharedTodos(sharedTodos.map((t) => (t.id === id ? { ...t, ...data.todo } : t)))
    } catch (err) {
      alert(err.message)
    }
  }

  const deleteTodo = async (id) => {
    try {
      await api.deleteTodo(id)
      setTodos(todos.filter((t) => t.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleShared = (todoId, shares) => {
    setTodos(todos.map((t) => (t.id === todoId ? { ...t, shares } : t)))
  }

  // Drag & Drop
  const handleDragStart = (e, todoId) => {
    dragItem.current = todoId
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, columnId) => {
    e.preventDefault()
    if (dragItem.current !== null) {
      updateTodo(dragItem.current, { status: columnId })
      dragItem.current = null
    }
  }

  const handleDragEnd = () => {
    dragItem.current = null
  }

  if (loading) return <div className="loading">로딩 중...</div>
  if (!user) return <AuthForm onLogin={handleLogin} />

  // 할 일: 내 할일 중 공유 안 한 것, 미완료
  const myActiveTodos = todos.filter((t) => (t.status === 'todo' || t.status === 'inProgress') && (!t.shares || t.shares.length === 0))
  // 공유 작업: 내가 공유한 + 공유받은 할일 중 미완료 (중복 제거)
  const mySharedTodos = todos.filter((t) => (t.shares && t.shares.length > 0) && t.status !== 'done')
  const receivedSharedTodos = sharedTodos.filter((t) => t.status !== 'done')
  const sharedIds = new Set(mySharedTodos.map((t) => t.id))
  const sharedActiveTodos = [
    ...mySharedTodos,
    ...receivedSharedTodos.filter((t) => !sharedIds.has(t.id)),
  ]
  // 완료: 내 할일 + 공유받은 할일 중 완료 (중복 제거)
  const myDoneTodos = todos.filter((t) => t.status === 'done')
  const doneIds = new Set(myDoneTodos.map((t) => t.id))
  const doneTodos = [
    ...myDoneTodos,
    ...sharedTodos.filter((t) => t.status === 'done' && !doneIds.has(t.id)),
  ]

  const getColumnTodos = (colId) => {
    if (colId === 'todo') return myActiveTodos
    if (colId === 'shared') return sharedActiveTodos
    return doneTodos
  }

  return (
    <>
      <header className="app-header">
        <h1>📋 Todo Board</h1>
        <div className="user-info">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? '라이트 모드' : '다크 모드'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <HelpGuide />
          {user.isAdmin && (
            <button className="admin-toggle-btn" onClick={() => setShowAdmin(true)} title="관리자">
              ⚙️
            </button>
          )}
          <button className="profile-btn" onClick={() => setShowProfile(true)}>
            👤 {user.displayName}
          </button>
          <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
      </header>

      <div className="add-todo-form">
        <input
          type="text"
          placeholder="새 할일을 입력하세요..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={addTodo}>추가</button>
      </div>

      <div className="board">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="board-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <h2 className="column-title">{col.label} ({getColumnTodos(col.id).length})</h2>
            <div className="column-cards">
              {getColumnTodos(col.id).map((todo) => (
                  <TodoCard
                    key={`${todo.id}-${todo.isShared ? 's' : 'm'}`}
                    todo={todo}
                    onUpdate={(updates) => updateTodo(todo.id, updates)}
                    onDelete={() => deleteTodo(todo.id)}
                    onShare={() => setShareModal(todo)}
                    onDragStart={(e) => handleDragStart(e, todo.id)}
                    onDragEnd={handleDragEnd}
                    isOwner={!todo.isShared}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {shareModal && (
        <ShareModal
          todo={shareModal}
          onClose={() => setShareModal(null)}
          onShared={(shares) => {
            handleShared(shareModal.id, shares)
            setShareModal(null)
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      <MusicPlayer />
    </>
  )
}

export default App
