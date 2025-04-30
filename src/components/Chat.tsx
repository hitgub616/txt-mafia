import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types/game';

interface ChatProps {
  roomId: string;
  isHost?: boolean;
  phase: 'waiting' | 'night' | 'day' | 'finished';
}

export default function Chat({ roomId, isHost, phase }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const nickname = localStorage.getItem('nickname') || '🤖';
  const playerId = localStorage.getItem('playerId') || uuidv4();
  const bottomRef = useRef<HTMLDivElement>(null);
  const myRole = localStorage.getItem('myRole');
  const isMafia = myRole === '마피아';

  // isHost 상태 로깅
  useEffect(() => {
    console.log('Chat Component Props:', {
      isHost,
      playerId,
      roomId,
      phase
    });
  }, [isHost, playerId, roomId, phase]);

  useEffect(() => {
    // 초기 로드
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) {
        console.error('메시지 로드 실패:', error);
        return;
      }
      console.log('초기 메시지 로드:', data);
      if (data) setMessages(data as Message[]);
    };
    fetchMessages();

    // 실시간 구독
    const channel = supabase
      .channel(`room-${roomId}-messages`)
      .on(
        'postgres_changes',
        {
          event: '*',  // 모든 이벤트 감지
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('메시지 변경 감지:', payload);
          const { eventType, new: newMessage } = payload;
          
          if (eventType === 'INSERT') {
            setMessages(prev => {
              // 중복 체크
              if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
              }
              // 새 메시지 추가
              return [...prev, newMessage as Message];
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('구독 상태:', status);
      });

    return () => {
      console.log('채널 구독 해제');
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMsg = async () => {
    if (!input.trim()) return;
    
    const newMessage = {
      id: uuidv4(),
      room_id: roomId,
      player_id: playerId,
      nickname,
      content: input.trim(),
      created_at: new Date().toISOString(),
      mafia_only: phase === 'night' && isMafia
    };

    console.log('메시지 전송 시도:', newMessage);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(newMessage)
        .select();
      
      if (error) {
        console.error('메시지 전송 실패:', {
          error,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        alert(`메시지 전송에 실패했습니다. (${error.message})`);
        return;
      }

      console.log('메시지 전송 성공:', data);
      // 로컬 상태 즉시 업데이트
      if (data) {
        setMessages(prev => [...prev, data[0] as Message]);
      }
      setInput('');
    } catch (err) {
      console.error('메시지 전송 중 예외 발생:', err);
      alert('메시지 전송 중 오류가 발생했습니다.');
    }
  };

  // 채팅 지우기 함수
  const cleanChat = async () => {
    if (!isHost) return;
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('room_id', roomId);
      
    if (error) {
      console.error('채팅 지우기 실패:', error);
      return;
    }
    
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-96 border rounded p-2 w-full bg-white">  
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">채팅</span>
        {isHost && (
          <button
            onClick={cleanChat}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded"
          >
            Clean
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 mb-2 text-sm">
        {messages
          .filter(m => !(phase === 'night' && m.mafia_only && !isMafia))
          .map((m) => (
          <div key={m.id}>
            <span className="font-semibold mr-1">{m.nickname}</span>
            <span>{m.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex space-x-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-black"
          placeholder={
            phase === 'night' 
              ? isMafia 
                ? "마피아 채팅" 
                : "밤에는 마피아만 채팅할 수 있습니다." 
              : "메시지 입력..."
          }
          value={input}
          onChange={(e) => {
            console.log('input changed:', e.target.value);
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing) {
              sendMsg();
            }
          }}
          disabled={phase === 'night' && !isMafia}
        />
        <button
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            console.log('Send clicked');
            sendMsg();
          }}
          disabled={phase === 'night' && !isMafia}
        >
          Send
        </button>
      </div>
    </div>
  );
} 