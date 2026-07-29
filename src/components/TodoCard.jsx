import { useState, useRef, useEffect } from 'react'

function TodoCard({ todo, onUpdate, onDelete, onDragStart, onDragEnd }) {
  const [expanded, setExpanded] = useState(false)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(todo.title)
  const titleInputRef = useRef(null)

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  const allDone =
    todo.checklist.length > 0 && todo.checklist.every((item) => item.done)

  const toggleChecklist = (checkId) => {
    const updated = todo.checklist.map((item) =>
      item.id === checkId ? { ...item, done: !item.done } : item
    )
    onUpdate({ checklist: updated })
  }

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return
    const newItem = { id: Date.now(), text: newCheckItem.trim(), done: false }
    onUpdate({ checklist: [...todo.checklist, newItem] })
    setNewCheckItem('')
  }

  const removeCheckItem = (checkId) => {
    onUpdate({ checklist: todo.checklist.filter((item) => item.id !== checkId) })
  }

  const handleCheckKeyDown = (e) => {
    if (e.key === 'Enter') addCheckItem()
  }

  const isOverdue = () => {
    if (!todo.deadline) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(todo.deadline) < today
  }

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed) {
      onUpdate({ title: trimmed })
    } else {
      setTitleDraft(todo.title)
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') commitTitle()
    if (e.key === 'Escape') {
      setTitleDraft(todo.title)
      setEditingTitle(false)
    }
  }

  const getDday = () => {
    if (!todo.deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadline = new Date(todo.deadline)
    deadline.setHours(0, 0, 0, 0)
    const diff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'D-Day'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  const getProgress = () => {
    if (todo.checklist.length === 0) return null
    const doneCount = todo.checklist.filter((item) => item.done).length
    return Math.round((doneCount / todo.checklist.length) * 100)
  }

  const dday = getDday()
  const progress = getProgress()

  return (
    <div
      className={`todo-card ${expanded ? 'expanded' : ''}`}
      onClick={() => !expanded && !editingTitle && setExpanded(true)}
      role="article"
      aria-expanded={expanded}
      draggable={!editingTitle}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="card-header">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="title-edit-input"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`card-title ${allDone ? 'completed' : ''}`}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setTitleDraft(todo.title)
              setEditingTitle(true)
            }}
            title="더블클릭하여 제목 수정"
          >
            {todo.title}
          </span>
        )}
        <span
          className={`expand-icon ${expanded ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          role="button"
          aria-label={expanded ? '접기' : '펼치기'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              setExpanded(!expanded)
            }
          }}
        >
          ▼
        </span>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="삭제"
        >
          ✕
        </button>
      </div>

      {/* Summary badges: D-day & Progress */}
      {(dday !== null || progress !== null || todo.source === 'naverworks') && (
        <div className="card-summary">
          {todo.source === 'naverworks' && (
            <span className="badge nw-badge">N</span>
          )}
          {dday && (
            <span className={`badge dday ${isOverdue() ? 'overdue' : ''}`}>
              {dday}
            </span>
          )}
          {progress !== null && (
            <div className="progress-wrap">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="progress-text">{progress}%</span>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="card-body" onClick={(e) => e.stopPropagation()}>
          {/* Deadline & Comment */}
          <div className="meta-row">
            <label>
              마감기한
              <input
                type="date"
                value={todo.deadline}
                onChange={(e) => onUpdate({ deadline: e.target.value })}
                className={isOverdue() ? 'deadline-warning' : ''}
              />
              {isOverdue() && (
                <span className="deadline-warning">기한 초과!</span>
              )}
            </label>
            <label style={{ flex: 1 }}>
              코멘트
              <textarea
                value={todo.comment}
                onChange={(e) => onUpdate({ comment: e.target.value })}
                placeholder="메모를 남겨보세요..."
              />
            </label>
          </div>

          {/* Checklist */}
          <ul className="checklist">
            {todo.checklist.map((item) => (
              <li key={item.id} className="checklist-item">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleChecklist(item.id)}
                  id={`check-${todo.id}-${item.id}`}
                />
                <span className={item.done ? 'done' : ''}>{item.text}</span>
                <button
                  className="remove-check-btn"
                  onClick={() => removeCheckItem(item.id)}
                  aria-label={`${item.text} 삭제`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {/* Add Checklist Item */}
          <div className="add-checklist">
            <input
              type="text"
              placeholder="체크리스트 항목 추가..."
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              onKeyDown={handleCheckKeyDown}
            />
            <button onClick={addCheckItem}>+</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TodoCard
