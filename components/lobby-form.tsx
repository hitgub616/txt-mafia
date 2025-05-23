"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertCircle, Zap, Users, Info, RefreshCw } from "lucide-react"
import Link from "next/link"
import { io } from "socket.io-client"
import { CLIENT_CONFIG } from "@/environment-variables"
import { CHARACTER_LIST, getCharacterDisplay, type Character } from "@/lib/character-list"

interface RoomStats {
  waiting: number
  playing: number
  gameOver: number
  total: number
  timestamp: string
}

export function LobbyForm() {
  const router = useRouter()
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [roomId, setRoomId] = useState("")
  const [newRoomId, setNewRoomId] = useState("")
  const [activeTab, setActiveTab] = useState("join")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailableCharacters, setUnavailableCharacters] = useState<string[]>([])
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // 방 상태 정보 가져오기
  const fetchRoomStats = async () => {
    setIsLoadingStats(true)
    try {
      // HTTP API 엔드포인트 사용
      const socketUrl =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? `http://${window.location.hostname}:3001`
          : CLIENT_CONFIG.PUBLIC_SOCKET_URL

      const response = await fetch(`${socketUrl}/api/room-stats`)
      if (response.ok) {
        const stats = await response.json()
        setRoomStats(stats)
        console.log("Room stats fetched:", stats)
      } else {
        console.error("Failed to fetch room stats:", response.status)
      }
    } catch (error) {
      console.error("Error fetching room stats:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  // 컴포넌트 마운트 시 방 상태 정보 가져오기
  useEffect(() => {
    fetchRoomStats()

    // 30초마다 방 상태 정보 업데이트
    const interval = setInterval(fetchRoomStats, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCharacter || !roomId) return

    // Store character info in sessionStorage
    sessionStorage.setItem("nickname", getCharacterDisplay(selectedCharacter))
    sessionStorage.setItem("characterEmoji", selectedCharacter.emoji)
    sessionStorage.setItem("characterName", selectedCharacter.name)
    router.push(`/room/${roomId}`)
  }

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCharacter) return

    // Generate a random room ID if not provided
    const finalRoomId = newRoomId || Math.random().toString(36).substring(2, 8)

    // Store character info in sessionStorage
    sessionStorage.setItem("nickname", getCharacterDisplay(selectedCharacter))
    sessionStorage.setItem("characterEmoji", selectedCharacter.emoji)
    sessionStorage.setItem("characterName", selectedCharacter.name)
    sessionStorage.setItem("isHost", "true")
    router.push(`/room/${finalRoomId}`)
  }

  // handleQuickJoin 함수 수정
  const handleQuickJoin = async () => {
    if (!selectedCharacter) {
      setError("빠른 참가를 위해 캐릭터를 선택해주세요.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 서버 URL 결정
      const socketUrl =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? `http://${window.location.hostname}:3001`
          : CLIENT_CONFIG.PUBLIC_SOCKET_URL

      // 임시 소켓 연결
      const tempSocket = io(socketUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
      })

      // 연결 성공 시
      tempSocket.on("connect", () => {
        // 사용 가능한 방 찾기 요청
        tempSocket.emit("findAvailableRoom", {
          nickname: getCharacterDisplay(selectedCharacter),
          character: selectedCharacter,
        })
      })

      // 사용 가능한 방 응답 처리
      tempSocket.on("availableRoom", ({ roomId, found, reason }) => {
        tempSocket.disconnect()

        if (found && roomId) {
          // 방을 찾았으면 입장
          sessionStorage.setItem("nickname", getCharacterDisplay(selectedCharacter))
          sessionStorage.setItem("characterEmoji", selectedCharacter.emoji)
          sessionStorage.setItem("characterName", selectedCharacter.name)
          router.push(`/room/${roomId}`)
        } else {
          // 방을 찾지 못했으면 구체적인 에러 메시지 표시
          let errorMessage = "참여 가능한 방이 없습니다."

          if (reason === "nickname_conflict_or_no_room") {
            errorMessage = "현재 닉네임으로 참여 가능한 방이 없습니다. 닉네임을 변경하거나 새 방을 만들어주세요."
          } else if (reason === "server_error") {
            errorMessage = "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
          }

          setError(errorMessage)
          setIsLoading(false)
        }
      })

      // 연결 오류 처리
      tempSocket.on("connect_error", (err) => {
        console.error("빠른 참가 연결 오류:", err)
        setError("서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.")
        setIsLoading(false)
        tempSocket.disconnect()
      })

      // 5초 타임아웃
      setTimeout(() => {
        if (tempSocket.connected) {
          tempSocket.disconnect()
        }
        if (isLoading) {
          setError("서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.")
          setIsLoading(false)
        }
      }, 5000)
    } catch (err) {
      console.error("빠른 참가 오류:", err)
      setError("알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      setIsLoading(false)
    }
  }

  // 사용 가능한 캐릭터 목록 필터링
  const availableCharacters = CHARACTER_LIST.filter(
    (character) => !unavailableCharacters.includes(getCharacterDisplay(character)),
  )

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            게임 참가
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={fetchRoomStats}>
                  {isLoadingStats ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-medium">현재 서버 상태</p>
                  {roomStats ? (
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>대기 중인 방:</span>
                        <span className="font-medium text-green-600">{roomStats.waiting}개</span>
                      </div>
                      <div className="flex justify-between">
                        <span>게임 중인 방:</span>
                        <span className="font-medium text-blue-600">{roomStats.playing}개</span>
                      </div>
                      <div className="flex justify-between">
                        <span>전체 방:</span>
                        <span className="font-medium">{roomStats.total}개</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        마지막 업데이트: {new Date(roomStats.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">서버 정보를 불러오는 중...</div>
                  )}
                  <p className="text-xs text-muted-foreground">클릭하여 새로고침</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>캐릭터를 선택하고 방에 참가하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 캐릭터 선택 */}
            <div className="space-y-2">
              <Label htmlFor="character">캐릭터 선택</Label>
              <Select
                value={selectedCharacter ? getCharacterDisplay(selectedCharacter) : ""}
                onValueChange={(value) => {
                  const character = CHARACTER_LIST.find((char) => getCharacterDisplay(char) === value)
                  setSelectedCharacter(character || null)
                  setError(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="캐릭터를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {availableCharacters.map((character) => (
                    <SelectItem key={character.value} value={getCharacterDisplay(character)}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{character.emoji}</span>
                        <span>{character.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCharacter && (
                <div className="p-2 bg-secondary/50 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    선택된 캐릭터: <span className="font-medium">{getCharacterDisplay(selectedCharacter)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* 빠른 참가 버튼 */}
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              onClick={handleQuickJoin}
              disabled={isLoading || !selectedCharacter}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></div>
                  참가 가능한 방 찾는 중...
                </div>
              ) : (
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  빠른 참가
                </div>
              )}
            </Button>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            <Tabs defaultValue="join" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="join">방 참가</TabsTrigger>
                <TabsTrigger value="create">방 생성</TabsTrigger>
              </TabsList>

              <TabsContent value="join">
                <form onSubmit={handleJoinRoom} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomId">방 ID</Label>
                    <input
                      id="roomId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="참가할 방 ID를 입력하세요"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!selectedCharacter}>
                    참가하기
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="create">
                <form onSubmit={handleCreateRoom} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="newRoomId">방 ID (선택사항)</Label>
                    <input
                      id="newRoomId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="방 ID를 입력하거나 자동 생성"
                      value={newRoomId}
                      onChange={(e) => setNewRoomId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">비워두면 자동으로 생성됩니다</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={!selectedCharacter}>
                    방 생성하기
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <div className="w-full p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700 dark:text-yellow-200">
              <p className="font-medium">연결 문제가 있나요?</p>
              <p className="mt-1">
                서버 연결 상태를{" "}
                <Link href="/test" className="text-blue-600 hover:underline dark:text-blue-400">
                  테스트
                </Link>
                해보세요.
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  )
}
