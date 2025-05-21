const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

// 환경 변수 설정
const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || "https://v0-txt-mafia-o3hnz9r54-ryan616s-projects.vercel.app"
const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || ""

// 개발 환경 확인
const isDev = process.env.NODE_ENV === "development"

const app = express()

// CORS 미들웨어 설정 - 모든 출처 허용
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  }),
)

// 모든 요청에 대해 CORS 헤더 추가
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin")

  // OPTIONS 요청에 대한 사전 요청 처리
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }

  next()
})

// 기본 라우트 추가
app.get("/", (req, res) => {
  res.send("Mafia Game Socket.IO Server is running")
})

// 상태 확인 라우트 추가
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    rooms: Array.from(rooms.keys()),
    env: {
      port: PORT,
      railwayUrl: RAILWAY_URL,
      clientUrl: CLIENT_URL,
      nodeEnv: process.env.NODE_ENV,
      isDev,
    },
  })
})

// HTTP 서버 생성
const server = http.createServer(app)

// Socket.IO 서버 설정
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
})

// Game state
const rooms = new Map()

// 디버깅 함수: 방 정보 로깅
function logRoomInfo(roomId) {
  const room = rooms.get(roomId)
  if (!room) {
    console.log(`Room ${roomId} does not exist`)
    return
  }

  console.log(`Room ${roomId} info:`)
  console.log(`- State: ${room.state}`)
  console.log(
    `- Players (${room.players.length}):`,
    room.players.map((p) => `${p.nickname}${p.isHost ? " (Host)" : ""} [${p.id}]`),
  )
}

// 타이머 시작 함수
function startTimer(roomId, duration, callback) {
  const room = rooms.get(roomId)
  if (!room) return

  // 기존 타이머가 있으면 정리
  if (room.timer) {
    clearInterval(room.timer)
  }

  room.timeLeft = duration

  // 초기 시간 전송
  io.to(roomId).emit("timeUpdate", room.timeLeft)

  // 타이머 시작
  room.timer = setInterval(() => {
    room.timeLeft -= 1

    // 시간 업데이트 전송
    io.to(roomId).emit("timeUpdate", room.timeLeft)

    // 시간이 다 되면 콜백 실행
    if (room.timeLeft <= 0) {
      clearInterval(room.timer)
      room.timer = null
      if (callback) callback()
    }
  }, 1000)
}

// 낮 페이즈 시작 함수
function startDayPhase(roomId, day) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "day"
  room.day = day || room.day

  // 투표 초기화
  room.players.forEach((player) => {
    player.vote = null
  })

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    day: room.day,
    timeLeft: 15, // 15초로 변경
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.day}일차 낮이 시작되었습니다.`)

  // 타이머 시작 (15초)
  startTimer(roomId, 15, () => {
    // 시간이 다 되면 밤 페이즈로 전환
    endDayPhase(roomId)
  })
}

// 낮 페이즈 종료 함수
function endDayPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // 투표 집계
  const votes = {}
  room.players.forEach((player) => {
    if (player.isAlive && player.vote) {
      votes[player.vote] = (votes[player.vote] || 0) + 1
    }
  })

  // 최다 득표자 찾기
  let maxVotes = 0
  let executed = null
  let tie = false

  Object.entries(votes).forEach(([nickname, count]) => {
    if (count > maxVotes) {
      maxVotes = count
      executed = nickname
      tie = false
    } else if (count === maxVotes) {
      tie = true
    }
  })

  // 처형 처리
  if (executed && !tie) {
    const executedPlayer = room.players.find((p) => p.nickname === executed)
    if (executedPlayer) {
      executedPlayer.isAlive = false
      io.to(roomId).emit(
        "systemMessage",
        `${executedPlayer.nickname}님이 처형되었습니다. ${executedPlayer.role === "mafia" ? "마피아" : "시민"}이었습니다.`,
      )

      // 게임 종료 조건 확인
      const gameResult = checkGameEnd(room)
      if (gameResult) {
        endGame(roomId, gameResult)
        return
      }
    }
  } else {
    io.to(roomId).emit("systemMessage", "투표가 동률이거나 충분한 투표가 없어 처형이 취소되었습니다.")
  }

  // 밤 페이즈 시작
  startNightPhase(roomId)
}

// 밤 페이즈 시작 함수
function startNightPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "night"
  room.mafiaTarget = null

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "night",
    day: room.day,
    timeLeft: 15, // 15초로 변경
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.day}일차 밤이 시작되었습니다.`)

  // 타이머 시작 (15초)
  startTimer(roomId, 15, () => {
    // 시간이 다 되면 다음 낮 페이즈로 전환
    endNightPhase(roomId)
  })
}

