import { useState, useEffect } from 'react'
import { api } from '../api'

function MusicPlayer() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [tab, setTab] = useState('search') // 'search' | 'playlist'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [playlist, setPlaylist] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [searching, setSearching] = useState(false)

  // 재생목록 불러오기
  useEffect(() => {
    if (open) {
      api.getPlaylist().then((data) => setPlaylist(data.songs || [])).catch(() => {})
    }
  }, [open])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const data = await api.searchMusic(query.trim())
      setResults(data.results || [])
    } catch (err) {
      alert(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const playVideo = (video) => {
    setCurrentVideo(video)
    setMinimized(false)
  }

  const addToPlaylist = async (song) => {
    try {
      const data = await api.addToPlaylist(song)
      setPlaylist(data.songs)
    } catch (err) {
      if (err.message.includes('이미')) {
        // 이미 있으면 무시
      } else {
        alert(err.message)
      }
    }
  }

  const removeFromPlaylist = async (videoId) => {
    try {
      await api.removeFromPlaylist(videoId)
      setPlaylist(playlist.filter((s) => s.videoId !== videoId))
    } catch (err) {
      alert(err.message)
    }
  }

  const isInPlaylist = (videoId) => playlist.some((s) => s.videoId === videoId)

  const handleClose = () => {
    setOpen(false)
    setCurrentVideo(null)
    setMinimized(false)
  }

  const handleMinimize = () => {
    setMinimized(true)
  }

  // 플레이어 닫힌 상태
  if (!open) {
    return (
      <button className="music-fab" onClick={() => setOpen(true)} title="음악 플레이어">
        🎵
      </button>
    )
  }

  // 최소화 상태
  if (minimized) {
    return (
      <div className="music-mini">
        {currentVideo ? (
          <iframe
            width="200"
            height="113"
            src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&rel=0`}
            title={currentVideo.title}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <div className="music-mini-empty">🎵 재생 중 없음</div>
        )}
        <div className="music-mini-controls">
          <span className="music-mini-title">
            {currentVideo ? currentVideo.title : ''}
          </span>
          <div className="music-mini-btns">
            <button onClick={() => setMinimized(false)} title="확대">▢</button>
            <button onClick={handleClose} title="닫기">✕</button>
          </div>
        </div>
      </div>
    )
  }

  // 전체 플레이어
  return (
    <div className="music-player">
      <div className="music-header">
        <span className="music-title">🎵 Music</span>
        <div className="music-header-btns">
          <button className="music-ctrl-btn" onClick={handleMinimize} title="최소화">─</button>
          <button className="music-ctrl-btn" onClick={handleClose} title="닫기">✕</button>
        </div>
      </div>

      {/* Now Playing */}
      {currentVideo && (
        <div className="music-now-playing">
          <iframe
            width="100%"
            height="160"
            src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&rel=0`}
            title={currentVideo.title}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
          <p className="music-current-title">{currentVideo.title}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="music-tabs">
        <button
          className={`music-tab ${tab === 'search' ? 'active' : ''}`}
          onClick={() => setTab('search')}
        >
          🔍 검색
        </button>
        <button
          className={`music-tab ${tab === 'playlist' ? 'active' : ''}`}
          onClick={() => setTab('playlist')}
        >
          ❤️ 내 목록 ({playlist.length})
        </button>
      </div>

      {/* Search Tab */}
      {tab === 'search' && (
        <>
          <div className="music-search">
            <input
              type="text"
              placeholder="노래 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button onClick={handleSearch} disabled={searching}>
              {searching ? '...' : '🔍'}
            </button>
          </div>
          <div className="music-results">
            {results.map((item) => (
              <div
                key={item.videoId}
                className={`music-item ${currentVideo?.videoId === item.videoId ? 'active' : ''}`}
              >
                <img src={item.thumbnail} alt="" className="music-thumb" onClick={() => playVideo(item)} />
                <div className="music-info" onClick={() => playVideo(item)}>
                  <span className="music-item-title">{item.title}</span>
                  <span className="music-item-channel">{item.channel}</span>
                </div>
                <button
                  className={`music-fav-btn ${isInPlaylist(item.videoId) ? 'saved' : ''}`}
                  onClick={() => isInPlaylist(item.videoId) ? removeFromPlaylist(item.videoId) : addToPlaylist(item)}
                  title={isInPlaylist(item.videoId) ? '목록에서 제거' : '내 목록에 추가'}
                >
                  {isInPlaylist(item.videoId) ? '❤️' : '🤍'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Playlist Tab */}
      {tab === 'playlist' && (
        <div className="music-results">
          {playlist.length === 0 ? (
            <p className="music-empty">검색에서 ❤️를 눌러 곡을 추가하세요</p>
          ) : (
            playlist.map((item) => (
              <div
                key={item.videoId}
                className={`music-item ${currentVideo?.videoId === item.videoId ? 'active' : ''}`}
              >
                <img src={item.thumbnail} alt="" className="music-thumb" onClick={() => playVideo(item)} />
                <div className="music-info" onClick={() => playVideo(item)}>
                  <span className="music-item-title">{item.title}</span>
                  <span className="music-item-channel">{item.channel}</span>
                </div>
                <button
                  className="music-fav-btn saved"
                  onClick={() => removeFromPlaylist(item.videoId)}
                  title="목록에서 제거"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default MusicPlayer
