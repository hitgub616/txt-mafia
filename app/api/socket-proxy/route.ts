import { type NextRequest, NextResponse } from "next/server"

// In-memory event storage (this will be lost on server restart)
const eventStore: Record<string, { time: number; events: any[] }> = {}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const roomId = url.searchParams.get("roomId")
    const lastEventTime = Number.parseInt(url.searchParams.get("lastEventTime") || "0")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    // Get events for this room that are newer than lastEventTime
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

    // Store the event
    if (!eventStore[roomId]) {
      eventStore[roomId] = { time: Date.now(), events: [] }
    }

    eventStore[roomId].events.push({
      event,
      data,
      time: Date.now(),
    })

    // Keep only the last 100 events
    if (eventStore[roomId].events.length > 100) {
      eventStore[roomId].events = eventStore[roomId].events.slice(-100)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Socket proxy POST error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
