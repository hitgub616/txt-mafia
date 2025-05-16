const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

// 환경 변수 설정
const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || "https://v0-txt-mafia.vercel.app"
const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || ""

// 개발 환경 확인
const isDev = process.env.NODE_ENV === "development"

const app = express()

// CORS 설정 수정 - 로컬호스트 허용
app.use(
  cors({
    origin: isDev
      ? ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "*"]
      : [CLIENT_URL, "https://v0-txt-mafia.vercel.app"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
)

// 기본 라우트 추가
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Mafia Game Socket.IO Server is running",
    timestamp: new Date().toISOString(),
  })
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
      corsOrigins: isDev
        ? ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "*"]
        : [CLIENT_URL, "https://v0-txt-mafia.vercel.app"],
    },
  })
})

const server = http.createServer(app)
// Socket.IO 서버 설정 - 로컬호스트 허용
const io = new Server(server, {
  cors: {
    origin: isDev
      ? ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "*"]
      : [CLIENT_URL, "https://v0-txt-mafia.vercel.app"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})

// Game state
const rooms = new Map()

// Helper functions
function assignRoles(players) {
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

function checkGameEnd(roomId) {
  const room = rooms.get(roomId)
  if (!room) return null

  const alivePlayers = room.players.filter((p) => p.isAlive)
  const aliveMafia = alivePlayers.filter((p) => p.role === "mafia").length
  const aliveCitizens = alivePlayers.filter((p) => p.role === "citizen").length

  // Mafia wins if they equal or outnumber citizens
  if (aliveMafia >= aliveCitizens) {
    return "mafia"
  }

  // Citizens win if all mafia are dead
  if (aliveMafia === 0) {
    return "citizen"
  }

  // Game continues
  return null
}

function startDay(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "day"
  room.timeLeft = 120 // 2 minutes for day phase

  // Reset votes
  room.players.forEach((player) => {
    player.vote = null
  })

  // Broadcast phase change
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    day: room.day,
    timeLeft: room.timeLeft,
  })

  io.to(roomId).emit("systemMessage", `${room.day}일차 낮이 시작되었습니다.`)

  // Start timer
  room.timer = setInterval(() => {
    room.timeLeft--

    // Broadcast time update
    io.to(roomId).emit("timeUpdate", room.timeLeft)

    // Check if all players have voted or time is up
    const alivePlayersCount = room.players.filter((p) => p.isAlive).length
    const votesCount = room.players.filter((p) => p.isAlive && p.vote !== null).length

    if (votesCount === alivePlayersCount || room.timeLeft <= 0) {
      clearInterval(room.timer)
      endDay(roomId)
    }
  }, 1000)
}

function endDay(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // Count votes
  const votes = {}
  room.players.forEach((player) => {
    if (player.isAlive && player.vote) {
      votes[player.vote] = (votes[player.vote] || 0) + 1
    }
  })

  // Find player with most votes
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

  // Execute player or announce tie
  if (executed && !tie) {
    const executedPlayer = room.players.find((p) => p.nickname === executed)
    if (executedPlayer) {
      executedPlayer.isAlive = false

      io.to(roomId).emit(
        "systemMessage",
        `${executedPlayer.nickname}님이 처형되었습니다. ${executedPlayer.role === "mafia" ? "마피아" : "시민"}이었습니다.`,
      )

      // Check if game has ended
      const winner = checkGameEnd(roomId)
      if (winner) {
        endGame(roomId, winner)
        return
      }
    }
  } else {
    io.to(roomId).emit("systemMessage", "투표가 동률이거나 충분한 투표가 없어 처형이 취소되었습니다.")
  }

  // Start night phase
  startNight(roomId)
}

function startNight(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "night"
  room.timeLeft = 60 // 1 minute for night phase
  room.mafiaTarget = null

  // Broadcast phase change
  io.to(roomId).emit("phaseChange", {
    phase: "night",
    day: room.day,
    timeLeft: room.timeLeft,
  })

  io.to(roomId).emit("systemMessage", `${room.day}일차 밤이 시작되었습니다.`)

  // Start timer
  room.timer = setInterval(() => {
    room.timeLeft--

    // Broadcast time update
    io.to(roomId).emit("timeUpdate", room.timeLeft)

    // Check if mafia has selected target or time is up
    if (room.mafiaTarget || room.timeLeft <= 0) {
      clearInterval(room.timer)
      endNight(roomId)
    }
  }, 1000)
}

