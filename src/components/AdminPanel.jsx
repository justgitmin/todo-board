import { useState, useEffect } from 'react'
import { api } from '../api'

function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [resetPw, setResetPw] = useState({}) // { userId: password }
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await api.getAdminUsers()
      setUsers(data.users)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`"${user.displayName}" (@${user.username}) 계정을 삭제하시겠습니까?\n관련된 할일, 재생목록도 모두 삭제됩니다.`)) return
    try {
      await api.deleteUser(user.id)
      setUsers(users.filter((u) => u.id !== user.id))
      setMessage(`${user.displayName} 계정이 삭제되었습니다.`)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleAdmin = async (user) => {
    const newRole = !user.isAdmin
    if (!window.confirm(`${user.displayName}을(를) ${newRole ? '관리자로 지정' : '일반 사용자로 변경'}하시겠습니까?`)) return
    try {
      await api.setUserRole(user.id, newRole)
      setUsers(users.map((u) => u.id === user.id ? { ...u, isAdmin: newRole } : u))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleResetPassword = async (userId) => {
    const pw = resetPw[userId]
    if (!pw || pw.length < 4) {
      alert('4자 이상 입력하세요.')
      return
    }
    try {
      await api.resetUserPassword(userId, pw)
      setResetPw({ ...resetPw, [userId]: '' })
      setMessage('비밀번호가 초기화되었습니다.')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h3>⚙️ 관리자 페이지</h3>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        {message && <p className="profile-msg success">{message}</p>}

        <p className="admin-count">등록된 사용자: {users.length}명</p>

        <div className="admin-user-list">
          {users.map((user) => (
            <div key={user.id} className="admin-user-item">
              <div className="admin-user-info">
                <span className="admin-user-name">
                  {user.displayName}
                  {user.isAdmin && <span className="admin-badge">관리자</span>}
                </span>
                <span className="admin-user-meta">@{user.username} · {user.createdAt?.split('T')[0] || user.createdAt?.split(' ')[0]}</span>
              </div>
              <div className="admin-user-actions">
                <button
                  className="admin-action-btn role"
                  onClick={() => handleToggleAdmin(user)}
                  title={user.isAdmin ? '관리자 해제' : '관리자 지정'}
                >
                  {user.isAdmin ? '👤' : '👑'}
                </button>
                <button
                  className="admin-action-btn delete"
                  onClick={() => handleDelete(user)}
                  title="계정 삭제"
                >
                  🗑️
                </button>
              </div>
              <div className="admin-reset-pw">
                <input
                  type="text"
                  placeholder="새 비밀번호"
                  value={resetPw[user.id] || ''}
                  onChange={(e) => setResetPw({ ...resetPw, [user.id]: e.target.value })}
                />
                <button onClick={() => handleResetPassword(user.id)}>초기화</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
