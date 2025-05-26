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

// 방 상태 정보 API 엔드포인트 추가
app.get("/api/room-stats", (req, res) => {
  try {
    const stats = getRoomStats()
    res.json(stats)
  } catch (error) {
    console.error("Error getting room stats:", error)
    res.status(500).json({ error: "Internal server error" })
  }
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

// 방 상태 정보 집계 함수
function getRoomStats() {
  const stats = {
    waiting: 0,
    playing: 0,
    gameOver: 0,
    total: rooms.size,
    timestamp: new Date().toISOString(),
  }

  for (const [roomId, room] of rooms) {
    switch (room.state) {
      case "waiting":
        stats.waiting++
        break
      case "playing":
      case "roleReveal":
        stats.playing++
        break
      case "gameOver":
        stats.gameOver++
        break
    }
  }

  return stats
}

// 사용 가능한 방 찾기 함수 수정
function findAvailableRoomForNickname(nickname) {
  for (const [roomId, room] of rooms) {
    // 대기 중인 방만 확인
    if (room.state !== "waiting") continue

    // 최대 인원 확인 (9명 미만)
    if (room.players.length >= 9) continue

    // 닉네임 중복 확인
    const hasNicknameDuplicate = room.players.some((player) => player.nickname === nickname)
    if (hasNicknameDuplicate) continue

    // 조건을 만족하는 방 발견
    return roomId
  }

  return null
}

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

// 타이머 시작 함수 수정
function startTimer(roomId, duration, callback) {
  const room = rooms.get(roomId)
  if (!room) return

  // 기존 타이머가 있으면 정리
  if (room.timer) {
    clearInterval(room.timer)
  }

  // 유효한 duration 값인지 확인
  if (typeof duration !== "number" || duration < 0) {
    console.warn(`유효하지 않은 타이머 duration: ${duration}`)
    duration = 0
  }

  room.timeLeft = duration
  console.log(`Room ${roomId}: 타이머 시작, 초기값: ${duration}초`)

  // 초기 시간 전송
  io.to(roomId).emit("timeUpdate", room.timeLeft)

  // 타이머 시작 (duration이 0보다 클 때만)
  if (duration > 0) {
    room.timer = setInterval(() => {
      room.timeLeft -= 1

      // 시간 업데이트 전송
      io.to(roomId).emit("timeUpdate", room.timeLeft)

      // 디버깅 로그 (1초마다 출력하면 너무 많으므로 5초 간격으로만 출력)
      if (room.timeLeft % 5 === 0 || room.timeLeft <= 5) {
        console.log(`Room ${roomId}: 타이머 업데이트, 남은 시간: ${room.timeLeft}초`)
      }

      // 시간이 다 되면 콜백 실행
      if (room.timeLeft <= 0) {
        clearInterval(room.timer)
        room.timer = null
        console.log(`Room ${roomId}: 타이머 종료`)
        if (callback) callback()
      }
    }, 1000)
  } else {
    // duration이 0이면 바로 콜백 실행
    console.log(`Room ${roomId}: 타이머 즉시 종료 (duration: ${duration})`)
    if (callback) callback()
  }
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

  // 페이즈 변경 이벤트 전송 (강화된 정보 포함)
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "discussion",
    day: room.day,
    timeLeft: 15, // 15초로 설정
    transitionType: "dayStart", // 페이즈 전환 타입 추가
    message: `${room.day}일차 낮이 시작되었습니다. 자유롭게 토론하세요.`,
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

// 의심 지목 단계 시작 함수 수정
function startNominationPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.subPhase = "nomination" // 의심 지목 단계
  const nominationTime = 5 // 5초로 설정

  console.log(`Room ${roomId}: 의심 지목 단계 시작, 시간: ${nominationTime}초`)

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "nomination",
    day: room.day,
    timeLeft: nominationTime,
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `의심되는 플레이어를 지목해주세요. (${nominationTime}초)`)

  // 타이머 시작
  startTimer(roomId, nominationTime, () => {
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

// 지목 결과 처리 함수 수정 - 결과 공시 후 지연 추가
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

  // 투표 상세 결과 생성 (누가 누구를 지목했는지)
  const voteDetails = room.players
    .filter((p) => p.isAlive && p.nominationVote)
    .map((p) => ({
      voter: p.nickname,
      target: p.nominationVote,
    }))

  // 지목 결과 처리
  if (nominated && !tie) {
    room.nominatedPlayer = nominated

    // 새로운 이벤트: 지목 결과 상세 정보 전송
    io.to(roomId).emit("nominationVoteResult", {
      nominated,
      votes,
      voteDetails,
      tie: false,
      reason: "최다 득표",
    })

    io.to(roomId).emit("systemMessage", `${nominated}님이 최다 득표로 지목되었습니다. 최후 변론을 시작합니다.`)

    // 중요 변경: 결과 공시 후 6초 지연을 두고 최후 변론 단계로 전환
    setTimeout(() => {
      startDefensePhase(roomId)
    }, 6000) // 6초 지연
  } else {
    // 동점이거나 투표가 없는 경우
    const reason = tie ? "동점으로 지목 무효" : "투표가 없어 지목 무효"

    // 새로운 이벤트: 지목 결과 상세 정보 전송 (지목 무효 케이스)
    io.to(roomId).emit("nominationVoteResult", {
      nominated: null,
      votes,
      voteDetails,
      tie: tie,
      reason: reason,
    })

    io.to(roomId).emit(
      "systemMessage",
      tie ? "동점으로 지목이 무효되었습니다. 밤이 찾아옵니다." : "투표가 없어 지목이 무효되었습니다. 밤이 찾아옵니다.",
    )

    // 중요 변경: 결과 공시 후 6초 지연을 두고 밤 페이즈로 전환
    setTimeout(() => {
      startNightPhase(roomId)
    }, 6000) // 6초 지연
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

// 처형 투표 단계 시작 함수 수정
function startExecutionVotePhase(roomId) {
  const room = rooms.get(roomId)
  if (!room || !room.nominatedPlayer) return

  room.subPhase = "execution" // 처형 투표 단계
  const executionTime = 10 // 10초로 설정

  console.log(`Room ${roomId}: 처형 투표 단계 시작, 시간: ${executionTime}초`)

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "day",
    subPhase: "execution",
    day: room.day,
    timeLeft: executionTime,
    nominatedPlayer: room.nominatedPlayer,
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.nominatedPlayer}님을 처형할지 투표해주세요. (${executionTime}초)`)

  // 타이머 시작
  startTimer(roomId, executionTime, () => {
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

// 처형 결과 처리 함수 수정 - 사망자 상태 전파 확인
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
    targetPlayer.isAlive = false // 플레이어 사망 처리
    voteResult.role = targetPlayer.role
    voteResult.isInnocent = targetPlayer.role === "citizen" // 무고한 시민 여부 추가

    // 시스템 메시지 전송
    io.to(roomId).emit(
      "systemMessage",
      `${targetPlayer.nickname}님이 처형되었습니다. ${targetPlayer.role === "mafia" ? "마피아" : "시민"}이었습니다.`,
    )

    // 중요: 플레이어 상태 업데이트 이벤트 명시적 전송 (사망 상태 전파)
    io.to(roomId).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive, // 사망 상태 포함
        isAi: p.isAi,
      })),
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
    timeLeft: 10, // 10초로 설정
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

// 밤 페이즈 시작 함수 수정
function startNightPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.phase = "night"
  room.subPhase = null
  room.mafiaTarget = null
  const nightTime = 15 // 15초로 설정

  console.log(`Room ${roomId}: 밤 페이즈 시작, 시간: ${nightTime}초`)

  // 페이즈 변경 이벤트 전송
  io.to(roomId).emit("phaseChange", {
    phase: "night",
    subPhase: null,
    day: room.day,
    timeLeft: nightTime,
    transitionType: "nightStart",
    message: "밤이 깊었습니다. 마피아는 서로를 확인하고 활동을 개시하세요. 시민은 조용히 밤이 지나가기를 기다립니다.",
  })

  // 시스템 메시지 전송
  io.to(roomId).emit("systemMessage", `${room.day}일차 밤이 시작되었습니다.`)

  // 타이머 시작
  startTimer(roomId, nightTime, () => {
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

// 밤 페이즈 종료 함수 수정 - 사망자 상태 전파 확인
function endNightPhase(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // 마피아 타겟 처리
  if (room.mafiaTarget) {
    const targetPlayer = room.players.find((p) => p.nickname === room.mafiaTarget)
    if (targetPlayer && targetPlayer.isAlive) {
      targetPlayer.isAlive = false // 플레이어 사망 처리
      io.to(roomId).emit("systemMessage", `${room.day}일차 밤, 마피아가 ${targetPlayer.nickname}님을 제거했습니다.`)

      // 중요: 플레이어 상태 업데이트 이벤트 명시적 전송 (사망 상태 전파)
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

  // 디버깅 로그 추가
  console.log(`[Game End Check] Room ${room.id}: Alive Mafia: ${aliveMafia}, Alive Citizens: ${aliveCitizens}`)

  // 마피아가 시민과 같거나 많으면 마피아 승리
  if (aliveMafia >= aliveCitizens) {
    console.log(`[Game End] Mafia wins: ${aliveMafia} mafia >= ${aliveCitizens} citizens`)
    return "mafia"
  }

  // 마피아가 모두 죽으면 시민 승리
  if (aliveMafia === 0) {
    console.log(`[Game End] Citizens win: No mafia left alive`)
    return "citizen"
  }

  // 게임 계속
  console.log(`[Game End] Game continues: ${aliveMafia} mafia < ${aliveCitizens} citizens`)
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

  // 게임 종료 이벤트 전송 (플레이어 역할 정보 포함)
  io.to(roomId).emit("gameStateUpdate", {
    state: "gameOver",
    winner: winner,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      role: p.role,
      isAlive: p.isAlive,
      isAi: p.isAi,
    })),
  })

  // 승리 메시지 전송
  const winnerText =
    winner === "mafia"
      ? "마피아 수가 시민 수보다 같거나 많아졌습니다. 마피아의 승리입니다."
      : "모든 마피아가 처형되었습니다. 시민의 승리입니다."

  io.to(roomId).emit("systemMessage", winnerText)

  // 디버깅 로그 추가
  console.log(`[Game Over] Room ${roomId}: ${winner} wins`)
  console.log(
    `[Game Over] Players:`,
    room.players.map((p) => `${p.nickname} (${p.role})`),
  )

  // At the end of the endGame function:
  if (rooms.has(roomId)) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} has been deleted after game over.`);
  }
}

// 방 상태 정보 요청 이벤트 핸들러 추가
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // 방 상태 정보 요청 이벤트 핸들러 추가
  socket.on("requestRoomStats", (callback) => {
    try {
      const stats = getRoomStats()
      console.log("Room stats requested:", stats)
      if (callback) {
        callback(stats)
      } else {
        socket.emit("roomStatsUpdate", stats)
      }
    } catch (error) {
      console.error("Error handling requestRoomStats:", error)
      if (callback) {
        callback({ error: "Failed to get room stats" })
      }
    }
  })

  // 빠른 참가 이벤트 핸들러 수정
  socket.on("findAvailableRoom", ({ nickname, character }, callback) => {
    console.log(`Finding available room for nickname: ${nickname}`)

    try {
      const availableRoomId = findAvailableRoomForNickname(nickname)

      if (availableRoomId) {
        console.log(`Found available room ${availableRoomId} for ${nickname}`)
        const response = { found: true, roomId: availableRoomId }

        if (callback) {
          callback(response)
        } else {
          socket.emit("availableRoom", response)
        }
      } else {
        console.log(`No available room found for ${nickname}`)
        const response = { found: false, roomId: null, reason: "nickname_conflict_or_no_room" }

        if (callback) {
          callback(response)
        } else {
          socket.emit("availableRoom", response)
        }
      }
    } catch (error) {
      console.error("Error in findAvailableRoom:", error)
      const response = { found: false, roomId: null, reason: "server_error" }

      if (callback) {
        callback(response)
      } else {
        socket.emit("availableRoom", response)
      }
    }
  })

  // Join room 이벤트 핸들러 수정
  socket.on("joinRoom", ({ roomId, nickname, isHost, character }) => {
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

    // 닉네임 중복 확인 강화 (모든 상태에서 확인)
    const existingPlayer = room.players.find((p) => p.nickname === nickname)

    if (existingPlayer && existingPlayer.id !== socket.id) {
      // 다른 소켓 ID를 가진 동일한 닉네임의 플레이어가 이미 존재
      console.log(`Nickname ${nickname} already taken in room ${roomId}`)

      socket.emit("joinRoomError", {
        type: "nickname_taken",
        message: "이미 사용 중인 닉네임입니다. 다른 닉네임을 선택해주세요.",
        takenCharacters: room.players.map((p) => p.nickname),
      })

      // 방에서 소켓 제거
      socket.leave(roomId)
      return
    }

    // 기존 플레이어 업데이트 또는 새 플레이어 추가
    const existingPlayerIndex = room.players.findIndex((p) => p.nickname === nickname)

    if (existingPlayerIndex !== -1) {
      // 이미 존재하는 플레이어의 소켓 ID 업데이트 (재연결 케이스)
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

    // 사용 중인 캐릭터 목록 전송
    io.to(roomId).emit(
      "takenCharacters",
      room.players.map((p) => p.nickname),
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

  // AI 플레이어 추가 시 새로운 캐릭터 시스템 적용
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

    // AI 캐릭터 목록에서 사용 가능한 캐릭터 찾기
    const AI_CHARACTER_LIST = [
      { emoji: "🤖", name: "로봇농부", value: "로봇농부" },
      { emoji: "🤖", name: "로봇상인", value: "로봇상인" },
      { emoji: "🤖", name: "로봇목수", value: "로봇목수" },
      { emoji: "🤖", name: "로봇요리사", value: "로봇요리사" },
      { emoji: "🤖", name: "로봇경비", value: "로봇경비" },
      { emoji: "🤖", name: "로봇의원", value: "로봇의원" },
      { emoji: "🤖", name: "로봇어부", value: "로봇어부" },
      { emoji: "🤖", name: "로봇악사", value: "로봇악사" },
      { emoji: "🤖", name: "로봇화가", value: "로봇화가" },
      { emoji: "🤖", name: "로봇교사", value: "로봇교사" },
    ]

    // 이미 사용 중인 AI 캐릭터 확인
    const usedAiCharacters = room.players.filter((p) => p.isAi).map((p) => p.nickname)

    // 사용 가능한 AI 캐릭터 찾기
    let aiCharacter = null
    for (const character of AI_CHARACTER_LIST) {
      const displayName = `${character.emoji} ${character.name}`
      if (!usedAiCharacters.includes(displayName)) {
        aiCharacter = character
        break
      }
    }

    // 모든 AI 캐릭터가 사용 중이면 숫자 붙이기
    if (!aiCharacter) {
      const randomNum = Math.floor(Math.random() * 1000)
      aiCharacter = { emoji: "🤖", name: `로봇${randomNum}`, value: `로봇${randomNum}` }
    }

    // AI 플레이어 추가
    const aiPlayer = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      nickname: `${aiCharacter.emoji} ${aiCharacter.name}`,
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

    // 사용 중인 캐릭터 목록 업데이트 전송
    io.to(roomId).emit(
      "takenCharacters",
      room.players.map((p) => p.nickname),
    )

    // 시스템 메시지 전송
    io.to(roomId).emit("systemMessage", `AI 플레이어 ${aiPlayer.nickname}이(가) 게임에 참가했습니다.`)

    if (callback) callback({ success: true })
  })

  // AI 플레이어 제거 이벤트 핸들러 추가
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
    const aiPlayers = room.players.filter((p) => p.isAi)
    if (aiPlayers.length === 0) {
      socket.emit("systemMessage", "제거할 AI 플레이어가 없습니다.")
      if (callback) callback({ success: false, error: "No AI players" })
      return
    }

    // 마지막으로 추가된 AI 플레이어 제거
    const lastAiPlayer = aiPlayers[aiPlayers.length - 1]
    const index = room.players.findIndex((p) => p.id === lastAiPlayer.id)
    if (index !== -1) {
      room.players.splice(index, 1)
      console.log(`AI player ${lastAiPlayer.nickname} removed from room ${roomId}`)

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

      // 사용 중인 캐릭터 목록 업데이트 전송
      io.to(roomId).emit(
        "takenCharacters",
        room.players.map((p) => p.nickname),
      )

      // 시스템 메시지 전송
      io.to(roomId).emit("systemMessage", `AI 플레이어 ${lastAiPlayer.nickname}이(가) 게임에서 제거되었습니다.`)

      if (callback) callback({ success: true })
    } else {
      if (callback) callback({ success: false, error: "Failed to remove AI player" })
    }
  })

  // 연결 해제 처리
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)
    handlePlayerDeparture(socket.id)
  })

  // leaveRoom 이벤트 핸들러 추가
  socket.on("leaveRoom", ({ roomId }) => {
    // roomId는 클라이언트에서 제공하지만, 실제 처리는 socket.id를 기준으로 함
    console.log(`User ${socket.id} requested to leave room ${roomId}`)
    handlePlayerDeparture(socket.id)
  })

  socket.on("sendMessage", ({ roomId, sender, content, isMafiaChat }) => {
    const room = rooms.get(roomId);
    if (!room) {
      console.error(`sendMessage: Room ${roomId} not found.`);
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      console.error(`sendMessage: Player with socket.id ${socket.id} not found in room ${roomId}.`);
      return;
    }

    if (player.nickname !== sender) {
      console.warn(`sendMessage: Sender mismatch. socket.id ${socket.id} claimed to be ${sender} but is ${player.nickname}.`);
      // Optionally, send an error to the sender or simply ignore. For now, ignore.
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      // Ignore empty messages
      return;
    }

    // Server-side authorization for chat
    let canPlayerChat = false;
    if (player.isAlive) {
      if (isMafiaChat) {
        if (room.phase === "night" && player.role === "mafia") {
          canPlayerChat = true;
        }
      } else { // Public chat
        if (room.phase === "day") {
          if (room.subPhase === "defense") {
            if (player.nickname === room.nominatedPlayer) {
              canPlayerChat = true;
            }
          } else {
            // Any other day sub-phase allows chat (discussion, nomination, execution, result)
            // Note: Client-side `canChat` is more restrictive for nomination/execution/result,
            // but server allows it here for simplicity. If stricter server-side needed, add more checks.
            // For now, aligning with basic day chat and defense speaker.
            // Let's refine to: only discussion, or defense by nominated.
             if (room.subPhase === 'discussion' || (room.subPhase === 'defense' && player.nickname === room.nominatedPlayer)) {
              canPlayerChat = true;
             }
          }
        }
      }
    }

    if (!canPlayerChat) {
      console.log(`sendMessage: Player ${sender} (${socket.id}) in room ${roomId} is not allowed to chat in the current state (isAlive: ${player.isAlive}, room.phase: ${room.phase}, room.subPhase: ${room.subPhase}, player.role: ${player.role}, isMafiaChat: ${isMafiaChat}).`);
      // Optionally send error to sender, for now, just log and ignore.
      return;
    }

    const messageData = {
      sender: player.nickname, // Use server-verified nickname
      content: trimmedContent,
      timestamp: new Date().toISOString(),
      isMafiaChat: !!isMafiaChat, // Ensure boolean
    };

    if (isMafiaChat) {
      console.log(`Broadcasting mafia chat message from ${player.nickname} in room ${roomId}`);
      room.players.forEach(p => {
        if (p.role === "mafia" && p.isAlive) {
          io.to(p.id).emit("chatMessage", messageData);
        }
      });
    } else {
      console.log(`Broadcasting public chat message from ${player.nickname} in room ${roomId}`);
      io.to(roomId).emit("chatMessage", messageData);
    }
  });

  // startGame 이벤트 핸들러 수정 (AI 플레이어 처리 확인)
  socket.on("startGame", ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) return

    // 플레이어 확인
    const player = room.players.find((p) => p.id === socket.id)
    if (!player || !player.isHost) {
      socket.emit("systemMessage", "게임을 시작할 권한이 없습니다.")
      return
    }

    // 최소 인원 확인 (2명 이상)
    if (room.players.length < 2) {
      socket.emit("systemMessage", "게임을 시작하려면 최소 2명의 플레이어가 필요합니다.")
      return
    }

    // 최대 인원 확인 (9명 이하)
    if (room.players.length > 9) {
      socket.emit("systemMessage", "게임은 최대 9명까지만 참여할 수 있습니다.")
      return
    }

    // 게임 상태 업데이트
    room.state = "roleReveal"

    // 역할 배정
    assignRoles(room)

    // 게임 상태 업데이트 이벤트 전송
    io.to(roomId).emit("gameStateUpdate", {
      state: "roleReveal",
    })

    // 각 플레이어에게 역할 전송
    room.players.forEach((p) => {
      io.to(p.id).emit("gameStateUpdate", {
        state: "roleReveal",
        role: p.role,
      })
    })

    // 5초 후 게임 시작
    setTimeout(() => {
      room.state = "playing"
      room.day = 1
      room.phase = "day"
      room.subPhase = "discussion"

      // 게임 상태 업데이트 이벤트 전송
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

  // assignRoles 함수 수정 (AI 플레이어 처리 확인)
  function assignRoles(room) {
    const players = [...room.players]

    // 플레이어 배열 섞기
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[players[i], players[j]] = [players[j], [i]]
    }

    // 마피아 수 결정
    let mafiaCount
    if (players.length <= 5) mafiaCount = 1
    else if (players.length <= 8) mafiaCount = 2
    else mafiaCount = 3

    // 역할 배정
    players.forEach((player, index) => {
      const role = index < mafiaCount ? "mafia" : "citizen"

      // room.players 배열에서 해당 플레이어 찾아 역할 설정
      const playerInRoom = room.players.find((p) => p.id === player.id)
      if (playerInRoom) {
        playerInRoom.role = role
        playerInRoom.isAlive = true
        playerInRoom.vote = null
        playerInRoom.nominationVote = null
        playerInRoom.executionVote = null
      }
    })

    console.log(
      `Assigned roles in room ${room.id}:`,
      room.players.map((p) => `${p.nickname}: ${p.role}`),
    )
  }
})

