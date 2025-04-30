-- rooms 테이블 및 RLS 정책 자동 설정 스크립트
-- Supabase SQL Editor 혹은 psql 로 실행하세요.

-- 1) 테이블
create table if not exists public.rooms (
  id uuid primary key,
  status text,
  created_at timestamptz default now(),
  phase text default 'waiting',
  phase_ends_at timestamptz,
  round int default 1,
  host_id uuid,
  name text
);

-- 2) RLS 활성화
alter table public.rooms enable row level security;

-- 3) 익명 사용자 권한
-- 이미 존재할 수 있으므로, 충돌 시 DROP 후 재생성하거나 이름을 바꿔주세요.

drop policy if exists "Anon select rooms" on public.rooms;
drop policy if exists "Anon insert rooms" on public.rooms;

create policy "Anon select rooms"
  on public.rooms for select
  using (true);

create policy "Anon insert rooms"
  on public.rooms
  for insert
  with check (true);

-- 5) players 테이블
create table if not exists public.players (
  id uuid primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  nickname text,
  role text,
  is_alive boolean default true,
  joined_at timestamptz default now()
);

-- 6) RLS 활성화 및 정책
alter table public.players enable row level security;

drop policy if exists "Anon select players" on public.players;
drop policy if exists "Anon insert players" on public.players;

create policy "Anon select players"
  on public.players
  for select
  using (true);

create policy "Anon insert players"
  on public.players
  for insert
  with check (true);

-- 7) messages 테이블 (채팅)
create table if not exists public.messages (
  id uuid primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  nickname text,
  content text,
  created_at timestamptz default now(),
  mafia_only boolean default false
);

alter table public.messages enable row level security;

drop policy if exists "Anon select messages" on public.messages;
drop policy if exists "Anon insert messages" on public.messages;

create policy "Anon select messages"
  on public.messages
  for select
  using (true);

create policy "Anon insert messages"
  on public.messages
  for insert
  with check (true);

-- 1) rooms 테이블 수정
alter table public.rooms 
  add column if not exists phase text default 'waiting',
  add column if not exists phase_ends_at timestamptz,
  add column if not exists round int default 1;

-- phase 타입 생성
do $$ begin
  create type game_phase as enum ('waiting', 'night', 'day', 'vote', 'finished');
exception
  when duplicate_object then null;
end $$;

-- phase 컬럼 타입 변환
alter table public.rooms 
  alter column phase drop default,
  alter column phase type game_phase using phase::game_phase,
  alter column phase set default 'waiting'::game_phase;

-- 2) players 테이블 role 타입
do $$ begin
  create type player_role as enum ('mafia', 'doctor', 'detective', 'citizen');
exception
  when duplicate_object then null;
end $$;

alter table public.players
  alter column role type player_role using role::player_role,
  alter column role drop not null;

-- 1. 현재 방 ID 확인
WITH current_room AS (
  SELECT id FROM rooms ORDER BY created_at DESC LIMIT 1
)
-- 2. 테스트용 플레이어 추가
INSERT INTO players (id, room_id, nickname, is_alive)
SELECT 
  gen_random_uuid(),
  id,
  '테스트' || generate_series(1, 3),
  true
FROM current_room;

-- 3. 추가된 플레이어 확인
SELECT id, room_id, nickname, is_alive 
FROM players 
WHERE nickname LIKE '테스트%'
ORDER BY joined_at DESC;

-- 투표 테이블 생성
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_id, voter_id)
);

-- 투표 테이블 RLS 정책
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "투표 조회 정책"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "투표 생성 정책"
  ON votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "투표 수정 정책"
  ON votes FOR UPDATE
  USING (true); 