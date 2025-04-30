import { GamePhase, PlayerRole, RoleCount } from '../types/game';
import { supabase } from '../supabaseClient';

export const PHASE_DURATION = {
  night: 30,   // 30초
  day: 10,     // 10초
} as const;

export const PHASE_MESSAGES = {
  day: '☀️ 낮이 되었습니다. 토론을 시작하세요.',
  night: '🌙 밤이 되었습니다. 마피아는 투표를 진행하세요.',
} as const;

export function getRoleDistribution(playerCount: number): RoleCount {
  // 기본 구성: 마피아 2, 의사 1, 탐정 1, 나머지 시민
  const distribution: RoleCount = {
    마피아: 2,
    의사: 1,
    탐정: 1,
    시민: Math.max(0, playerCount - 4)  // 전체 - (마피아2 + 의사1 + 탐정1)
  };

  // 5명 미만이면 마피아 1명으로 조정
  if (playerCount < 5) {
    distribution.마피아 = 1;
    distribution.시민 = Math.max(0, playerCount - 3);
  }

  return distribution;
}

export function assignRoles(playerCount: number): PlayerRole[] {
  const distribution = getRoleDistribution(playerCount);
  const roles: PlayerRole[] = [];

  // 각 역할을 배열에 추가
  for (let i = 0; i < distribution.마피아; i++) roles.push('마피아');
  for (let i = 0; i < distribution.의사; i++) roles.push('의사');
  for (let i = 0; i < distribution.탐정; i++) roles.push('탐정');
  for (let i = 0; i < distribution.시민; i++) roles.push('시민');

  // Fisher-Yates 셔플
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  return roles;
}

export function checkGameStart(playerCount: number): boolean {
  return playerCount >= 4 && playerCount <= 9;
}

export function checkWinCondition(
  mafiaCount: number,
  citizenCount: number
): '마피아' | '시민' | null {
  if (mafiaCount === 0) return '시민';
  if (mafiaCount >= citizenCount) return '마피아';
  return null;
}

// 페이즈 변경 함수
export const changePhase = async (roomId: string, currentPhase: GamePhase): Promise<GamePhase> => {
  let nextPhase: GamePhase;
  
  // 현재 페이즈에 따라 다음 페이즈 결정
  if (currentPhase === 'day') {
    nextPhase = 'night';
  } else if (currentPhase === 'night') {
    nextPhase = 'day';
  } else {
    // waiting 페이즈는 변경하지 않음
    return currentPhase;
  }
  
  const phaseEndsAt = new Date(Date.now() + PHASE_DURATION[nextPhase] * 1000);
  
  console.log('페이즈 변경 시도:', {
    currentPhase,
    nextPhase,
    phaseEndsAt: phaseEndsAt.toISOString(),
    duration: PHASE_DURATION[nextPhase]
  });
  
  try {
    const { error } = await supabase
      .from('rooms')
      .update({ 
        phase: nextPhase,
        phase_ends_at: phaseEndsAt.toISOString()
      })
      .eq('id', roomId);
      
    if (error) {
      console.error('페이즈 변경 실패:', error);
      throw new Error('페이즈 변경에 실패했습니다.');
    }
    
    console.log('페이즈 변경 성공:', nextPhase);
    return nextPhase;
  } catch (error) {
    console.error('페이즈 변경 중 오류 발생:', error);
    throw new Error('페이즈 변경 중 오류가 발생했습니다.');
  }
};

// 투표 함수
export const vote = async (
  roomId: string,
  voterId: string,
  targetId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('votes')
    .upsert({
      room_id: roomId,
      voter_id: voterId,
      target_id: targetId,
      created_at: new Date().toISOString()
    });
    
  if (error) {
    console.error('투표 실패:', error);
    return false;
  }
  
  return true;
};

// 투표 결과 확인 함수
export const getVoteResult = async (roomId: string): Promise<string | null> => {
  const { data: votes, error } = await supabase
    .from('votes')
    .select('target_id')
    .eq('room_id', roomId);
    
  if (error || !votes) {
    console.error('투표 결과 조회 실패:', error);
    return null;
  }
  
  // 가장 많은 표를 받은 플레이어 찾기
  const voteCount = votes.reduce((acc: Record<string, number>, vote: { target_id: string }) => {
    acc[vote.target_id] = (acc[vote.target_id] || 0) + 1;
    return acc;
  }, {});
  
  const maxVotes = Math.max(...Object.values(voteCount));
  const eliminated = Object.entries(voteCount)
    .filter(([_, count]) => count === maxVotes)
    .map(([id]) => id);
    
  if (eliminated.length !== 1) {
    return null; // 동률인 경우
  }
  
  return eliminated[0];
};

// 플레이어 제거 함수
export const eliminatePlayer = async (roomId: string, playerId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('players')
    .update({ is_alive: false })
    .eq('id', playerId)
    .eq('room_id', roomId);
    
  if (error) {
    console.error('플레이어 제거 실패:', error);
    return false;
  }
  
  return true;
};

// 마피아 투표 함수
export const mafiaVote = async (
  roomId: string,
  voterId: string,
  targetId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('mafia_votes')
    .upsert({
      room_id: roomId,
      voter_id: voterId,
      target_id: targetId,
      created_at: new Date().toISOString()
    });
    
  if (error) {
    console.error('마피아 투표 실패:', error);
    return false;
  }
  
  return true;
};

// 마피아 투표 결과 확인 함수
export const getMafiaVoteResult = async (roomId: string): Promise<string | null> => {
  const { data: votes, error } = await supabase
    .from('mafia_votes')
    .select('target_id')
    .eq('room_id', roomId);
    
  if (error || !votes) {
    console.error('마피아 투표 결과 조회 실패:', error);
    return null;
  }
  
  // 가장 많은 표를 받은 플레이어 찾기
  const voteCount = votes.reduce((acc: Record<string, number>, vote: { target_id: string }) => {
    acc[vote.target_id] = (acc[vote.target_id] || 0) + 1;
    return acc;
  }, {});
  
  const maxVotes = Math.max(...Object.values(voteCount));
  const eliminated = Object.entries(voteCount)
    .filter(([_, count]) => count === maxVotes)
    .map(([id]) => id);
    
  if (eliminated.length !== 1) {
    return null; // 동률인 경우
  }
  
  return eliminated[0];
};

export async function citizenVote(roomId: string, voterId: string, targetId: string) {
  const { data: room } = await supabase.from('rooms').select('phase,cycle_count').eq('id', roomId).single();
  if (room?.phase !== 'day' || room.cycle_count < 1) return false;

  const { error } = await supabase.from('votes').upsert({
    room_id: roomId,
    voter_id: voterId,
    target_id: targetId,
    type: 'citizen',
    created_at: new Date().toISOString()
  });
  return !error;
}

export async function getCitizenVoteResult(roomId: string) {
  const { data, error } = await supabase
    .from('votes')
    .select('target_id, count:target_id', { count: 'exact' })
    .eq('room_id', roomId)
    .eq('type', 'citizen')
    .group('target_id')
    .order('count', { ascending: false })
    .limit(2);
  if (error || !data?.length) return null;
  if (data.length === 2 && data[0].count === data[1].count) return null;
  return data[0].target_id as string;
} 