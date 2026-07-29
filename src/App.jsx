import { useState, useRef, useEffect } from 'react'
import TodoCard from './components/TodoCard'
import AuthForm from './components/AuthForm'
import ShareModal from './components/ShareModal'
import HelpGuide from './components/HelpGuide'
import ProfileModal from './components/ProfileModal'
import MusicPlayer from './components/MusicPlayer'
import { api, getToken, clearToken } from './api'

const COLUMNS = [
  { id: 'todo', label: '📝 할 일' },
  { id: 'inProgress', label: '🚀 진행 중' },
  { id: 'done', label: '✅ 완료' },
]

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [todos, setTodos] = useState([])
  const [sharedTodos, setSharedTodos] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [tab, setTab] = useState('mine') // 'mine' | 'shared'
  const [shareModal, setShareModal] = useState(null) // todo to share
  const [showProfile, setShowProfile] = useState(false)
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

  const activeTodos = tab === 'mine' ? todos : sharedTodos

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
          <button className="profile-btn" onClick={() => setShowProfile(true)}>
            👤 {user.displayName}
          </button>
          <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
      </header>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'mine' ? 'active' : ''}`}
          onClick={() => setTab('mine')}
        >
          내 할일 ({todos.length})
        </button>
        <button
          className={`tab-btn ${tab === 'shared' ? 'active' : ''}`}
          onClick={() => setTab('shared')}
        >
          공유받은 할일 ({sharedTodos.length})
        </button>
      </div>

      {tab === 'mine' && (
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
      )}

      <div className="board">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="board-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <h2 className="column-title">{col.label}</h2>
            <div className="column-cards">
              {activeTodos
                .filter((t) => t.status === col.id)
                .map((todo) => (
                  <TodoCard
                    key={todo.id}
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

      <MusicPlayer />
    </>
  )
}

export default App
