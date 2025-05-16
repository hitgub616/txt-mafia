import { type NextRequest, NextResponse } from "next/server"
import { io } from "socket.io-client"

// 이벤트 저장소 (서버 재시작 시 초기화됨)
let socketInstance: any = null
const eventStore: Record<string, { time: number; events: any[] }> = {}

// Socket.IO 서버에 연결
function getSocketInstance() {
  if (!socketInstance) {
    const socketUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3001"
        : process.env.NEXT_PUBLIC_SOCKET_URL || "https://txtmafiav0-production.up.railway.app"

    socketInstance = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      extraHeaders: {
        Origin: process.env.CLIENT_URL || "https://v0-txt-mafia-o3hnz9r54-ryan616s-projects.vercel.app",
      },
    })

    socketInstance.on("connect", () => {
      console.log("Proxy connected to Socket.IO server")
    })

    socketInstance.on("connect_error", (err: any) => {
      console.error("Proxy connection error:", err.message)
    })

    // 모든 이벤트 리스닝
    socketInstance.onAny((event: string, ...args: any[]) => {
      const roomId = args[0]?.roomId || "global"

      if (!eventStore[roomId]) {
        eventStore[roomId] = { time: Date.now(), events: [] }
      }

      eventStore[roomId].events.push({
        event,
        data: args[0],
        time: Date.now(),
      })

      // 최대 100개 이벤트만 저장
      if (eventStore[roomId].events.length > 100) {
        eventStore[roomId].events = eventStore[roomId].events.slice(-100)
      }
    })
  }

  return socketInstance
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const roomId = url.searchParams.get("roomId")
    const lastEventTime = Number.parseInt(url.searchParams.get("lastEventTime") || "0")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    // 이 방의 이벤트 중 lastEventTime보다 새로운 이벤트 가져오기
    const roomEvents = eventStore[roomId]
    if (!roomEvents) {
      return NextResponse.json({ events: [] })
    }

    const newEvents = roomEvents.events.filter((e) => e.time > lastEventTime)

    return NextResponse.json({ events: newEvents })
  } catch (error) {
    console.error("Socket proxy GET error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data, roomId } = body

    if (!roomId || !event) {
      return NextResponse.json({ error: "Room ID and event are required" }, { status: 400 })
    }

    // Socket.IO 서버에 이벤트 전송
    const socket = getSocketInstance()
    socket.emit(event, { ...data, roomId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Socket proxy POST error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
