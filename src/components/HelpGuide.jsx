import { useState } from 'react'

function HelpGuide() {
  const [open, setOpen] = useState(false)

  const items = [
    ['할일 추가', '상단 입력창에 제목 입력 후 "추가" 클릭 (또는 Enter)'],
    ['상태 이동', 'PC: 드래그 / 모바일: 펼친 후 상태 버튼 클릭'],
    ['카드 펼치기', '카드를 클릭하면 상세 내용 표시'],
    ['제목 수정', '제목을 더블클릭 → 편집 (Enter 저장, Esc 취소)'],
    ['체크리스트', '펼친 상태에서 항목 추가/체크/삭제'],
    ['마감기한', '날짜 설정 시 D-day 자동 표시'],
    ['팀원 공유', '펼친 후 "👥 공유 설정" → 팀원 선택'],
    ['공유 확인', '상단 "공유받은 할일" 탭에서 확인'],
    ['실시간 동기화', '팀원이 수정하면 자동 반영'],
    ['삭제', '✕ 버튼 또는 펼친 하단 "🗑️ 삭제" 클릭'],
  ]

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
            <div className="help-list">
              {items.map(([title, desc], i) => (
                <div key={i} className="help-item">
                  <span className="help-num">{i + 1}.</span>
                  <span className="help-title">{title}</span>
                  <span className="help-desc">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default HelpGuide