// 밤 페이즈 종료 함수
function endNightPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // 마피아 타겟 처리
  if (room.mafiaTarget) {
    const targetPlayer = room.players.find((p) => p.nickname === room.mafiaTarget)
    if (targetPlayer && targetPlayer.isAlive) {
      targetPlayer.isAlive = false
      io.to(roomId).emit("systemMessage", `${room.day}일차 밤, 마피아가 ${targetPlayer.nickname}님을 제거했습니다.`)

      // 게임 종료 조건 확인
      const gameResult = checkGameEnd(room)
      if (gameResult) {
        endGame(roomId, gameResult)
        return
      }
    }
  } else {
    io.to(roomId).emit("systemMessage", "마피아가 아무도 제거하지 않았습니다.")
  }

  // 다음 날로 진행
  startDayPhase(roomId, room.day + 1)
}

// 게임 종료 조건 확인 함수
function checkGameEnd(room) {
  const alivePlayers = room.players.filter((p) => p.isAlive)
  const aliveMafia = alivePlayers.filter((p) => p.role === "mafia").length
  const aliveCitizens = alivePlayers.filter((p) => p.role === "citizen").length

  // 마피아가 시민과 같거나 많으면 마피아 승리
  if (aliveMafia >= aliveCitizens) {
    return "mafia"
  }

  // 마피아가 모두 죽으면 시민 승리
  if (aliveMafia === 0) {
    return "citizen"
  }

  // 게임 계속
  return null
}

// 게임 종료 함수
function endGame(roomId, winner) {
  const room = rooms.get(roomId)
  if (!room) return

  // 게임 상태 업데이트
  room.state = "gameOver"

  // 타이머 정리
  if (room.timer) {
    clearInterval(room.timer)
    room.timer = null
  }

  // 게임 종료 이벤트 전송
  io.to(roomId).emit("gameStateUpdate", {
    state: "gameOver",
    winner: winner,
  })

  // 승리 메시지 전송
  const winnerText =
    winner === "mafia"
      ? "마피아 수가 시민 수보다 같거나 많아졌습니다. 마피아의 승리입니다."
      : "모든 마피아가 처형되었습니다. 시민의 승리입니다."

  io.to(roomId).emit("systemMessage", winnerText)
}

