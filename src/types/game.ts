export type GamePhase = 'waiting' | 'day' | 'night';
export type PlayerRole = '마피아' | '의사' | '탐정' | '시민';

export interface RoleCount {
  마피아: number;
  의사: number;
  탐정: number;
  시민: number;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  is_alive: boolean;
  role?: PlayerRole;
  joined_at?: string;
}

export interface Message {
  id: string;
  room_id: string;
  player_id: string;
  nickname: string;
  content: string;
  created_at: string;
  mafia_only: boolean;
}

export interface Vote {
  room_id: string;
  voter_id: string;
  target_id: string;
  created_at: string;
}

export interface MafiaVote {
  room_id: string;
  voter_id: string;
  target_id: string;
  created_at: string;
} 