// 서버 시작
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${isDev ? "development" : "production"}`)
  console.log(`Client URL: ${CLIENT_URL}`)
  if (RAILWAY_URL) {
    console.log(`Railway URL: ${RAILWAY_URL}`)
  }
})

// Helper function to find a room by socket ID
function findRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.id === socketId)
    if (player) {
      return room
    }
  }
  return null
}

// Function to handle player departure (leave or disconnect)
function handlePlayerDeparture(socketId) {
  const room = findRoomBySocketId(socketId)
  if (!room) {
    console.log(`Player with socketId ${socketId} not found in any room.`)
    return
  }

  const playerIndex = room.players.findIndex((p) => p.id === socketId)
  if (playerIndex === -1) {
    console.log(`Player with socketId ${socketId} not found in room ${room.id}, though room was found.`)
    return
  }

  const departingPlayer = room.players[playerIndex]
  const { nickname, isHost: isHostLeaving } = departingPlayer

  // Remove player from room
  room.players.splice(playerIndex, 1)
  console.log(`Player ${nickname} (${socketId}) left room ${room.id}.`)

  // If room is now empty, delete it
  if (room.players.length === 0) {
    console.log(`Room ${room.id} is now empty. Scheduling for cleanup.`)
    if (room.timer) {
      clearInterval(room.timer)
      room.timer = null
      console.log(`Cleared timer for room ${room.id}.`)
    }
    rooms.delete(room.id)
    console.log(`Room ${room.id} has been deleted.`)
    // No further actions needed for an empty room
    return
  }

  // Handle based on room state
  if (room.state === "waiting") {
    io.to(room.id).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive,
        isAi: p.isAi,
      })),
    )
    io.to(room.id).emit(
      "takenCharacters",
      room.players.map((p) => p.nickname),
    )

    if (isHostLeaving && room.players.length > 0) {
      room.players[0].isHost = true
      const newHostNickname = room.players[0].nickname
      io.to(room.id).emit("systemMessage", `${newHostNickname} is now the host.`)
      io.to(room.id).emit(
        "playersUpdate",
        room.players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost,
          isAlive: p.isAlive,
          isAi: p.isAi,
        })),
      )
      console.log(`${newHostNickname} is now the host in room ${room.id}.`)
    }
  } else if (room.state === "playing" || room.state === "roleReveal") {
    // Conceptually, the player is marked as not alive by being removed.
    // Ensure player list is updated for all clients
    io.to(room.id).emit(
      "playersUpdate",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isAlive: p.isAlive, // This will reflect actual alive status for remaining players
        isAi: p.isAi,
      })),
    )
    io.to(room.id).emit("systemMessage", `${nickname} has left the game.`)

    // Check if game ends
    const gameResult = checkGameEnd(room)
    if (gameResult) {
      endGame(room.id, gameResult)
    } else if (isHostLeaving && room.players.length > 0 && room.state !== "gameOver") {
      // Assign new host if the leaving player was host and game is not over
      room.players[0].isHost = true
      const newHostNickname = room.players[0].nickname
      io.to(room.id).emit("systemMessage", `${newHostNickname} is now the host.`)
      io.to(room.id).emit(
        "playersUpdate",
        room.players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost,
          isAlive: p.isAlive,
          isAi: p.isAi,
        })),
      )
      console.log(`${newHostNickname} is now the host in room ${room.id} during game.`)
    }
  }
  // Log room info after departure handling
  logRoomInfo(room.id)
}
