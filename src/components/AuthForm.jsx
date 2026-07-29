import { useState } from 'react'
import { api, setToken } from '../api'

function AuthForm({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      let data
      if (isRegister) {
        data = await api.register(username, password, displayName)
      } else {
        data = await api.login(username, password)
      }
      setToken(data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isRegister ? '회원가입' : '로그인'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isRegister && (
            <input
              type="text"
              placeholder="표시 이름 (팀원에게 보이는 이름)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">{isRegister ? '가입하기' : '로그인'}</button>
        </form>
        <p className="auth-switch">
          {isRegister ? '이미 계정이 있나요?' : '처음이신가요?'}{' '}
          <span onClick={() => { setIsRegister(!isRegister); setError('') }}>
            {isRegister ? '로그인' : '회원가입'}
          </span>
        </p>
      </div>
    </div>
  )
}

export default AuthForm
