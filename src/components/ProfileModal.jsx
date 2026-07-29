import { useState } from 'react'
import { api } from '../api'

function ProfileModal({ user, onClose, onUpdated }) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleChangeName = async () => {
    if (!displayName.trim()) return
    try {
      const data = await api.updateProfile({ displayName: displayName.trim() })
      setMessage('이름이 변경되었습니다.')
      setError('')
      onUpdated(data.user)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleChangePassword = async () => {
    setMessage('')
    setError('')
    if (!currentPw || !newPw) {
      return setError('현재 비밀번호와 새 비밀번호를 입력하세요.')
    }
    if (newPw !== confirmPw) {
      return setError('새 비밀번호가 일치하지 않습니다.')
    }
    if (newPw.length < 4) {
      return setError('비밀번호는 4자 이상이어야 합니다.')
    }
    try {
      await api.changePassword({ currentPassword: currentPw, newPassword: newPw })
      setMessage('비밀번호가 변경되었습니다.')
      setError('')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h3>👤 프로필 설정</h3>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        {message && <p className="profile-msg success">{message}</p>}
        {error && <p className="profile-msg error">{error}</p>}

        <div className="profile-section">
          <label>아이디</label>
          <input type="text" value={user.username} disabled />
        </div>

        <div className="profile-section">
          <label>표시 이름</label>
          <div className="profile-row">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button onClick={handleChangeName}>변경</button>
          </div>
        </div>

        <hr className="profile-divider" />

        <h4>🔒 비밀번호 변경</h4>

        <div className="profile-section">
          <label>현재 비밀번호</label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="현재 비밀번호"
          />
        </div>

        <div className="profile-section">
          <label>새 비밀번호</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="새 비밀번호"
          />
        </div>

        <div className="profile-section">
          <label>새 비밀번호 확인</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="새 비밀번호 확인"
          />
        </div>

        <button className="profile-save-btn" onClick={handleChangePassword}>
          비밀번호 변경
        </button>
      </div>
    </div>
  )
}

export default ProfileModal