// Socket connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Join room
  socket.on("joinRoom", ({ roomId, nickname, isHost }) => {
    console.log(`User ${nickname} (${socket.id}) joining room ${roomId}, isHost: ${isHost}`)

    // 소켓을 해당 방에 조인
    socket.join(roomId)

    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      console.log(`Creating new room: ${roomId}`)
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

    // 이미 같은 닉네임의 플레이어가 있는지 확인
    const existingPlayerIndex = room.players.findIndex((p) => p.nickname === nickname)

    if (existingPlayerIndex !== -1) {
      // 이미 존재하는 플레이어의 소켓 ID 업데이트
      console.log(
        `Player ${nickname} already exists, updating socket ID from ${room.players[existingPlayerIndex].id} to ${socket.id}`,
      )
      room.players[existingPlayerIndex].id = socket.id

      // 호스트 상태 업데이트 (클라이언트가 호스트라고 주장하면 호스트로 설정)
      if (isHost) {
        room.players[existingPlayerIndex].isHost = true
      }
    } else {
      // 새 플레이어 추가
      console.log(`Adding new player ${nickname} to room ${roomId}`)
      const player = {
        id: socket.id,
        nickname,
        isHost,
        role: null,
        isAlive: true,
        vote: null,
      }

      room.players.push(player)
    }

    // 방 정보 로깅
    logRoomInfo(roomId)

    // 업데이트된 플레이어 목록을 방의 모든 클라이언트에게 전송
    io.to(roomId).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive,
      })),
    )

    // 새로 참가한 플레이어에게 게임 상태 전송
    socket.emit("gameStateUpdate", {
      state: room.state,
      day: room.day,
      phase: room.phase,
    })

    // 게임이 진행 중이면 추가 정보 전송
    if (room.state === "playing") {
      // 플레이어 역할 전송
      const playerData = room.players.find((p) => p.id === socket.id)
      if (playerData) {
        socket.emit("gameStateUpdate", {
          state: room.state,
          role: playerData.role,
          day: room.day,
          phase: room.phase,
        })
      }

      // 현재 페이즈 정보 전송
      socket.emit("phaseChange", {
        phase: room.phase,
        day: room.day,
        timeLeft: room.timeLeft || 0,
      })

      // 현재 시간 전송
      socket.emit("timeUpdate", room.timeLeft || 0)
    }
  })

  // Start game
  socket.on("startGame", ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) return

    // 플레이어가 시작한 사람이 호스트인지 확인
    const player = room.players.find((p) => p.id === socket.id)
    if (!player || !player.isHost) {
      socket.emit("systemMessage", "게임을 시작할 권한이 없습니다.")
      return
    }

    // Check if enough players
    if (room.players.length < 2) {
      socket.emit("systemMessage", "최소 2명의 플레이어가 필요합니다.")
      return
    }

    console.log(`Starting game in room ${roomId} with ${room.players.length} players`)

    // Assign roles
    const assignRoles = (players) => {
      const shuffledPlayers = [...players]

      // Shuffle array
      for (let i = shuffledPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]]
      }

      // Determine number of mafia based on player count
      let mafiaCount
      if (players.length === 2) mafiaCount = 1
      else if (players.length <= 5) mafiaCount = 1
      else if (players.length <= 8) mafiaCount = 2
      else mafiaCount = 3

      console.log(`Assigning roles: ${mafiaCount} mafia, ${players.length - mafiaCount} citizens`)

      // Assign roles
      return shuffledPlayers.map((player, index) => ({
        ...player,
        role: index < mafiaCount ? "mafia" : "citizen",
        isAlive: true,
        vote: null,
      }))
    }

    // Assign roles
    room.players = assignRoles(room.players)

    // Update game state
    room.state = "roleReveal"
    room.day = 1
    room.phase = "day"
    room.timeLeft = 0
    room.mafiaTarget = null

    // Send role reveal to all players
    room.players.forEach((player) => {
      io.to(player.id).emit("gameStateUpdate", {
        state: "roleReveal",
        role: player.role,
      })
    })

    // 역할 배정 로그
    console.log(
      "Roles assigned:",
      room.players.map((p) => `${p.nickname}: ${p.role}`),
    )

    // Start game after 5 seconds
    setTimeout(() => {
      console.log(`Starting gameplay in room ${roomId}`)
      room.state = "playing"

      // 모든 플레이어에게 게임 시작 알림
      io.to(roomId).emit("gameStateUpdate", {
        state: "playing",
        day: room.day,
        phase: room.phase,
      })

      // 낮 페이즈 시작
      startDayPhase(roomId, 1)
    }, 5000)
  })

  // Send message
  socket.on("sendMessage", ({ roomId, sender, content, isMafiaChat = false }) => {
    const room = rooms.get(roomId)
    if (!room) return

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id)
    if (!player) return

    // 살아있는 플레이어만 채팅 가능
    if (!player.isAlive) {
      socket.emit("systemMessage", "사망한 플레이어는 채팅할 수 없습니다.")
      return
    }

    // 밤에는 마피아만 채팅 가능
    if (room.phase === "night" && player.role !== "mafia" && !isMafiaChat) {
      socket.emit("systemMessage", "밤에는 채팅할 수 없습니다.")
      return
    }

    // 마피아 채팅은 마피아에게만 전송
    if (isMafiaChat) {
      // 마피아 플레이어 ID 목록
      const mafiaIds = room.players.filter((p) => p.role === "mafia" && p.isAlive).map((p) => p.id)

      // 메시지 생성
      const message = {
        sender,
        content,
        timestamp: new Date().toISOString(),
        isMafiaChat: true,
      }

      // 마피아에게만 전송
      mafiaIds.forEach((id) => {
        io.to(id).emit("chatMessage", message)
      })
    } else {
      // 일반 채팅은 모두에게 전송
      io.to(roomId).emit("chatMessage", {
        sender,
        content,
        timestamp: new Date().toISOString(),
        isMafiaChat: false,
      })
    }
  })

  // Vote
  socket.on("vote", ({ roomId, voter, target }) => {
    const room = rooms.get(roomId)
    if (!room || room.state !== "playing" || room.phase !== "day") return

    // 플레이어 확인
    const player = room.players.find((p) => p.nickname === voter && p.isAlive)
    if (!player) return

    // 투표 대상 확인
    const targetPlayer = room.players.find((p) => p.nickname === target && p.isAlive)
    if (!targetPlayer) return

    // 투표 기록
    player.vote = target

    // 투표 집계
    const votes = {}
    room.players.forEach((p) => {
      if (p.isAlive && p.vote) {
        votes[p.vote] = (votes[p.vote] || 0) + 1
      }
    })

    // 투표 상황 전송
    io.to(roomId).emit("voteUpdate", votes)

    // 모든 생존자가 투표했는지 확인
    const alivePlayers = room.players.filter((p) => p.isAlive)
    const votedPlayers = room.players.filter((p) => p.isAlive && p.vote)

    if (votedPlayers.length >= alivePlayers.length) {
      // 모든 플레이어가 투표했으면 낮 페이즈 종료
      clearInterval(room.timer)
      room.timer = null

      // 1초 후 낮 페이즈 종료 (UI 업데이트 시간 제공)
      setTimeout(() => {
        endDayPhase(roomId)
      }, 1000)
    }
  })

  // Mafia target
  socket.on("mafiaTarget", ({ roomId, target }) => {
    const room = rooms.get(roomId)
    if (!room || room.state !== "playing" || room.phase !== "night") return

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id && p.isAlive && p.role === "mafia")
    if (!player) return

    // 타겟 확인
    const targetPlayer = room.players.find((p) => p.nickname === target && p.isAlive && p.role !== "mafia")
    if (!targetPlayer) return

    // 타겟 설정
    room.mafiaTarget = target

    // 다른 마피아에게 타겟 알림
    const mafiaIds = room.players.filter((p) => p.role === "mafia" && p.isAlive && p.id !== socket.id).map((p) => p.id)

    mafiaIds.forEach((id) => {
      io.to(id).emit("systemMessage", `${player.nickname}님이 ${target}님을 타겟으로 선택했습니다.`)
    })

    // 모든 마피아가 같은 타겟을 선택했는지 확인 (현재는 마지막 선택이 우선)
    // 밤 페이즈를 일찍 종료하지는 않음 (타이머 유지)
  })

  // Restart game
  socket.on("restartGame", ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room || room.state !== "gameOver") return

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id)
    if (!player || !player.isHost) {
      socket.emit("systemMessage", "게임을 재시작할 권한이 없습니다.")
      return
    }

    // 게임 상태 초기화
    room.state = "waiting"
    room.day = 1
    room.phase = "day"
    room.timeLeft = 0
    room.mafiaTarget = null

    if (room.timer) {
      clearInterval(room.timer)
      room.timer = null
    }

    // 플레이어 상태 초기화
    room.players = room.players.map((p) => ({
      ...p,
      role: null,
      isAlive: true,
      vote: null,
    }))

    // 게임 상태 업데이트 전송
    io.to(roomId).emit("gameStateUpdate", { state: "waiting" })

    // 플레이어 목록 업데이트 전송
    io.to(roomId).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive,
      })),
    )

    // 시스템 메시지 전송
    io.to(roomId).emit("systemMessage", "게임이 재시작되었습니다.")
  })

  // Leave room
  socket.on("leaveRoom", ({ roomId, nickname }) => {
    handlePlayerDisconnect(socket.id, roomId)
  })

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Find all rooms the player is in
    rooms.forEach((room, roomId) => {
      handlePlayerDisconnect(socket.id, roomId)
    })
  })
})

