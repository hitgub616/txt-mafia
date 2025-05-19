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

// Socket.IO 서버 설정 - 매우 기본적인 설정으로 시작
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
  transports: ["polling"],
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
  })

  // Start game
  socket.on("startGame", ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) return

    // Check if enough players
    if (room.players.length < 4) {
      socket.emit("systemMessage", "최소 4명의 플레이어가 필요합니다.")
      return
    }

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
      if (players.length <= 5) mafiaCount = 1
      else if (players.length <= 8) mafiaCount = 2
      else mafiaCount = 3

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

    // Send role reveal to all players
    room.players.forEach((player) => {
      io.to(player.id).emit("gameStateUpdate", {
        state: "roleReveal",
        role: player.role,
      })
    })

    // Start game after 5 seconds
    setTimeout(() => {
      room.state = "playing"
      io.to(roomId).emit("gameStateUpdate", { state: "playing" })
    }, 5000)
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
  } else {
    // Remove player from room
    room.players.splice(playerIndex, 1)

    // If room is empty, delete it
    if (room.players.length === 0) {
      console.log(`Room ${roomId} is empty, deleting it`)
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
