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

// AI 플레이어 이름 목록
const AI_NAMES = [
  "철수",
  "영희",
  "민수",
  "지영",
  "준호",
  "미나",
  "태호",
  "수진",
  "현우",
  "서연",
  "지훈",
  "유진",
  "민준",
  "소연",
  "재현",
  "지은",
  "도윤",
  "하은",
]

// AI 플레이어 채팅 메시지 목록
const AI_CHAT_MESSAGES = [
  "저는 확실히 시민입니다.",
  "이번 라운드에서는 조용히 지켜보겠습니다.",
  "누가 의심스러운 행동을 하고 있나요?",
  "아무도 의심되지 않네요.",
  "투표를 신중하게 해주세요.",
  "마피아는 누구일까요?",
  "어제 밤에 누가 죽었죠?",
  "저를 믿어주세요, 저는 시민입니다.",
  "마피아라면 그렇게 말하지 않을 것 같아요.",
  "이 사람이 의심스럽네요.",
]

// 마피아 AI 채팅 메시지 목록
const MAFIA_AI_CHAT_MESSAGES = [
  "저는 시민입니다, 정말로요.",
  "다른 사람을 의심해보세요.",
  "저를 믿어주세요.",
  "증거 없이 의심하지 마세요.",
  "우리 모두 침착하게 생각해봅시다.",
]