function handlePlayerDisconnect(socketId, roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // Find player
  const playerIndex = room.players.findIndex((p) => p.id === socketId)
  if (playerIndex === -1) return

  const player = room.players[playerIndex]
  console.log(`Player ${player.nickname} disconnected from room ${roomId}`)

  // If game is in progress, mark player as dead
  if (room.state === "playing") {
    io.to(roomId).emit("systemMessage", `${player.nickname}님이 게임에서 나갔습니다.`)
    player.isAlive = false

    // 게임 종료 조건 확인
    const gameResult = checkGameEnd(room)
    if (gameResult) {
      endGame(roomId, gameResult)
    }
  } else {
    // Remove player from room
    room.players.splice(playerIndex, 1)

    // If room is empty, delete it
    if (room.players.length === 0) {
      console.log(`Room ${roomId} is empty, deleting it`)

      // 타이머가 있으면 정리
      if (room.timer) {
        clearInterval(room.timer)
      }

      rooms.delete(roomId)
      return
    }

    // If host left, assign new host
    if (player.isHost && room.players.length > 0) {
      console.log(`Host ${player.nickname} left, assigning new host: ${room.players[0].nickname}`)
      room.players[0].isHost = true
    }
  }

  // 방 정보 로깅
  logRoomInfo(roomId)

  // Broadcast updated player list
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

// Start server
server.listen(PORT, () => {
  console.log(`
========================================
  Mafia Game Server
========================================
  Server running on port: ${PORT}
  Environment: ${isDev ? "Development" : "Production"}
  CORS: All origins allowed
  
  Local URL: http://localhost:${PORT}
  Railway URL: ${RAILWAY_URL || "Not deployed on Railway yet"}
  Client URL: ${CLIENT_URL}
========================================
  `)
})