function endNight(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // Kill mafia target if one was selected
  if (room.mafiaTarget) {
    const targetPlayer = room.players.find((p) => p.nickname === room.mafiaTarget)
    if (targetPlayer && targetPlayer.isAlive) {
      targetPlayer.isAlive = false

      io.to(roomId).emit("systemMessage", `${room.day}일차 밤, 마피아가 ${targetPlayer.nickname}님을 제거했습니다.`)

      // Check if game has ended
      const winner = checkGameEnd(roomId)
      if (winner) {
        endGame(roomId, winner)
        return
      }
    }
  } else {
    io.to(roomId).emit("systemMessage", "마피아가 아무도 제거하지 않았습니다.")
  }

  // Increment day counter
  room.day++

  // Start next day
  startDay(roomId)
}

function endGame(roomId, winner) {
  const room = rooms.get(roomId)
  if (!room) return

  // Clear any active timers
  if (room.timer) {
    clearInterval(room.timer)
  }

  // Update game state
  room.state = "gameOver"

  // Broadcast game over
  io.to(roomId).emit("gameStateUpdate", {
    state: "gameOver",
    winner,
  })

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

    // 플레이어 목록 로깅
    console.log(
      `Room ${roomId} players:`,
      room.players.map((p) => p.nickname),
    )

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

    // Send game state to new player
    socket.emit("gameStateUpdate", { state: room.state })
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

      // Start first day
      startDay(roomId)
    }, 5000)
  })

  // Send chat message
  socket.on("sendMessage", ({ roomId, sender, content, isMafiaChat }) => {
    const room = rooms.get(roomId)
    if (!room) return

    const message = {
      sender,
      content,
      timestamp: new Date().toISOString(),
      isMafiaChat,
    }

    // Send to appropriate audience
    if (isMafiaChat) {
      // Send only to mafia
      const mafiaPlayers = room.players.filter((p) => p.role === "mafia")
      mafiaPlayers.forEach((player) => {
        io.to(player.id).emit("chatMessage", message)
      })
    } else {
      // Send to everyone
      io.to(roomId).emit("chatMessage", message)
    }
  })

  // Vote
  socket.on("vote", ({ roomId, voter, target }) => {
    const room = rooms.get(roomId)
    if (!room || room.phase !== "day") return

    // Update player's vote
    const player = room.players.find((p) => p.nickname === voter)
    if (player && player.isAlive) {
      player.vote = target
    }

    // Count votes
    const votes = {}
    room.players.forEach((p) => {
      if (p.isAlive && p.vote) {
        votes[p.vote] = (votes[p.vote] || 0) + 1
      }
    })

    // Broadcast vote counts
    io.to(roomId).emit("voteUpdate", votes)
  })

  // Mafia target
  socket.on("mafiaTarget", ({ roomId, target }) => {
    const room = rooms.get(roomId)
    if (!room || room.phase !== "night") return

    room.mafiaTarget = target
  })

  // Restart game
  socket.on("restartGame", ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) return

    // Reset game state
    room.state = "waiting"
    room.day = 1
    room.phase = "day"
    room.timeLeft = 0
    room.mafiaTarget = null

    if (room.timer) {
      clearInterval(room.timer)
      room.timer = null
    }

    // Reset players
    room.players.forEach((player) => {
      player.role = null
      player.isAlive = true
      player.vote = null
    })

    // Broadcast game state update
    io.to(roomId).emit("gameStateUpdate", { state: "waiting" })

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

  // If game is in progress, mark player as dead
  if (room.state === "playing") {
    io.to(roomId).emit("systemMessage", `${player.nickname}님이 게임에서 나갔습니다.`)

    player.isAlive = false

    // Check if game has ended
    const winner = checkGameEnd(roomId)
    if (winner) {
      endGame(roomId, winner)
    }

    // If all players have voted or all mafia have selected target, end phase
    if (room.phase === "day") {
      const alivePlayersCount = room.players.filter((p) => p.isAlive).length
      const votesCount = room.players.filter((p) => p.isAlive && p.vote !== null).length

      if (votesCount === alivePlayersCount) {
        clearInterval(room.timer)
        endDay(roomId)
      }
    } else if (room.phase === "night") {
      const aliveMafia = room.players.filter((p) => p.isAlive && p.role === "mafia").length

      if (aliveMafia === 0) {
        clearInterval(room.timer)
        endNight(roomId)
      }
    }
  } else {
    // Remove player from room
    room.players.splice(playerIndex, 1)

    // If room is empty, delete it
    if (room.players.length === 0) {
      rooms.delete(roomId)
      return
    }

    // If host left, assign new host
    if (player.isHost) {
      room.players[0].isHost = true
    }
  }

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
 CORS: ${isDev ? "All origins allowed" : CLIENT_URL}
 
 Local URL: http://localhost:${PORT}
 Railway URL: ${RAILWAY_URL || "Not deployed on Railway yet"}
 Client URL: ${CLIENT_URL}
========================================
 `)
})
