import { useState, useRef, useEffect } from 'react'
import TodoCard from './components/TodoCard'
import NaverWorksSync from './components/NaverWorksSync'

const API_BASE = 'http://localhost:3001'

const COLUMNS = [
  { id: 'todo', label: '📝 할 일' },
  { id: 'inProgress', label: '🚀 진행 중' },
  { id: 'done', label: '✅ 완료' },
]

function App() {
  const [todos, setTodos] = useState([
    {
      id: 1,
      title: '프로젝트 기획서 작성',
      status: 'todo',
      deadline: '2026-08-05',
      comment: '마케팅팀과 협의 후 작성',
      checklist: [
        { id: 1, text: '시장조사', done: true },
        { id: 2, text: '경쟁사 분석', done: false },
        { id: 3, text: '초안 작성', done: false },
      ],
    },
    {
      id: 2,
      title: '디자인 리뷰 미팅',
      status: 'inProgress',
      deadline: '2026-08-01',
      comment: '피그마 링크 공유 필요',
      checklist: [
        { id: 1, text: '디자인 시안 확인', done: false },
        { id: 2, text: '피드백 정리', done: false },
      ],
    },
  ])

  const [newTitle, setNewTitle] = useState('')
  const [session, setSession] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const dragItem = useRef(null)
  const dragOverColumn = useRef(null)

  // OAuth 콜백에서 세션 ID 추출
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session')
    if (sessionId) {
      setSession(sessionId)
      localStorage.setItem('nw_session', sessionId)
      // URL에서 쿼리 제거
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      const saved = localStorage.getItem('nw_session')
      if (saved) setSession(saved)
    }
  }, [])

  // 세션 유효 확인
  useEffect(() => {
    if (!session) return
    fetch(`${API_BASE}/auth/status`, {
      headers: { 'x-session-id': session },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          setSession(null)
          localStorage.removeItem('nw_session')
        }
      })
      .catch(() => {})
  }, [session])

  const addTodo = () => {
    if (!newTitle.trim()) return
    const newTodo = {
      id: Date.now(),
      title: newTitle.trim(),
      status: 'todo',
      deadline: '',
      comment: '',
      checklist: [],
    }
    setTodos([...todos, newTodo])
    setNewTitle('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addTodo()
  }

  const updateTodo = (id, updates) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  const deleteTodo = (id) => {
    setTodos(todos.filter((t) => t.id !== id))
  }

  // 네이버웍스 캘린더 일정 가져오기
  const syncCalendar = async () => {
    if (!session) return
    setSyncing(true)
    try {
      const res = await fetch(`${API_BASE}/api/calendar/events`, {
        headers: { 'x-session-id': session },
      })
      const data = await res.json()
      if (data.events && data.events.length > 0) {
        // 이미 동기화된 일정은 중복 추가하지 않음
        const existingIds = new Set(todos.map((t) => t.id))
        const newEvents = data.events.filter((e) => !existingIds.has(e.id))
        if (newEvents.length > 0) {
          setTodos((prev) => [...prev, ...newEvents])
        }
        alert(`${newEvents.length}개 일정을 가져왔습니다.`)
      } else {
        alert('가져올 일정이 없습니다.')
      }
    } catch (err) {
      console.error('Sync error:', err)
      alert('일정 동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogin = () => {
    window.location.href = `${API_BASE}/auth/login`
  }

  const handleLogout = () => {
    if (session) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'x-session-id': session },
      })
    }
    setSession(null)
    localStorage.removeItem('nw_session')
  }

  // Drag & Drop
  const handleDragStart = (e, todoId) => {
    dragItem.current = todoId
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, columnId) => {
    e.preventDefault()
    dragOverColumn.current = columnId
  }

  const handleDrop = (e, columnId) => {
    e.preventDefault()
    if (dragItem.current !== null) {
      updateTodo(dragItem.current, { status: columnId })
      dragItem.current = null
      dragOverColumn.current = null
    }
  }

  const handleDragEnd = () => {
    dragItem.current = null
    dragOverColumn.current = null
  }

  return (
    <>
      <h1>📋 Todo Board</h1>

      <NaverWorksSync
        session={session}
        syncing={syncing}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSync={syncCalendar}
      />

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
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <h2 className="column-title">{col.label}</h2>
            <div className="column-cards">
              {todos
                .filter((t) => t.status === col.id)
                .map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    onUpdate={(updates) => updateTodo(todo.id, updates)}
                    onDelete={() => deleteTodo(todo.id)}
                    onDragStart={(e) => handleDragStart(e, todo.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default App
