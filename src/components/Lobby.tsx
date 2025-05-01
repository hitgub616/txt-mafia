import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { getRandomEmoji } from '../utils/randomEmoji';
import { getRandomKoreanRoomName } from '../utils/randomKoreanRoomName';
import { getRandomAnimal } from '../utils/animalEmoji';

interface Room {
  id: string;
  status: string;
  players: { nickname: string }[];
}

export default function Lobby() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetchRooms();

    // 룸 변경 구독
    const roomChannel = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .subscribe();

    // 플레이어 변경 구독 (인원/count 실시간)
    const playersChannel = supabase
      .channel('players-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
    };
  }, []);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id,status, players(nickname)')
      .order('created_at');
    if (data) setRooms(data as unknown as Room[]);
  };

  const handleJoin = async () => {
    // create or join
    const { data: existing } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'waiting')
      .limit(1)
      .single();

    let roomId = existing?.id;

    if (!roomId) {
      roomId = await createRoom();
    }

    if (!roomId) {
      alert('방 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    await joinRoom(roomId);
  };

  const createRoom = async () => {
    try {
      console.log('방 생성 시도...');
      const roomId = uuidv4();
      const { data: newRoom, error } = await supabase
        .from('rooms')
        .insert([{ 
          id: roomId, 
          status: 'waiting',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('방 생성 실패:', error);
        alert('방 생성에 실패했습니다: ' + error.message);
        return null;
      }
      
      console.log('방 생성 성공:', newRoom);
      return newRoom?.id;
    } catch (err) {
      console.error('방 생성 중 예외 발생:', err);
      alert('방 생성 중 오류가 발생했습니다.');
      return null;
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      console.log('방 참여 시도:', roomId);

      // 현재 방의 플레이어 수 확인
      const { data: players, error: countError } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomId);

      if (countError) {
        console.error('플레이어 수 확인 실패:', countError);
        alert('방 참여에 실패했습니다.');
        return;
      }

      if (players && players.length >= 9) {
        alert('이 방은 이미 가득 찼습니다. (9/9)');
        return;
      }

      // 새로운 플레이어 등록 전에 이전 플레이어 정보 삭제
      const storedPlayerId = localStorage.getItem('playerId');
      if (storedPlayerId) {
        await supabase
          .from('players')
          .delete()
          .eq('id', storedPlayerId);
      }

      // 새로운 플레이어 등록
      const animal = getRandomAnimal();
      const nickname = animal.emoji;
      const playerId = uuidv4();
      
      const { error: joinError } = await supabase
        .from('players')
        .insert({ 
          id: playerId, 
          room_id: roomId, 
          nickname,
          joined_at: new Date().toISOString()
        });

      if (joinError) {
        console.error('플레이어 등록 실패:', joinError);
        alert('방 참여에 실패했습니다: ' + joinError.message);
        return;
      }

      console.log('플레이어 등록 성공:', { playerId, nickname });

      // 로컬 저장 (본인 식별용)
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('nickname', nickname);
      localStorage.setItem('roomId', roomId);
      localStorage.setItem('emojiName', animal.name);

      navigate(`/room/${roomId}`);
    } catch (err) {
      console.error('방 참여 중 예외 발생:', err);
      alert('방 참여 중 오류가 발생했습니다.');
    }
  };

  const handleCreateRoom = async () => {
    try {
      console.log('방 만들기 버튼 클릭');
      const roomId = await createRoom();
      console.log('생성된 방 ID:', roomId);
      if (roomId) {
        await joinRoom(roomId);
      } else {
        alert('방 생성에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('방 생성 처리 중 오류:', err);
      alert('방 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-4">Text Mafia Lobby</h1>
      <div className="flex space-x-4 mb-6">
        <button 
          onClick={handleCreateRoom} 
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          방 만들기
        </button>
        <button 
          onClick={handleJoin} 
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          빠른 참가
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-2">Active Rooms</h2>
      <ul className="w-full max-w-md space-y-2">
        {rooms.map((room) => (
          <li key={room.id} className="flex justify-between items-center p-2 border rounded">
            <div className="flex items-center space-x-2">
              <span className="font-mono">{room.id.slice(0,8)}</span>
              <span>{room.players.length}/9</span>
              <span>{room.players.map((p) => p.nickname).join(' ')}</span>
            </div>
            <button
              className="text-blue-600 border px-2 py-1 rounded"
              onClick={() => navigate(`/room/${room.id}`)}
            >
              Join
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
} 