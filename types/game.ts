export type GameState = "waiting" | "roleReveal" | "playing" | "gameOver"

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  role: "mafia" | "citizen" | null
  isAlive: boolean
  vote: string | null
}
