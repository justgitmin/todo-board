function NaverWorksSync({ session, syncing, onLogin, onLogout, onSync }) {
  return (
    <div className="nw-sync-bar">
      {session ? (
        <>
          <span className="nw-status connected">● 네이버웍스 연결됨</span>
          <button
            className="nw-btn sync"
            onClick={onSync}
            disabled={syncing}
          >
            {syncing ? '동기화 중...' : '📅 일정 가져오기'}
          </button>
          <button className="nw-btn logout" onClick={onLogout}>
            연결 해제
          </button>
        </>
      ) : (
        <>
          <span className="nw-status">네이버웍스 캘린더를 연동하세요</span>
          <button className="nw-btn login" onClick={onLogin}>
            🔗 네이버웍스 로그인
          </button>
        </>
      )}
    </div>
  )
}

export default NaverWorksSync
