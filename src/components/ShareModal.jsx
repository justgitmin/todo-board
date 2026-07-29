import { useState, useEffect } from 'react'
import { api } from '../api'

function ShareModal({ todo, onClose, onShared }) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getUsers().then((data) => {
      setUsers(data.users)
      // 이미 공유된 사용자 체크
      const alreadyShared = (todo.shares || []).map((s) => s.id)
      setSelected(alreadyShared)
      setLoading(false)
    })
  }, [todo])

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSave = async () => {
    try {
      const data = await api.shareTodo(todo.id, selected)
      onShared(data.shares)
      onClose()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>👥 공유 대상 선택</h3>
        <p className="modal-subtitle">"{todo.title}" 을(를) 누구에게 공유할까요?</p>

        {users.length === 0 ? (
          <p className="modal-empty">팀원이 없습니다. 팀원이 먼저 가입해야 합니다.</p>
        ) : (
          <ul className="share-user-list">
            {users.map((user) => (
              <li key={user.id} className="share-user-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                  />
                  <span>{user.displayName}</span>
                  <span className="share-username">@{user.username}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onClose}>취소</button>
          <button className="modal-btn save" onClick={handleSave}>
            {selected.length > 0 ? `${selected.length}명에게 공유` : '공유 해제'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareModal
