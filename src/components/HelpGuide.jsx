import { useState } from 'react'

function HelpGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="help-guide">
      <button className="help-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕ 닫기' : '❓ 사용법'}
      </button>

      {open && (
        <div className="help-content">
          <h3>📖 사용 가이드</h3>
          <ol>
            <li><strong>할일 추가</strong> — 상단 입력창에 제목 입력 후 "추가" 클릭 (또는 Enter)</li>
            <li><strong>상태 이동</strong> — 카드를 <em>드래그</em>하여 "할 일 → 진행 중 → 완료" 칸으로 이동</li>
            <li><strong>카드 펼치기</strong> — 카드를 클릭하면 상세 내용 (체크리스트, 마감기한, 코멘트) 표시</li>
            <li><strong>제목 수정</strong> — 제목을 <em>더블클릭</em>하면 편집 모드 (Enter로 저장, Esc로 취소)</li>
            <li><strong>체크리스트</strong> — 펼친 상태에서 항목 추가/체크/삭제 가능</li>
            <li><strong>마감기한</strong> — 날짜 설정하면 D-day 자동 표시, 초과 시 빨간색 경고</li>
            <li><strong>팀원 공유</strong> — 펼친 상태에서 "👥 공유 설정" 클릭 → 팀원 선택</li>
            <li><strong>공유받은 할일</strong> — 상단 "공유받은 할일" 탭에서 확인, 수정도 가능</li>
            <li><strong>실시간 동기화</strong> — 팀원이 수정하면 자동으로 반영됨 (새로고침 불필요)</li>
            <li><strong>삭제</strong> — 접힌 상태에서 ✕ 버튼 또는 펼친 상태 하단 "🗑️ 삭제" 클릭 (확인 팝업)</li>
          </ol>
        </div>
      )}
    </div>
  )
}

export default HelpGuide
