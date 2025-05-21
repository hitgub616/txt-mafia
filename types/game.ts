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
}
