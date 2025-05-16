"use client"

import { useState, useEffect } from "react"
import type { Player, GameState } from "@/types/game"
import type { ChatMessage } from "@/types/chat"

// AI 플레이어 이름 목록
const AI_NAMES = ["AI_철수", "AI_영희", "AI_민수", "AI_지영", "AI_준호", "AI_미나", "AI_태호", "AI_수진"]

// AI 채팅 메시지 목록
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

export function useOfflineGame(roomId: string, playerNickname: string, playerCount: number) {
  const [gameState, setGameState] = useState<GameState>("waiting")
  const [players, setPlayers] = useState<Player[]>([])
  const [role, setRole] = useState<"mafia" | "citizen" | null>(null)
  const [winner, setWinner] = useState<"mafia" | "citizen" | null>(null)
  const [day, setDay] = useState(1)
  const [phase, setPhase] = useState<"day" | "night">("day")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(120)
  const [systemMessages, setSystemMessages] = useState<string[]>([])
  const [mafiaTarget, setMafiaTarget] = useState<string | null>(null)

  // Initialize game
  useEffect(() => {
    if (gameState === "waiting") {
      initializeGame()
    }
  }, [gameState])

  // Initialize game with AI players
  const initializeGame = () => {
    // Create AI players
    const aiCount = playerCount - 1 // -1 for the human player
    const aiPlayers: Player[] = []

    for (let i = 0; i < aiCount; i++) {
      aiPlayers.push({
        id: `ai-${i}`,
        nickname: AI_NAMES[i % AI_NAMES.length],
        isHost: false,
        role: null,
        isAlive: true,
        vote: null,
      })
    }

    // Add human player
    const allPlayers = [
      {
        id: "human",
        nickname: playerNickname,
        isHost: true,
        role: null,
        isAlive: true,
        vote: null,
      },
      ...aiPlayers,
    ]

    setPlayers(allPlayers)

    // Add system message
    addSystemMessage("게임이 준비되었습니다. 시작하려면 '게임 시작' 버튼을 클릭하세요.")
  }

  // Start game
  const startGame = () => {
    // Assign roles
    const assignedPlayers = assignRoles([...players])
    setPlayers(assignedPlayers)

    // Set player role
    const humanPlayer = assignedPlayers.find((p) => p.id === "human")
    setRole(humanPlayer?.role || null)

    // Update game state
    setGameState("roleReveal")

    // Add system message
    addSystemMessage("역할이 배정되었습니다.")

    // Start game after 5 seconds
    setTimeout(() => {
      setGameState("playing")
      startDay()
    }, 5000)
  }

  // Assign roles to players
  const assignRoles = (players: Player[]) => {
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

  // Start day phase
  const startDay = () => {
    setPhase("day")
    setTimeLeft(120) // 2 minutes for day phase

    // Reset votes
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        vote: null,
      })),
    )

    // Reset vote counts
    setVoteCounts({})

    // Add system message
    addSystemMessage(`${day}일차 낮이 시작되었습니다.`)

    // Start timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          endDay()
          return 0
        }
        return prev - 1
      })

      // AI players chat randomly
      if (Math.random() < 0.05) {
        // 5% chance each second
        const alivePlayers = players.filter((p) => p.isAlive && p.id !== "human")
        if (alivePlayers.length > 0) {
          const randomPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)]
          const isMafia = randomPlayer.role === "mafia"
          const messages = isMafia ? MAFIA_AI_CHAT_MESSAGES : AI_CHAT_MESSAGES
          const randomMessage = messages[Math.floor(Math.random() * messages.length)]

          // Add AI chat message
          addChatMessage(randomPlayer.nickname, randomMessage, false)

          // AI voting logic
          if (Math.random() < 0.1 && !randomPlayer.vote) {
            // 10% chance to vote
            const aliveTargets = players.filter((p) => p.isAlive && p.id !== randomPlayer.id)
            if (aliveTargets.length > 0) {
              const randomTarget = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]
              handleVote(randomPlayer.nickname, randomTarget.nickname)
            }
          }
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }

  // End day phase
  const endDay = () => {
    // Count votes
    const votes: Record<string, number> = {}
    players.forEach((player) => {
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
      const executedPlayer = players.find((p) => p.nickname === executed)
      if (executedPlayer) {
        // Mark player as dead
        setPlayers((prev) => prev.map((p) => (p.nickname === executed ? { ...p, isAlive: false } : p)))

        // Add system message
        addSystemMessage(
          `${executedPlayer.nickname}님이 처형되었습니다. ${executedPlayer.role === "mafia" ? "마피아" : "시민"}이었습니다.`,
        )

        // Check if game has ended
        const winner = checkGameEnd()
        if (winner) {
          endGame(winner)
          return
        }
      }
    } else {
      // Add system message
      addSystemMessage("투표가 동률이거나 충분한 투표가 없어 처형이 취소되었습니다.")
    }

    // Start night phase
    startNight()
  }

  // Start night phase
  const startNight = () => {
    setPhase("night")
    setTimeLeft(60) // 1 minute for night phase
    setMafiaTarget(null)

    // Add system message
    addSystemMessage(`${day}일차 밤이 시작되었습니다.`)

    // Start timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          endNight()
          return 0
        }
        return prev - 1
      })

      // AI mafia players select target
      if (!mafiaTarget && Math.random() < 0.1) {
        // 10% chance each second
        const mafiaPlayers = players.filter((p) => p.isAlive && p.role === "mafia" && p.id !== "human")
        const citizenPlayers = players.filter((p) => p.isAlive && p.role === "citizen")

        if (mafiaPlayers.length > 0 && citizenPlayers.length > 0) {
          const randomTarget = citizenPlayers[Math.floor(Math.random() * citizenPlayers.length)]
          handleMafiaTarget(randomTarget.nickname)

          // Add mafia chat message
          if (role === "mafia") {
            const randomMafia = mafiaPlayers[Math.floor(Math.random() * mafiaPlayers.length)]
            addChatMessage(randomMafia.nickname, `${randomTarget.nickname}님을 제거하는 게 어떨까요?`, true)
          }
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }

  // End night phase
  const endNight = () => {
    // Kill mafia target if one was selected
    if (mafiaTarget) {
      const targetPlayer = players.find((p) => p.nickname === mafiaTarget)
      if (targetPlayer && targetPlayer.isAlive) {
        // Mark player as dead
        setPlayers((prev) => prev.map((p) => (p.nickname === mafiaTarget ? { ...p, isAlive: false } : p)))

        // Add system message
        addSystemMessage(`${day}일차 밤, 마피아가 ${targetPlayer.nickname}님을 제거했습니다.`)

        // Check if game has ended
        const winner = checkGameEnd()
        if (winner) {
          endGame(winner)
          return
        }
      }
    } else {
      // Add system message
      addSystemMessage("마피아가 아무도 제거하지 않았습니다.")
    }

    // Increment day counter
    setDay((prev) => prev + 1)

    // Start next day
    startDay()
  }

  // Check if game has ended
  const checkGameEnd = () => {
    const alivePlayers = players.filter((p) => p.isAlive)
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

  // End game
  const endGame = (winner: "mafia" | "citizen") => {
    setWinner(winner)
    setGameState("gameOver")

    // Add system message
    const winnerText =
      winner === "mafia"
        ? "마피아 수가 시민 수보다 같거나 많아졌습니다. 마피아의 승리입니다."
        : "모든 마피아가 처형되었습니다. 시민의 승리입니다."

    addSystemMessage(winnerText)
  }

  // Restart game
  const restartGame = () => {
    setGameState("waiting")
    setDay(1)
    setPhase("day")
    setTimeLeft(0)
    setMafiaTarget(null)
    setWinner(null)
    setMessages([])
    setSystemMessages([])
    setVoteCounts({})

    // Reset players
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        role: null,
        isAlive: true,
        vote: null,
      })),
    )
  }

  // Add chat message
  const addChatMessage = (sender: string, content: string, isMafiaChat = false) => {
    const message: ChatMessage = {
      sender,
      content,
      timestamp: new Date().toISOString(),
      isMafiaChat,
    }

    setMessages((prev) => [...prev, message])
  }

  // Add system message
  const addSystemMessage = (message: string) => {
    setSystemMessages((prev) => [...prev, message])

    // Also add to chat messages
    const systemMessage: ChatMessage = {
      sender: "시스템",
      content: message,
      timestamp: new Date().toISOString(),
      isSystem: true,
    }

    setMessages((prev) => [...prev, systemMessage])
  }

  // Handle vote
  const handleVote = (voter: string, target: string) => {
    // Update player's vote
    setPlayers((prev) => prev.map((p) => (p.nickname === voter ? { ...p, vote: target } : p)))

    // Count votes
    const votes: Record<string, number> = {}
    players.forEach((p) => {
      if (p.isAlive && p.vote) {
        votes[p.vote] = (votes[p.vote] || 0) + 1
      }
    })

    // Add voter's vote
    votes[target] = (votes[target] || 0) + 1

    // Update vote counts
    setVoteCounts(votes)

    // Check if all players have voted
    const alivePlayers = players.filter((p) => p.isAlive)
    const votedPlayers = players.filter((p) => p.isAlive && p.vote)

    if (votedPlayers.length + 1 >= alivePlayers.length) {
      // +1 for the current vote
      // End day phase early
      setTimeout(() => {
        endDay()
      }, 1000)
    }
  }

  // Handle mafia target
  const handleMafiaTarget = (target: string) => {
    setMafiaTarget(target)

    // If player is mafia, end night phase early
    if (role === "mafia") {
      setTimeout(() => {
        endNight()
      }, 1000)
    }
  }

  // Send message
  const sendMessage = (content: string, isMafiaChat = false) => {
    addChatMessage(playerNickname, content, isMafiaChat)
  }

  return {
    gameState,
    players,
    role,
    winner,
    day,
    phase,
    messages,
    voteCounts,
    timeLeft,
    systemMessages,
    mafiaTarget,
    startGame,
    restartGame,
    sendMessage,
    handleVote,
    handleMafiaTarget,
  }
}