// 디버깅 함수: 방 정보 로깅
function logRoomInfo(roomId) {
  const room = rooms.get(roomId)
  if (!room) {
    console.log(`Room ${roomId} does not exist`)
    return
  }

  console.log(`Room ${roomId} info:`)
  console.log(`- State: ${room.state}`)
  console.log(`- Phase: ${room.phase}, SubPhase: ${room.subPhase}`)
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

// 낮 페이즈 시작 함수 (자유 토론 단계)
function startDayPhase(roomId, day) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "day"
  room.subPhase = "discussion" // 자유 토론 단계
  room.day = day || room.day
  room.nominatedPlayer = null // 지목된 플레이어 초기화

  // 투표 초기화
  room.players.forEach((player) => {
    player.vote = null
    player.nominationVote = null
    player.executionVote = null
  })

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "discussion",
    day: room.day,
    timeLeft: 15, // 15초로 설정
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.day}일차 낮이 시작되었습니다. 자유롭게 토론하세요.`)

  // 타이머 시작 (15초)
  startTimer(roomId, 15, () => {
    // 시간이 다 되면 의심 지목 단계로 전환
    startNominationPhase(roomId)
  })

  // AI 플레이어 채팅 (약간의 지연 후)
  setTimeout(() => {
    handleAiDiscussion(roomId)
  }, 2000)

  // AI 플레이어 토론 처리
  function handleAiDiscussion(roomId) {
    const room = rooms.get(roomId)
    if (!room || room.state !== "playing" || room.subPhase !== "discussion") return

    // AI 플레이어 찾기
    const aiPlayers = room.players.filter((p) => p.isAi && p.isAlive)
    if (aiPlayers.length === 0) return

    // 각 AI 플레이어에 대해 랜덤하게 채팅 메시지 전송
    aiPlayers.forEach((ai) => {
      if (Math.random() < 0.7) {
        // 70% 확률로 메시지 전송
        setTimeout(() => {
          if (room.subPhase !== "discussion") return // 단계가 변경되었으면 중단

          const messages = ai.role === "mafia" ? MAFIA_AI_CHAT_MESSAGES : AI_CHAT_MESSAGES
          const randomMessage = messages[Math.floor(Math.random() * messages.length)]

          io.to(roomId).emit("chatMessage", {
            sender: ai.nickname,
            content: randomMessage,
            timestamp: new Date().toISOString(),
            isMafiaChat: false,
          })
        }, Math.random() * 10000) // 0~10초 사이 랜덤 시간 후 메시지 전송
      }
    })
  }
}

// 의심 지목 단계 시작 함수
function startNominationPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.subPhase = "nomination" // 의심 지목 단계

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "nomination",
    day: room.day,
    timeLeft: 5, // 5초로 설정
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `의심되는 플레이어를 지목해주세요. (5초)`)

  // 타이머 시작 (5초)
  startTimer(roomId, 5, () => {
    // 시간이 다 되면 지목 결과 처리
    processNominationResult(roomId)
  })

  // AI 플레이어 지목 투표 처리 (약간의 지연 후)
  setTimeout(() => {
    handleAiNominationVote(roomId)
  }, 1000)
}

// AI 플레이어 지목 투표 처리
function handleAiNominationVote(roomId) {
  const room = rooms.get(roomId)
  if (!room || room.state !== "playing" || room.subPhase !== "nomination") return

  // AI 플레이어 찾기 (살아있는 AI만)
  const aiPlayers = room.players.filter((p) => p.isAi && p.isAlive)
  if (aiPlayers.length === 0) return

  // 각 AI 플레이어에 대해 투표 처리
  aiPlayers.forEach((ai) => {
    // 이미 투표했으면 스킵
    if (ai.nominationVote) return

    // 투표 대상 선택 (자신 제외 생존자 중 무작위)
    const targets = room.players.filter((p) => p.isAlive && p.nickname !== ai.nickname)

    if (targets.length > 0) {
      // 마피아 AI는 시민을 지목하려고 시도
      let targetPool = targets
      if (ai.role === "mafia") {
        const citizenTargets = targets.filter((p) => p.role === "citizen")
        if (citizenTargets.length > 0) {
          targetPool = citizenTargets
        }
      }

      // 무작위 타겟 선택
      const randomTarget = targetPool[Math.floor(Math.random() * targetPool.length)]

      // 지목 투표 기록
      ai.nominationVote = randomTarget.nickname

      // 지목 투표 집계 및 전송
      const votes = {}
      room.players.forEach((p) => {
        if (p.isAlive && p.nominationVote) {
          votes[p.nominationVote] = (votes[p.nominationVote] || 0) + 1
        }
      })

      // 투표 상황 전송
      io.to(roomId).emit("nominationVoteUpdate", votes)
    }
  })
}

// 지목 결과 처리 함수
function processNominationResult(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // 투표 집계 (살아있는 플레이어의 투표만 집계)
  const votes = {}
  room.players.forEach((p) => {
    if (p.isAlive && p.nominationVote) {
      votes[p.nominationVote] = (votes[p.nominationVote] || 0) + 1
    }
  })

  // 최다 득표자 찾기 (살아있는 플레이어 중에서만)
  let maxVotes = 0
  let nominated = null
  let tie = false

  Object.entries(votes).forEach(([nickname, count]) => {
    // 투표 대상이 살아있는지 확인
    const targetPlayer = room.players.find((p) => p.nickname === nickname && p.isAlive)
    if (!targetPlayer) return // 사망한 플레이어는 투표 대상에서 제외

    if (count > maxVotes) {
      maxVotes = count
      nominated = nickname
      tie = false
    } else if (count === maxVotes) {
      tie = true
    }
  })

  // 지목 결과 처리
  if (nominated && !tie) {
    room.nominatedPlayer = nominated
    io.to(roomId).emit("nominationResult", {
      nominated,
      votes,
    })
    io.to(roomId).emit("systemMessage", `${nominated}님이 최다 득표로 지목되었습니다. 최후 변론을 시작합니다.`)

    // 최후 변론 단계로 전환
    startDefensePhase(roomId)
  } else {
    // 동점이거나 투표가 없는 경우
    io.to(roomId).emit("nominationResult", {
      nominated: null,
      votes,
      reason: tie ? "동점으로 지목 무효" : "투표가 없어 지목 무효",
    })
    io.to(roomId).emit(
      "systemMessage",
      tie ? "동점으로 지목이 무효되었습니다. 밤이 찾아옵니다." : "투표가 없어 지목이 무효되었습니다. 밤이 찾아옵니다.",
    )

    // 밤 페이즈로 바로 전환
    startNightPhase(roomId)
  }
}

// 최후 변론 단계 시작 함수
function startDefensePhase(roomId) {
  const room = rooms.get(roomId)
  if (!room || !room.nominatedPlayer) return

  room.subPhase = "defense" // 최후 변론 단계

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "defense",
    day: room.day,
    timeLeft: 15, // 15초로 설정
    nominatedPlayer: room.nominatedPlayer,
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.nominatedPlayer}님의 최후 변론 시간입니다. (15초)`)

  // 타이머 시작 (15초)
  startTimer(roomId, 15, () => {
    // 시간이 다 되면 처형 투표 단계로 전환
    startExecutionVotePhase(roomId)
  })

  // 지목된 플레이어가 AI인 경우 변론 메시지 전송
  const nominatedPlayer = room.players.find((p) => p.nickname === room.nominatedPlayer)
  if (nominatedPlayer && nominatedPlayer.isAi) {
    setTimeout(() => {
      const defenseMessages = [
        "저는 확실히 시민입니다! 저를 믿어주세요!",
        "제가 마피아라면 이렇게 행동하지 않았을 거예요.",
        "다른 사람을 의심해보세요. 저는 결백합니다.",
        "투표하기 전에 잘 생각해주세요. 저는 시민입니다.",
        "저를 처형하면 시민팀에 손해입니다.",
      ]

      const randomMessage = defenseMessages[Math.floor(Math.random() * defenseMessages.length)]

      io.to(roomId).emit("chatMessage", {
        sender: nominatedPlayer.nickname,
        content: randomMessage,
        timestamp: new Date().toISOString(),
        isMafiaChat: false,
      })
    }, 2000) // 2초 후 변론 메시지 전송
  }
}

