import { useState } from 'react'
import { api } from '../api'

function MusicPlayer() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [searching, setSearching] = useState(false)

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

  const handleClose = () => {
    setOpen(false)
    setCurrentVideo(null)
    setMinimized(false)
  }

  const handleMinimize = () => {
    setMinimized(true)
  }

  // 플레이어 닫힌 상태: 플로팅 버튼
  if (!open) {
    return (
      <button className="music-fab" onClick={() => setOpen(true)} title="음악 플레이어">
        🎵
      </button>
    )
  }

  // 최소화 상태: 영상만 작게 표시
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

      {/* Search */}
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

      {/* Results */}
      <div className="music-results">
        {results.map((item) => (
          <div
            key={item.videoId}
            className={`music-item ${currentVideo?.videoId === item.videoId ? 'active' : ''}`}
            onClick={() => playVideo(item)}
          >
            <img src={item.thumbnail} alt="" className="music-thumb" />
            <div className="music-info">
              <span className="music-item-title">{item.title}</span>
              <span className="music-item-channel">{item.channel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MusicPlayer
