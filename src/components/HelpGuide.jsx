import { useState } from 'react'

function HelpGuide() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="help-toggle" onClick={() => setOpen(true)}>
        ❓ 사용법
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>📖 사용 가이드</h3>
              <button className="help-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <ol>
              <li><strong>할일 추가</strong> — 상단 입력창에 제목 입력 후 "추가" 클릭 (또는 Enter)</li>
              <li><strong>상태 이동</strong> — PC: 카드를 드래그하여 이동 / 모바일: 카드 펼친 후 상태 버튼 클릭</li>
              <li><strong>카드 펼치기</strong> — 카드를 클릭하면 상세 내용 표시</li>
              <li><strong>제목 수정</strong> — 제목을 더블클릭하면 편집 모드 (Enter 저장, Esc 취소)</li>
              <li><strong>체크리스트</strong> — 펼친 상태에서 항목 추가/체크/삭제</li>
              <li><strong>마감기한</strong> — 날짜 설정 시 D-day 자동 표시</li>
              <li><strong>팀원 공유</strong> — 펼친 후 "👥 공유 설정" → 팀원 선택</li>
              <li><strong>공유받은 할일</strong> — 상단 "공유받은 할일" 탭에서 확인</li>
              <li><strong>실시간 동기화</strong> — 팀원이 수정하면 자동 반영</li>
              <li><strong>삭제</strong> — ✕ 버튼 또는 펼친 하단 "🗑️ 삭제" 클릭</li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}

export default HelpGuide