// 처형 투표 단계 시작 함수
function startExecutionVotePhase(roomId) {
  const room = rooms.get(roomId)
  if (!room || !room.nominatedPlayer) return

  room.subPhase = "execution" // 처형 투표 단계

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "execution",
    day: room.day,
    timeLeft: 3, // 3초로 설정
    nominatedPlayer: room.nominatedPlayer,
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.nominatedPlayer}님을 처형할지 투표해주세요. (3초)`)

  // 타이머 시작 (3초)
  startTimer(roomId, 3, () => {
    // 시간이 다 되면 처형 결과 처리
    processExecutionResult(roomId)
  })

  // AI 플레이어 처형 투표 처리 (약간의 지연 후)
  setTimeout(() => {
    handleAiExecutionVote(roomId)
  }, 1000)
}

// AI 플레이어 처형 투표 처리
function handleAiExecutionVote(roomId) {
  const room = rooms.get(roomId)
  if (!room || room.state !== "playing" || room.subPhase !== "execution" || !room.nominatedPlayer) return

  // AI 플레이어 찾기 (살아있는 AI만)
  const aiPlayers = room.players.filter((p) => p.isAi && p.isAlive)
  if (aiPlayers.length === 0) return

  // 지목된 플레이어
  const nominatedPlayer = room.players.find((p) => p.nickname === room.nominatedPlayer)
  if (!nominatedPlayer) return

  // 각 AI 플레이어에 대해 투표 처리
  aiPlayers.forEach((ai) => {
    // 이미 투표했으면 스킵
    if (ai.executionVote) return

    // 자신이 지목된 경우 투표 불가 (스킵)
    if (ai.nickname === room.nominatedPlayer) {
      return
    }

    // 마피아 AI의 경우
    if (ai.role === "mafia") {
      // 지목된 플레이어가 마피아면 반대, 시민이면 찬성
      ai.executionVote = nominatedPlayer.role === "mafia" ? "no" : "yes"
    }
    // 시민 AI의 경우
    else {
      // 랜덤하게 투표 (약간 찬성 쪽으로 치우침)
      ai.executionVote = Math.random() < 0.6 ? "yes" : "no"
    }

    // 투표 집계 및 전송
    const yesVotes = room.players.filter((p) => p.isAlive && p.executionVote === "yes").length
    const noVotes = room.players.filter((p) => p.isAlive && p.executionVote === "no").length

    // 투표 상황 전송
    io.to(roomId).emit("executionVoteUpdate", { yes: yesVotes, no: noVotes })
  })
}

// 처형 결과 처리 함수
function processExecutionResult(roomId) {
  const room = rooms.get(roomId)
  if (!room || !room.nominatedPlayer) return

  room.subPhase = "result" // 결과 표시 단계

  // 투표 집계 (살아있는 플레이어의 투표만 집계, 지목된 플레이어 제외)
  const yesVotes = room.players.filter(
    (p) => p.isAlive && p.executionVote === "yes" && p.nickname !== room.nominatedPlayer,
  ).length
  const noVotes = room.players.filter(
    (p) => p.isAlive && p.executionVote === "no" && p.nickname !== room.nominatedPlayer,
  ).length
  const totalVotes = yesVotes + noVotes

  // 과반수 찬성 여부 확인
  const executed = yesVotes > totalVotes / 2

  // 처형 대상 플레이어
  const targetPlayer = room.players.find((p) => p.nickname === room.nominatedPlayer)

  // 투표 결과 객체 생성
  const voteResult = {
    target: room.nominatedPlayer,
    executed,
    votes: room.players
      .filter((p) => p.isAlive && p.executionVote !== null && p.nickname !== room.nominatedPlayer)
      .map((p) => ({
        nickname: p.nickname,
        vote: p.executionVote,
      })),
  }

  // 처형 실행
  if (executed && targetPlayer) {
    targetPlayer.isAlive = false
    voteResult.role = targetPlayer.role

    // 시스템 메시지 전송
    io.to(roomId).emit(
      "systemMessage",
      `${targetPlayer.nickname}님이 처형되었습니다. ${targetPlayer.role === "mafia" ? "마피아" : "시민"}이었습니다.`,
    )
  } else {
    // 시스템 메시지 전송
    io.to(roomId).emit("systemMessage", `${room.nominatedPlayer}님이 처형되지 않았습니다.`)
  }

  // 투표 결과 전송
  io.to(roomId).emit("executionResult", voteResult)

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "result",
    day: room.day,
    timeLeft: 10, // 10초로 설정 (이전 5초에서 변경)
    voteResult,
  })

  // 타이머 시작 (10초)
  startTimer(roomId, 10, () => {
    // 게임 종료 조건 확인
    if (executed) {
      const gameResult = checkGameEnd(room)
      if (gameResult) {
        endGame(roomId, gameResult)
        return
      }
    }

    // 밤 페이즈로 전환
    startNightPhase(roomId)
  })
}

// 밤 페이즈 시작 함수
function startNightPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "night"
  room.subPhase = null
  room.mafiaTarget = null

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "night",
    subPhase: null,
    day: room.day,
    timeLeft: 15, // 15초로 설정
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.day}일차 밤이 시작되었습니다.`)

  // 타이머 시작 (15초)
  startTimer(roomId, 15, () => {
    // 시간이 다 되면 다음 낮 페이즈로 전환
    endNightPhase(roomId)
  })

  // AI 플레이어 행동 처리 (약간의 지연 후)
  setTimeout(() => {
    handleAiNightActions(roomId)
  }, 3000)
}

