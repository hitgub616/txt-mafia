import type { NextRequest } from "next/server"
import { Server } from "socket.io"
import { createServer } from "http"

// 이 코드는 Edge Functions에서 실행됩니다
export const config = {
  runtime: "edge",
}

// Socket.IO 서버 인스턴스를 저장할 전역 변수
let io: any

// 게임 상태 저장
const rooms = new Map()

export default async function handler(req: NextRequest) {
  const { pathname, searchParams } = new URL(req.url)

  // Socket.IO 서버가 아직 초기화되지 않았다면 초기화
  if (!io) {
    const httpServer = createServer()
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    // Socket.IO 이벤트 핸들러 설정
    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`)

      // 방 참가
      socket.on("joinRoom", ({ roomId, nickname, isHost }) => {
        socket.join(roomId)

        // 방이 없으면 생성
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            players: [],
            state: "waiting",
            day: 1,
            phase: "day",
            timeLeft: 0,
            mafiaTarget: null,
            timer: null,
          })
        }

        const room = rooms.get(roomId)

        // 플레이어 추가
        const player = {
          id: socket.id,
          nickname,
          isHost,
          role: null,
          isAlive: true,
          vote: null,
        }

        room.players.push(player)

        // 플레이어 목록 업데이트 브로드캐스트
        io.to(roomId).emit(
          "playersUpdate",
          room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            isHost: p.isHost,
            isAlive: p.isAlive,
          })),
        )

        // 새 플레이어에게 게임 상태 전송
        socket.emit("gameStateUpdate", { state: room.state })
      })

      // 기타 게임 이벤트 핸들러...
      // (이전 server/index.js 코드에서 가져온 이벤트 핸들러들)

      // 연결 해제
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`)

        // 플레이어가 속한 모든 방 찾기
        rooms.forEach((room, roomId) => {
          handlePlayerDisconnect(socket.id, roomId)
        })
      })
    })

    // HTTP 서버 시작
    httpServer.listen(process.env.PORT || 3001)
  }

  // 클라이언트에 응답
  return new Response("Socket.IO server is running", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  })
}

// 플레이어 연결 해제 처리 함수
function handlePlayerDisconnect(socketId, roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // 플레이어 찾기
  const playerIndex = room.players.findIndex((p) => p.id === socketId)
  if (playerIndex === -1) return

  const player = room.players[playerIndex]

  // 게임 진행 중이면 플레이어를 사망 처리
  if (room.state === "playing") {
    io.to(roomId).emit("systemMessage", `${player.nickname}님이 게임에서 나갔습니다.`)

    player.isAlive = false

    // 게임 종료 조건 확인
    // (이전 코드에서 가져온 로직)
  } else {
    // 방에서 플레이어 제거
    room.players.splice(playerIndex, 1)

    // 방이 비었으면 삭제
    if (room.players.length === 0) {
      rooms.delete(roomId)
      return
    }

    // 방장이 나갔으면 새 방장 지정
    if (player.isHost) {
      room.players[0].isHost = true
    }
  }

  // 업데이트된 플레이어 목록 브로드캐스트
  io.to(roomId).emit(
    "playersUpdate",
    room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      isAlive: p.isAlive,
    })),
  )
}
