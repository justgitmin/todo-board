const API_BASE = ''

function getToken() {
  return localStorage.getItem('todo_token')
}

function setToken(token) {
  localStorage.setItem('todo_token', token)
}

function clearToken() {
  localStorage.removeItem('todo_token')
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`${API_BASE}${path}`, options)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || '요청 실패')
  }
  return data
}

export const api = {
  // Auth
  register: (username, password, displayName) =>
    request('POST', '/api/auth/register', { username, password, displayName }),
  login: (username, password) =>
    request('POST', '/api/auth/login', { username, password }),
  me: () => request('GET', '/api/auth/me'),
  logout: () => request('POST', '/api/auth/logout'),

  // Users
  getUsers: () => request('GET', '/api/users'),

  // Todos
  getTodos: () => request('GET', '/api/todos'),
  createTodo: (todo) => request('POST', '/api/todos', todo),
  updateTodo: (id, updates) => request('PUT', `/api/todos/${id}`, updates),
  deleteTodo: (id) => request('DELETE', `/api/todos/${id}`),

  // Share
  shareTodo: (id, userIds) => request('POST', `/api/todos/${id}/share`, { userIds }),
  unshareTodo: (id) => request('DELETE', `/api/todos/${id}/share`),

  // Profile
  updateProfile: (data) => request('PUT', '/api/auth/profile', data),
  changePassword: (data) => request('PUT', '/api/auth/password', data),

  // Music
  searchMusic: (q) => request('GET', `/api/music/search?q=${encodeURIComponent(q)}`),
  getPlaylist: () => request('GET', '/api/music/playlist'),
  addToPlaylist: (song) => request('POST', '/api/music/playlist', song),
  removeFromPlaylist: (videoId) => request('DELETE', `/api/music/playlist/${videoId}`),

  // Admin
  getAdminUsers: () => request('GET', '/api/admin/users'),
  deleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
  setUserRole: (id, isAdmin) => request('PUT', `/api/admin/users/${id}/role`, { isAdmin }),
  resetUserPassword: (id, newPassword) => request('PUT', `/api/admin/users/${id}/reset-password`, { newPassword }),
}

export { getToken, setToken, clearToken }
