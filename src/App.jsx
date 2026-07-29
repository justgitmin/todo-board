import { useState, useRef, useEffect } from 'react'
import TodoCard from './components/TodoCard'
import AuthForm from './components/AuthForm'
import ShareModal from './components/ShareModal'
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
  const dragItem = useRef(null)

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
          <span>👤 {user.displayName}</span>
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
    </>
  )
}

export default App
