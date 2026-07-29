import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import crypto from 'crypto'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

// 간이 토큰 저장소 (프로덕션에서는 DB/세션 사용)
const tokenStore = {}

// ─── 1. OAuth 인증 시작: 프론트에서 이 URL로 리다이렉트 ───
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex')
  const nonce = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: process.env.NAVER_WORKS_CLIENT_ID,
    redirect_uri: process.env.NAVER_WORKS_REDIRECT_URI,
    scope: 'calendar.read',
    response_type: 'code',
    state,
    nonce,
  })

  res.redirect(`https://auth.worksmobile.com/oauth2/v2.0/authorize?${params}`)
})

// ─── 2. OAuth 콜백: Authorization Code → Access Token 교환 ───
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query

  if (!code) {
    return res.status(400).send('Authorization code가 없습니다.')
  }

  try {
    const tokenRes = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.NAVER_WORKS_CLIENT_ID,
        client_secret: process.env.NAVER_WORKS_CLIENT_SECRET,
        redirect_uri: process.env.NAVER_WORKS_REDIRECT_URI,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('Token error:', tokenData)
      return res.status(400).send('토큰 발급 실패')
    }

    // 간이 세션 ID 생성
    const sessionId = crypto.randomBytes(32).toString('hex')
    tokenStore[sessionId] = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + Number(tokenData.expires_in) * 1000,
    }

    // 프론트엔드로 리다이렉트 (세션 ID를 쿼리로 전달)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    res.redirect(`${frontendUrl}?session=${sessionId}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.status(500).send('인증 처리 중 오류 발생')
  }
})

// ─── 3. Access Token 갱신 ───
async function refreshAccessToken(session) {
  const tokenRes = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
      client_id: process.env.NAVER_WORKS_CLIENT_ID,
      client_secret: process.env.NAVER_WORKS_CLIENT_SECRET,
    }),
  })

  const data = await tokenRes.json()
  if (data.access_token) {
    session.accessToken = data.access_token
    session.expiresAt = Date.now() + Number(data.expires_in) * 1000
    if (data.refresh_token) {
      session.refreshToken = data.refresh_token
    }
  }
  return session
}

// ─── 미들웨어: 세션 확인 & 토큰 갱신 ───
async function authMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id']
  if (!sessionId || !tokenStore[sessionId]) {
    return res.status(401).json({ error: '인증이 필요합니다. 로그인해주세요.' })
  }

  const session = tokenStore[sessionId]

  // 만료 5분 전이면 갱신
  if (session.expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      await refreshAccessToken(session)
    } catch (err) {
      console.error('Token refresh failed:', err)
      return res.status(401).json({ error: '토큰 갱신 실패. 다시 로그인해주세요.' })
    }
  }

  req.accessToken = session.accessToken
  next()
}

// ─── 4. 캘린더 일정 조회 ───
app.get('/api/calendar/events', authMiddleware, async (req, res) => {
  const { userId = 'me', from, to } = req.query

  // 기본: 오늘부터 30일 후까지
  const now = new Date()
  const fromDate = from || now.toISOString().split('T')[0] + 'T00:00:00+09:00'
  const toDate = to || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T23:59:59+09:00'

  try {
    const apiUrl = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events?fromDateTime=${encodeURIComponent(fromDate)}&toDateTime=${encodeURIComponent(toDate)}`

    const apiRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${req.accessToken}`,
      },
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      console.error('Calendar API error:', apiRes.status, errText)
      return res.status(apiRes.status).json({ error: '캘린더 조회 실패', detail: errText })
    }

    const data = await apiRes.json()

    // 일정을 Todo 카드 형식으로 변환
    const events = (data.events || []).map((evt) => {
      const comp = evt.eventComponents?.[0] || {}
      return {
        id: `nw-${comp.eventId || Date.now()}`,
        title: comp.summary || '(제목 없음)',
        status: 'todo',
        deadline: comp.start?.dateTime?.split('T')[0] || '',
        comment: comp.description || '',
        location: comp.location || '',
        checklist: [],
        source: 'naverworks',
      }
    })

    res.json({ events })
  } catch (err) {
    console.error('Calendar fetch error:', err)
    res.status(500).json({ error: '서버 오류' })
  }
})

// ─── 5. 인증 상태 확인 ───
app.get('/auth/status', (req, res) => {
  const sessionId = req.headers['x-session-id']
  if (sessionId && tokenStore[sessionId]) {
    res.json({ authenticated: true })
  } else {
    res.json({ authenticated: false })
  }
})

// ─── 6. 로그아웃 ───
app.post('/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id']
  if (sessionId && tokenStore[sessionId]) {
    delete tokenStore[sessionId]
  }
  res.json({ success: true })
})

app.listen(PORT, () => {
  console.log(`✅ Todo Board Server running on http://localhost:${PORT}`)
  console.log(`   로그인: http://localhost:${PORT}/auth/login`)
})
