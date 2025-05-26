export type GameState = "waiting" | "roleReveal" | "playing" | "gameOver"

// 낮 페이즈의 세부 단계 추가
export type DaySubPhase = "discussion" | "nomination" | "defense" | "execution" | "result"

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  role: "mafia" | "citizen" | null
  isAlive: boolean
  vote: string | null
  nominationVote: string | null // 의심 지목 투표
  executionVote: "yes" | "no" | null // 처형 투표 (찬성/반대)
  isAi?: boolean
}

// 투표 결과 인터페이스 추가
export interface VoteResult {
  target: string
  executed: boolean
  votes: {
    nickname: string
    vote: "yes" | "no"
  }[]
  role?: "mafia" | "citizen" // 처형된 경우에만 포함
  isInnocent?: boolean // 무고한 시민 여부 (처형된 시민인 경우)
}

// 의심 지목 결과 인터페이스 추가
export interface NominationResult {
  nominated: string | null
  votes: Record<string, number>
  voteDetails?: { voter: string; target: string }[]
  tie: boolean
  reason: string
}

// 밤 활동 결과 타입 추가
export interface NightActivityResult {
  killedPlayerNickname: string | null
  noVictim: boolean
  day: number
}

// 페이즈 전환 타입 확장
export type PhaseTransitionType = "dayStart" | "nightStart" | "nightResult"
