import { useState, useRef, useEffect } from 'react'

function TodoCard({ todo, onUpdate, onDelete, onShare, onDragStart, onDragEnd, isOwner }) {
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
    const item = todo.checklist.find((i) => i.id === checkId)
    if (window.confirm(`"${item?.text}" 항목을 삭제하시겠습니까?`)) {
      onUpdate({ checklist: todo.checklist.filter((i) => i.id !== checkId) })
    }
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
    if (trimmed && trimmed !== todo.title) {
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
    if (diff === 0) return { text: 'D-Day', level: 'urgent' }
    if (diff < 0) return { text: `D+${Math.abs(diff)}`, level: 'overdue' }
    if (diff <= 2) return { text: `D-${diff}`, level: 'urgent' }
    if (diff <= 5) return { text: `D-${diff}`, level: 'warning' }
    return { text: `D-${diff}`, level: 'safe' }
  }

  const getProgress = () => {
    if (todo.checklist.length === 0) return null
    const doneCount = todo.checklist.filter((item) => item.done).length
    return Math.round((doneCount / todo.checklist.length) * 100)
  }

  const dday = getDday()
  const progress = getProgress()
  const hasShares = todo.shares && todo.shares.length > 0

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
        {isOwner && (
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`"${todo.title}" 을(를) 삭제하시겠습니까?`)) {
                onDelete()
              }
            }}
            aria-label="삭제"
            title="삭제"
            style={{ display: expanded ? 'none' : 'inline-block' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Summary badges */}
      {(dday !== null || progress !== null || hasShares || todo.isShared) && (
        <div className="card-summary">
          {todo.isShared && (
            <span className="badge shared-badge">📨 {todo.ownerName}</span>
          )}
          {hasShares && (
            <span className="badge shared-badge">👥 {todo.shares.length}명 공유</span>
          )}
          {dday && (
            <span className={`badge dday ${dday.level}`}>
              {dday.text}
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
          {/* Status move buttons (mobile-friendly) */}
          <div className="status-move">
            {['todo', 'inProgress', 'done'].map((s) => (
              <button
                key={s}
                className={`status-btn ${todo.status === s ? 'current' : ''}`}
                onClick={() => {
                  if (todo.status !== s) onUpdate({ status: s })
                }}
                disabled={todo.status === s}
              >
                {s === 'todo' ? '📝 할일' : s === 'inProgress' ? '🚀 진행' : '✅ 완료'}
              </button>
            ))}
          </div>

          {/* Share button */}
          {isOwner && (
            <button
              className="share-btn"
              onClick={() => onShare()}
            >
              👥 공유 설정
            </button>
          )}

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

          {/* Delete button inside expanded */}
          {isOwner && (
            <div className="card-delete-area">
              <button
                className="delete-btn-full"
                onClick={() => {
                  if (window.confirm(`"${todo.title}" 을(를) 삭제하시겠습니까?`)) {
                    onDelete()
                  }
                }}
              >
                🗑️ 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TodoCard
