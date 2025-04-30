import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useEffect, useState } from 'react';
import Chat from './Chat';
import { checkGameStart, assignRoles, changePhase, vote, getVoteResult, eliminatePlayer, mafiaVote, getMafiaVoteResult, PHASE_DURATION, PHASE_MESSAGES, citizenVote, getCitizenVoteResult } from '../utils/gameLogic';
import { getAnimalName } from '../utils/animalEmoji';
import { PhaseContext } from '../contexts/PhaseContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { Player, GamePhase, PlayerRole } from '../types/game';
import { useNavigate } from 'react-router-dom';

// 카운트다운 모달 컴포넌트
function CountdownModal({ role, onClose, isNightPhase }: { role: string; onClose: () => void; isNightPhase: boolean }) {
  const [count, setCount] = useState(3);
  const [showRole, setShowRole] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (count > 0) {
      timer = setTimeout(() => setCount(count - 1), 1000);
    } else if (count === 0) {
      // 카운트가 끝나면 즉시 역할과 확인 버튼을 모두 표시
      setShowRole(true);
      setShowConfirm(true);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [count]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4 text-center relative">
        {!showRole ? (
          <>
            <h2 className="text-2xl font-bold mb-4">게임 시작!</h2>
            <p className="text-4xl font-bold text-blue-500 mb-4">{count}</p>
            <p className="text-lg">잠시 후 당신의 역할이 공개됩니다...</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4">당신의 역할은...</h2>
            <p className="text-4xl font-bold text-red-500 mb-4">{role}</p>
            {showConfirm && (
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                확인
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 게임 종료 모달
function EndGameModal({
  result,
  onClose
}: {
  result: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 w-72 mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4">게임 종료</h2>
        <p className="text-xl mb-6">{result}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          확인
        </button>
      </div>
    </div>
  );
}

// 투표 모달 컴포넌트
function VoteModal({ 
  title = '희생자 선택',
  players, 
  onVote, 
  onClose 
}: { 
  title?: string;
  players: Player[], 
  onVote: (targetId: string) => void,
  onClose: () => void 
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">{title}</h2>
        <div className="space-y-2">
          {players.map(player => (
            <button
              key={player.id}
              id={`player-${player.id}`}
              className={`w-full p-2 rounded ${
                selectedPlayer === player.id 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
              onClick={() => setSelectedPlayer(player.id)}
            >
              {player.nickname}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            id="cancelVoteButton"
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            취소
          </button>
          <button
            id="selectVoteButton"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            onClick={() => {
              if (selectedPlayer) {
                onVote(selectedPlayer);
                onClose();
              }
            }}
            disabled={!selectedPlayer}
          >
            선택
          </button>
        </div>
      </div>
    </div>
  );
}

// 희생자 알림 모달 컴포넌트
function SacrificeModal({ victimName, onClose }: { victimName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4">희생자 발생</h2>
        <p className="text-xl mb-4">{victimName}님이 희생되었습니다.</p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={onClose}
        >
          확인
        </button>
      </div>
    </div>
  );
}

// PhaseBanner 컴포넌트 수정
function PhaseBanner({ phase, countdown, day }: { phase: GamePhase; countdown: string; day: number }) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-4 text-center py-3 rounded-lg bg-secondary text-primary transition-colors duration-500">
      <span className="text-2xl mr-2">{phase === 'night' ? '🌙' : '☀️'}</span>
      <span className="text-xl font-bold">{day}일차 {phase === 'night' ? '밤' : '낮'}</span>
      {countdown && <span className="ml-4 text-lg font-mono">{countdown}</span>}
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [roomName, setRoomName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const playerId = localStorage.getItem('playerId');
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [modalState, setModalState] = useState({
    show: false,
    roleSeen: false,
    roleAlerted: false
  });
  const [phaseEndsAt, setPhaseEndsAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [showMafiaVoteModal, setShowMafiaVoteModal] = useState(false);
  const [showSacrificeModal, setShowSacrificeModal] = useState(false);
  const [sacrificeName, setSacrificeName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cycleCount, setCycleCount] = useState(0);   // 밤 횟수
  const [showEndModal, setShowEndModal] = useState(false);
  const [gameResult, setGameResult] = useState('');
  const [canCitizenVote, setCanCitizenVote] = useState(false);
  const [showCitizenVoteModal, setShowCitizenVoteModal] = useState(false);
  const [hasCitizenVoted, setHasCitizenVoted] = useState(false);
  const navigate = useNavigate();

  // 게임 시작 가능 여부
  const canStart = checkGameStart(players.length);
  
  // 현재 플레이어의 역할
  const currentPlayer = players.find(p => p.id === playerId);
  const myRole = currentPlayer?.role;
  const isMafia = myRole === '마피아';

  // 현재 몇 번째 낮/밤인지 계산 (1일차부터)
  const dayNumber = cycleCount + 1;

  // 카운트다운 타이머
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phaseEndsAt) {
      const tick = async () => {
        const now = new Date();
        const end = new Date(phaseEndsAt);
        const diff = end.getTime() - now.getTime();
        
        // 낮 종료 30초 전 알림
        if (
          phase === 'day' &&
          canCitizenVote &&
          diff <= 30000 &&
          !showCitizenVoteModal &&
          !hasCitizenVoted
        ) {
          setPhaseMessage('30초 후 낮 재판이 시작됩니다.');
        }

        // 낮 종료 → 투표 모달 시작
        if (
          phase === 'day' &&
          canCitizenVote &&
          diff <= 0 &&
          !showCitizenVoteModal &&
          !hasCitizenVoted
        ) {
          setShowCitizenVoteModal(true);
          setPhaseMessage('희생자 투표 중…');
          setPhaseEndsAt(new Date(Date.now() + 30000));
          return;
        }

        if (diff <= 0) {
          setCountdown('00:00');
          clearInterval(timer);

          // 시민 투표 종료 처리
          if (phase === 'day' && showCitizenVoteModal) {
            setShowCitizenVoteModal(false);
            const eliminatedId = await getCitizenVoteResult(roomId!);
            if (eliminatedId) await eliminatePlayer(roomId!, eliminatedId);
            await changePhase(roomId!, 'night');
            return;
          }

          // 일반 페이즈 변경 처리
          handlePhaseChange();
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          const countdownStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          setCountdown(countdownStr);
        }
      };
      tick();
      timer = setInterval(tick, 1000);
    } else {
      setCountdown('');
    }
    return () => clearInterval(timer);
  }, [phaseEndsAt, phase, canCitizenVote, showCitizenVoteModal, hasCitizenVoted]);

  // 페이즈 변경 처리 함수
  const handlePhaseChange = async () => {
    try {
      const newPhase = await changePhase(roomId!, phase);
      
      if (newPhase === 'night') {
        setCycleCount(prev => prev + 1);
        setPhase('night');
        setPhaseEndsAt(new Date(Date.now() + PHASE_DURATION.night * 1000));
        setPhaseMessage(PHASE_MESSAGES.night);
        setHasVoted(false);
        setSelectedPlayer(null);
        setHasCitizenVoted(false);
        // 채팅에 메시지 추가
        await supabase.from('messages').insert({
          room_id: roomId,
          player_id: null,
          nickname: '시스템',
          content: PHASE_MESSAGES.night,
          created_at: new Date().toISOString()
        });
      } else if (newPhase === 'day') {
        setPhase('day');
        setPhaseEndsAt(new Date(Date.now() + PHASE_DURATION.day * 1000));
        setPhaseMessage(PHASE_MESSAGES.day);
        setCanCitizenVote(dayNumber >= 2);
        setHasCitizenVoted(false);
        // 채팅에 메시지 추가
        await supabase.from('messages').insert({
          room_id: roomId,
          player_id: null,
          nickname: '시스템',
          content: PHASE_MESSAGES.day,
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('페이즈 변경 중 오류 발생:', error);
      setError('페이즈 변경 중 오류가 발생했습니다.');
    }
  };

  // 내 역할이 할당되고 phase가 night 이상이면 alert로 한 번만 보여주기
  useEffect(() => {
    // 게임 시작 시에만 역할 알림 표시
    if (
      status === 'starting' &&
      !modalState.roleAlerted &&
      !modalState.roleSeen &&
      !modalState.show
    ) {
      console.log('역할 알림 표시 시도:', { status, modalState });
      setModalState(prev => ({
        ...prev,
        show: true,
        roleAlerted: true
      }));
    }
    // 게임이 완전히 대기 상태로 돌아왔을 때만 모달 상태 초기화
    if (phase === 'waiting' && status === 'waiting') {
      setModalState({
        show: false,
        roleSeen: false,
        roleAlerted: false
      });
    }
  }, [status, modalState.roleAlerted, modalState.roleSeen, modalState.show]);

  // myRole을 localStorage에 저장 (Chat에서 사용)
  useEffect(() => {
    if (myRole) {
      console.log('역할 localStorage 저장:', myRole);
      localStorage.setItem('myRole', myRole);
    }
  }, [myRole]);

  // 초기 데이터 로드
  useEffect(() => {
    if (!roomId) {
      console.error('roomId가 없습니다.');
      setError('방 ID가 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    console.log('초기 데이터 로드 시작:', { 
      roomId, 
      playerId,
      currentPhase: phase,
      currentStatus: status,
    });

    const fetchData = async () => {
      try {
        // 방 정보 조회
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomError) {
          console.error('방 데이터 로드 실패:', roomError);
          setError('방 정보를 불러오는데 실패했습니다.');
          return;
        }

        if (!roomData) {
          console.error('방 데이터가 없습니다.');
          setError('존재하지 않는 방입니다.');
          return;
        }

        console.log('방 데이터 로드 성공:', {
          roomId: roomData.id,
          status: roomData.status,
          phase: roomData.phase,
        });

        // 플레이어 정보 조회
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('joined_at');

        if (playersError) {
          console.error('플레이어 데이터 로드 실패:', playersError);
          setError('플레이어 정보를 불러오는데 실패했습니다.');
          return;
        }

        console.log('플레이어 데이터 로드 성공:', {
          playerCount: playersData?.length,
          players: playersData?.map(p => ({ id: p.id, nickname: p.nickname, role: p.role }))
        });

        // 상태 업데이트
        setStatus(roomData.status);
        setPhase(roomData.phase);
        setPhaseEndsAt(roomData.phase_ends_at ? new Date(roomData.phase_ends_at) : null);
        setRoomName(roomData.name || roomData.id.slice(0,8));

        if (playersData) {
          setPlayers(playersData as Player[]);
        }
      } catch (error) {
        console.error('데이터 로드 중 오류 발생:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      }
    };

    fetchData();

    // 구독 설정
    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'players',
          filter: `room_id=eq.${roomId}`
        }, 
        (payload) => {
          console.log('플레이어 변경 감지:', payload);
          const { new: newRow, old, eventType } = payload as any;
          setPlayers((prev) => {
            switch (eventType) {
              case 'INSERT':
                return [...prev, newRow as Player];
              case 'UPDATE':
                return prev.map((p) => (p.id === newRow.id ? (newRow as Player) : p));
              case 'DELETE':
                return prev.filter((p) => p.id !== old.id);
              default:
                return prev;
            }
          });
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          console.log('방 상태 변경 감지:', payload);
          const { new: newRoom } = payload as any;
          setStatus(newRoom.status);
          setPhase(newRoom.phase);
          setPhaseEndsAt(newRoom.phase_ends_at ? new Date(newRoom.phase_ends_at) : null);
          setRoomName(newRoom.name || newRoom.id.slice(0,8));
        }
      )
      .subscribe();

    return () => {
      console.log('구독 해제');
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  // players 배열 변경 감지
  useEffect(() => {
    console.log('Players Updated:', {
      playersCount: players.length,
      firstPlayer: players[0],
      currentPlayerId: playerId,
      isCurrentPlayerHost: Boolean(playerId && players[0]?.id === playerId)
    });
  }, [players, playerId]);

  // 게임 시작 버튼 클릭 시 실행
  const startGame = async () => {
    if (!roomId) {
      console.error('게임 시작 실패: roomId가 없습니다.');
      return;
    }

    if (!playerId) {
      console.error('게임 시작 실패: playerId가 없습니다. 로비로 이동합니다.');
      navigate('/');
      return;
    }

    if (!canStart) {
      console.error('게임 시작 실패: 플레이어 수가 부족합니다.', { playerCount: players.length });
      return;
    }

    try {
      // 1) 역할 할당
      const roles = assignRoles(players.length);
      console.log('배정된 역할:', roles);

      // 각 플레이어에게 역할 할당
      const roleUpdates = players.map((player, index) => ({
        id: player.id,
        room_id: roomId,
        nickname: player.nickname,
        is_alive: true,
        role: roles[index]
      }));

      console.log('업데이트할 플레이어:', roleUpdates);

      // 역할 업데이트
      const { error: roleError } = await supabase
        .from('players')
        .upsert(roleUpdates);

      if (roleError) {
        console.error('역할 할당 실패:', roleError);
        return;
      }

      console.log('역할 할당 성공');

      // 2) 방 상태를 'starting'으로 업데이트
      const { error: startError } = await supabase
        .from('rooms')
        .update({ status: 'starting' })
        .eq('id', roomId);

      if (startError) {
        console.error('게임 시작 상태 변경 실패:', startError);
        return;
      }

      // 로컬 상태 동기화
      setStatus('starting');

      // 3) 카운트다운 모달 표시
      setModalState({
        show: true,
        roleSeen: false,
        roleAlerted: false
      });
    } catch (error) {
      console.error('게임 시작 준비 중 오류 발생:', error);
      alert('게임 시작 준비 중 오류가 발생했습니다.');
    }
  };

  // 카운트다운이 끝난 후 게임 시작
  const startGameAfterCountdown = async () => {
    console.log('카운트다운 후 게임 시작 시도:', {
      status,
      phase,
      modalState
    });
    
    try {
      // 게임 상태 업데이트
      const phaseEndsAt = new Date(Date.now() + PHASE_DURATION.day * 1000);
      const { error: gameError } = await supabase
        .from('rooms')
        .update({
          status: 'playing',
          phase: 'day',
          phase_ends_at: phaseEndsAt.toISOString()
        })
        .eq('id', roomId);

      if (gameError) {
        console.error('게임 시작 실패:', gameError);
        return;
      }

      console.log('게임 상태 업데이트 성공: playing');

      // 상태 업데이트
      setStatus('playing');
      setPhase('day');
      setPhaseEndsAt(phaseEndsAt);
      setPhaseMessage(PHASE_MESSAGES.day);

      // 채팅에 메시지 추가
      await supabase.from('messages').insert({
        room_id: roomId,
        player_id: null,
        nickname: '시스템',
        content: '게임이 시작되었습니다.',
        created_at: new Date().toISOString()
      });

      console.log('게임 시작 완료');
    } catch (error) {
      console.error('게임 시작 중 오류 발생:', error);
    }
  };

  // 전체 역할 분포 계산
  const roleCount = players.reduce((acc, p) => {
    if (p.role) acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 투표 처리
  const handleVote = async (targetId: string) => {
    if (!roomId || !playerId || hasVoted || !isMafia) {
      console.log('투표 불가:', { roomId, playerId, hasVoted, isMafia });
      return;
    }
    
    console.log('투표 시도:', { voterId: playerId, targetId });
    
    try {
      const { error } = await supabase
        .from('votes')
        .upsert({
          room_id: roomId,
          voter_id: playerId,
          target_id: targetId,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('투표 실패:', error);
        return;
      }

      console.log('투표 성공');
      setHasVoted(true);
      setSelectedPlayer(targetId);
      
      // 투표 메시지 추가
      const targetPlayer = players.find(p => p.id === targetId);
      if (targetPlayer) {
        supabase.from('messages').insert({
          room_id: roomId,
          player_id: null,
          nickname: '시스템',
          content: `${targetPlayer.nickname}님을 선택하셨습니다.`,
          created_at: new Date().toISOString(),
          mafia_only: true
        });
      }
    } catch (err) {
      console.error('투표 중 오류 발생:', err);
    }
  };

  // 게임 종료: 데이터 초기화만 수행하고 방은 유지
  const endGame = async () => {
    if (!roomId) return;

    // 게임 상태 업데이트
    const { error: gameError } = await supabase
      .from('rooms')
      .update({
        status: 'waiting',
        phase: 'waiting',
        phase_ends_at: null
      })
      
      .eq('id', roomId);

    if (gameError) {
      console.error('게임 종료 실패:', gameError);
      return;
    }

    // 상태 업데이트
    setStatus('waiting');
    setPhase('waiting');
    setPhaseEndsAt(null);
    setPhaseMessage('');
    setCycleCount(0);       // 밤 카운터 초기화
    setGameResult('');      // 이전 승패 메시지 초기화
    setModalState(prev => ({
      ...prev,
      show: false,
      roleSeen: false,
      roleAlerted: false
    }));
    setHasVoted(false);
    setSelectedPlayer(null);
    setShowMafiaVoteModal(false);
    setShowSacrificeModal(false);
    setSacrificeName('');

    // 채팅에 메시지 추가
    supabase.from('messages').insert({
      room_id: roomId,
      player_id: null,
      nickname: '시스템',
      content: '게임이 종료되었습니다.',
      created_at: new Date().toISOString()
    });
  };

  // 밤 페이즈 시 마피아 투표 모달 표시
  useEffect(() => {
    if (phase === 'night' && isMafia) {
      setShowMafiaVoteModal(true);
    }
  }, [phase, isMafia]);

  // 마피아 투표 처리
  const handleMafiaVote = async (targetId: string) => {
    const success = await mafiaVote(roomId!, playerId!, targetId);
    if (!success) return;

    const eliminatedId = await getMafiaVoteResult(roomId!);
    if (eliminatedId) {
      const victim = players.find(p => p.id === eliminatedId);
      if (victim) {
        setSacrificeName(victim.nickname);
        setShowSacrificeModal(true);
        await eliminatePlayer(roomId!, eliminatedId);
      }
    }
  };

  // 시민 투표 처리
  const handleCitizenVote = async (targetId: string) => {
    if (!roomId || !playerId || hasCitizenVoted || myRole === '마피아') return;
    const ok = await citizenVote(roomId, playerId, targetId);
    if (ok) {
      setHasCitizenVoted(true);
      setSelectedPlayer(targetId);
      
      // 투표 메시지 추가
      const targetPlayer = players.find(p => p.id === targetId);
      if (targetPlayer) {
        supabase.from('messages').insert({
          room_id: roomId,
          player_id: null,
          nickname: '시스템',
          content: `${targetPlayer.nickname}님을 선택하셨습니다.`,
          created_at: new Date().toISOString()
        });
      }
    }
  };

  return (
    <ThemeProvider phase={phase}>
      <div className="container mx-auto p-4 min-h-screen bg-primary transition-colors duration-500">
        {error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded shadow-lg z-50">
            {error}
            <button 
              className="ml-2 text-white hover:text-gray-200"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 max-w-3xl mx-auto">
            <div className="card rounded-lg shadow p-4 mb-4 transition-colors duration-500">
              <h1 className="text-2xl font-bold mb-4 text-primary">방 {roomName || roomId}</h1>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-sm text-secondary">상태: </span>
                  <span className="font-semibold text-primary">{status}</span>
                </div>
                <div>
                  <span className="text-sm text-secondary">페이즈: </span>
                  <span className="font-semibold text-primary">
                    {phase} <span className="font-semibold">DAY {dayNumber}</span>
                  </span>
                </div>
                {countdown && (
                  <div>
                    <span className="text-sm text-secondary">남은 시간: </span>
                    <span className="font-semibold text-primary">{countdown}</span>
                  </div>
                )}
              </div>
              {phaseMessage && (
                <div className="bg-blue-100 text-blue-800 p-2 rounded mb-4">
                  {phaseMessage}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {players.length > 0 ? (
                  players.map((player) => (
                    <div
                      key={player.id}
                      className={`p-4 rounded-lg transition-colors duration-500 border ${
                        player.is_alive 
                          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                          : 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800'
                      } ${
                        player.id === playerId ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {player.nickname}
                        {player.id === playerId && ' (나)'}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {player.is_alive ? '생존' : '사망'}
                      </div>
                      {player.role && player.id === playerId && (
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          역할: {player.role}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center text-secondary">
                    플레이어가 없습니다.
                  </div>
                )}
              </div>
              {status === 'waiting' && (
                <div className="mt-4">
                  <button
                    id="startGameButton"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors duration-300"
                    onClick={startGame}
                    disabled={!canStart}
                  >
                    게임 시작 {!canStart && `(${players.length}/4)`}
                  </button>
                </div>
              )}
              {status === 'playing' && (
                <div className="mt-4">
                  <button
                    id="resetGameButton"
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-300"
                    onClick={() => {
                      if (window.confirm('게임을 초기화하시겠습니까?')) {
                        endGame();
                      }
                    }}
                  >
                    게임 초기화
                  </button>
                </div>
              )}
            </div>
            <PhaseBanner phase={phase} countdown={countdown} day={cycleCount + (phase === 'day' ? 1 : 0)} />
            {roomId && players.length > 0 && (
              <Chat
                roomId={roomId}
                isHost={Boolean(playerId && players[0]?.id === playerId)}
                phase={phase}
                key={`chat-${players[0]?.id}-${playerId}`}
              />
            )}
            <div className="text-xs text-gray-500 mt-2">
              {`DEBUG - First Player: ${players[0]?.id}, Current Player: ${playerId}`}
            </div>
          </div>

          {status === 'starting' && modalState.show && (
            <CountdownModal
              role={phase === 'night' && !isMafia ? '마피아가 움직이고 있습니다...' : currentPlayer?.role || ''}
              onClose={() => {
                console.log('CountdownModal onClose 호출', {
                  phase,
                  status,
                  modalState,
                  currentPlayer
                });
                if (status === 'starting') {
                  console.log('게임 시작 프로세스 시작');
                  startGameAfterCountdown();
                }
                setModalState(prev => ({
                  ...prev,
                  show: false,
                  roleSeen: true
                }));
              }}
              isNightPhase={phase === 'night'}
            />
          )}

          {showMafiaVoteModal && (
            <VoteModal
              title="마피아 투표"
              players={players.filter(p => p.is_alive && p.role !== '마피아')}
              onVote={handleMafiaVote}
              onClose={() => setShowMafiaVoteModal(false)}
            />
          )}

          {showSacrificeModal && (
            <SacrificeModal
              victimName={sacrificeName}
              onClose={() => setShowSacrificeModal(false)}
            />
          )}
          {showEndModal && (
            <EndGameModal
              result={gameResult}
              onClose={() => {
                setShowEndModal(false);
                endGame();            // 방을 waiting 상태로 초기화
              }}
            />
          )}

          {showCitizenVoteModal && (
            <VoteModal
              title="낮 재판 – 희생자 선택"
              players={players.filter(p => p.is_alive)}
              onVote={handleCitizenVote}
              onClose={() => setShowCitizenVoteModal(false)}
            />
          )}
        </div>
      </div>
    </ThemeProvider>
  );
} 