// AI 플레이어 밤 행동 처리
function handleAiNightActions(roomId) {
  const room = rooms.get(roomId)
  if (!room || room.state !== "playing" || room.phase !== "night") return

  // 마피아 AI 플레이어 찾기
  const mafiaAi = room.players.filter((p) => p.isAi && p.isAlive && p.role === "mafia")
  if (mafiaAi.length === 0) return

  // 타겟이 이미 선택되었으면 스킵
  if (room.mafiaTarget) return

  // 타겟 선택 (시민 중 무작위)
  const targets = room.players.filter((p) => p.isAlive && p.role === "citizen")

  if (targets.length > 0) {
    // 무작위 타겟 선택
    const randomTarget = targets[Math.floor(Math.random() * targets.length)]

    // 타겟 설정
    room.mafiaTarget = randomTarget.nickname

    // 마피아 플레이어들에게 타겟 알림
    const mafiaIds = room.players.filter((p) => p.role === "mafia" && p.isAlive).map((p) => p.id)

    mafiaIds.forEach((id) => {
      io.to(id).emit("systemMessage", `AI 마피아가 ${randomTarget.nickname}님을 타겟으로 선택했습니다.`)
    })

    // 가끔 마피아 채팅 메시지 전송
    if (Math.random() < 0.5) {
      const randomMessage = MAFIA_AI_CHAT_MESSAGES[Math.floor(Math.random() * MAFIA_AI_CHAT_MESSAGES.length)]

      mafiaIds.forEach((id) => {
        io.to(id).emit("chatMessage", {
          sender: mafiaAi[0].nickname,
          content: randomMessage,
          timestamp: new Date().toISOString(),
          isMafiaChat: true,
        })
      })
    }
  }
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
        subPhase: null,
        timeLeft: 0,
        mafiaTarget: null,
        nominatedPlayer: null,
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
        nominationVote: null,
        executionVote: null,
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
        isAi: p.isAi,
      })),
    )

    // 새로 참가한 플레이어에게 게임 상태 전송
    socket.emit("gameStateUpdate", {
      state: room.state,
      day: room.day,
      phase: room.phase,
      subPhase: room.subPhase,
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
          subPhase: room.subPhase,
        })
      }

      // 현재 페이즈 정보 전송
      socket.emit("phaseChange", {
        phase: room.phase,
        subPhase: room.subPhase,
        day: room.day,
        timeLeft: room.timeLeft || 0,
        nominatedPlayer: room.nominatedPlayer,
      })

      // 현재 시간 전송
      socket.emit("timeUpdate", room.timeLeft || 0)

      // 현재 단계가 결과 표시 단계라면 투표 결과 전송
      if (room.phase === "day" && room.subPhase === "result" && room.voteResult) {
        socket.emit("executionResult", room.voteResult)
      }
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
        nominationVote: null,
        executionVote: null,
      }))
    }

    // Assign roles
    room.players = assignRoles(room.players)

    // Update game state
    room.state = "roleReveal"
    room.day = 1
    room.phase = "day"
    room.subPhase = null
    room.timeLeft = 0
    room.mafiaTarget = null
    room.nominatedPlayer = null

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
        subPhase: room.subPhase,
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

    // 최후 변론 단계에서는 지목된 플레이어만 채팅 가능
    if (room.phase === "day" && room.subPhase === "defense" && player.nickname !== room.nominatedPlayer) {
      socket.emit("systemMessage", "최후 변론 중에는 지목된 플레이어만 발언할 수 있습니다.")
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

  // 의심 지목 투표
  socket.on("submitNominationVote", ({ roomId, target }) => {
    const room = rooms.get(roomId)
    if (!room || room.state !== "playing" || room.phase !== "day" || room.subPhase !== "nomination") return

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id && p.isAlive)
    if (!player) return

    // 투표 대상 확인 (자기 자신은 투표 불가)
    if (target && player.nickname === target) {
      socket.emit("systemMessage", "자기 자신을 지목할 수 없습니다.")
      return
    }

    // 투표 취소 (같은 대상 다시 클릭)
    if (player.nominationVote === target) {
      player.nominationVote = null
      socket.emit("systemMessage", "지목을 취소했습니다.")
    } else {
      // 투표 기록
      player.nominationVote = target
      socket.emit("systemMessage", `${target}님을 지목했습니다.`)
    }

    // 투표 집계
    const votes = {}
    room.players.forEach((p) => {
      if (p.isAlive && p.nominationVote) {
        votes[p.nominationVote] = (votes[p.nominationVote] || 0) + 1
      }
    })

    // 투표 상황 전송
    io.to(roomId).emit("nominationVoteUpdate", votes)

    // 모든 생존자가 투표했는지 확인
    const alivePlayers = room.players.filter((p) => p.isAlive)
    const votedPlayers = room.players.filter((p) => p.isAlive && p.nominationVote)

    if (votedPlayers.length >= alivePlayers.length) {
      // 모든 플레이어가 투표했으면 지목 결과 처리
      clearInterval(room.timer)
      room.timer = null

      // 1초 후 지목 결과 처리 (UI 업데이트 시간 제공)
      setTimeout(() => {
        processNominationResult(roomId)
      }, 1000)
    }
  })

  // 처형 투표
  socket.on("submitExecutionVote", ({ roomId, vote }) => {
    const room = rooms.get(roomId)
    if (!room || room.state !== "playing" || room.phase !== "day" || room.subPhase !== "execution") return

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id && p.isAlive)
    if (!player) return

    // 투표 취소 (같은 선택 다시 클릭)
    if (player.executionVote === vote) {
      player.executionVote = null
      socket.emit("systemMessage", "투표를 취소했습니다.")
    } else {
      // 투표 기록
      player.executionVote = vote
      socket.emit("systemMessage", `${vote === "yes" ? "찬성" : "반대"}에 투표했습니다.`)
    }

    // 투표 집계
    const yesVotes = room.players.filter((p) => p.isAlive && p.executionVote === "yes").length
    const noVotes = room.players.filter((p) => p.isAlive && p.executionVote === "no").length

    // 투표 상황 전송
    io.to(roomId).emit("executionVoteUpdate", { yes: yesVotes, no: noVotes })

    // 모든 생존자가 투표했는지 확인
    const alivePlayers = room.players.filter((p) => p.isAlive)
    const votedPlayers = room.players.filter((p) => p.isAlive && p.executionVote !== null)

    if (votedPlayers.length >= alivePlayers.length) {
      // 모든 플레이어가 투표했으면 처형 결과 처리
      clearInterval(room.timer)
      room.timer = null

      // 1초 후 처형 결과 처리 (UI 업데이트 시간 제공)
      setTimeout(() => {
        processExecutionResult(roomId)
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
    room.subPhase = null
    room.timeLeft = 0
    room.mafiaTarget = null
    room.nominatedPlayer = null

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
      nominationVote: null,
      executionVote: null,
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
        isAi: p.isAi,
      })),
    )

    // 시스템 메시지 전송
    io.to(roomId).emit("systemMessage", "게임이 재시작되었습니다.")
  })

  // Leave room
  socket.on("leaveRoom", ({ roomId, nickname }) => {
    handlePlayerDisconnect(socket.id, roomId)
  })

  // AI 플레이어 추가
  socket.on("addAiPlayer", ({ roomId }, callback) => {
    const room = rooms.get(roomId)
    if (!room) {
      if (callback) callback({ success: false, error: "Room not found" })
      return
    }

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id)
    if (!player || !player.isHost) {
      socket.emit("systemMessage", "AI 플레이어를 추가할 권한이 없습니다.")
      if (callback) callback({ success: false, error: "Not authorized" })
      return
    }

    // 최대 인원 확인
    if (room.players.length >= 9) {
      socket.emit("systemMessage", "최대 인원(9명)을 초과할 수 없습니다.")
      if (callback) callback({ success: false, error: "Room is full" })
      return
    }

    // 이미 사용 중인 AI 이름 확인
    const usedNames = room.players.filter((p) => p.nickname.startsWith("AI-")).map((p) => p.nickname.substring(3))

    // 사용 가능한 AI 이름 찾기
    let aiName = null
    for (const name of AI_NAMES) {
      if (!usedNames.includes(name)) {
        aiName = name
        break
      }
    }

    // 모든 이름이 사용 중이면 숫자 붙이기
    if (!aiName) {
      aiName = `플레이어${Math.floor(Math.random() * 1000)}`
    }

    // AI 플레이어 추가
    const aiPlayer = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      nickname: `AI-${aiName}`,
      isHost: false,
      role: null,
      isAlive: true,
      vote: null,
      nominationVote: null,
      executionVote: null,
      isAi: true,
    }

    room.players.push(aiPlayer)
    console.log(`AI player ${aiPlayer.nickname} added to room ${roomId}`)

    // 업데이트된 플레이어 목록 전송
    io.to(roomId).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive,
        isAi: p.isAi,
      })),
    )

    // 시스템 메시지 전송
    io.to(roomId).emit("systemMessage", `AI 플레이어 ${aiPlayer.nickname}이(가) 게임에 참가했습니다.`)

    if (callback) callback({ success: true })
  })

  // AI 플레이어 제거
  socket.on("removeAiPlayer", ({ roomId }, callback) => {
    const room = rooms.get(roomId)
    if (!room) {
      if (callback) callback({ success: false, error: "Room not found" })
      return
    }

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id)
    if (!player || !player.isHost) {
      socket.emit("systemMessage", "AI 플레이어를 제거할 권한이 없습니다.")
      if (callback) callback({ success: false, error: "Not authorized" })
      return
    }

    // AI 플레이어 찾기
    const aiPlayerIndex = room.players.findIndex((p) => p.isAi)
    if (aiPlayerIndex === -1) {
      socket.emit("systemMessage", "제거할 AI 플레이어가 없습니다.")
      if (callback) callback({ success: false, error: "No AI player" })
      return
    }

    // AI 플레이어 제거
    const removedAi = room.players.splice(aiPlayerIndex, 1)[0]
    console.log(`AI player ${removedAi.nickname} removed from room ${roomId}`)

    // 업데이트된 플레이어 목록 전송
    io.to(roomId).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive,
        isAi: p.isAi,
      })),
    )

    // 시스템 메시지 전송
    io.to(roomId).emit("systemMessage", `AI 플레이어 ${removedAi.nickname}이(가) 게임에서 나갔습니다.`)

    if (callback) callback({ success: true })
  })

  // 빠른 참가를 위한 사용 가능한 방 찾기
  socket.on("findAvailableRoom", ({ nickname }) => {
    console.log(`User ${nickname} is looking for an available room`)

    // 참여 가능한 방 찾기 (대기 중이고 빈자리가 있는 방)
    let availableRoom = null

    for (const [roomId, room] of rooms.entries()) {
      if (room.state === "waiting" && room.players.length < 9) {
        availableRoom = roomId
        break
      }
    }

    // 결과 전송
    socket.emit("availableRoom", {
      found: !!availableRoom,
      roomId: availableRoom,
    })
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
      isAi: p.isAi,
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
