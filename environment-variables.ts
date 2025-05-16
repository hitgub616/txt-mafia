/**
 * 프로젝트 환경 변수 관리 파일
 * 이 파일은 프로젝트에서 사용되는 모든 환경 변수를 중앙에서 관리합니다.
 */

// 서버 관련 환경 변수
export const SERVER_CONFIG = {
  // Socket.IO 서버 URL
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || "https://txtmafiav0-production.up.railway.app",

  // Railway 정적 URL (Railway에서 제공)
  RAILWAY_URL: process.env.RAILWAY_STATIC_URL,

  // 서버 포트 (기본값: 3001)
  PORT: process.env.PORT || 3001,

  // 클라이언트 URL (CORS 설정용)
  CLIENT_URL: process.env.CLIENT_URL || "https://v0-txt-mafia-o3hnz9r54-ryan616s-projects.vercel.app",
}

// 클라이언트 관련 환경 변수
export const CLIENT_CONFIG = {
  // 공개 Socket.IO URL (클라이언트에서 접근 가능)
  PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || "https://txtmafiav0-production.up.railway.app",

  // 개발 환경 여부
  IS_DEV: process.env.NODE_ENV === "development",

  // 클라이언트 URL
  CLIENT_URL: process.env.CLIENT_URL || "https://v0-txt-mafia-o3hnz9r54-ryan616s-projects.vercel.app",
}

/**
 * 환경 변수 디버깅 함수
 * 현재 설정된 환경 변수를 콘솔에 출력합니다.
 */
export function debugEnvironmentVariables() {
  console.log("=== 환경 변수 디버깅 ===")
  console.log("NEXT_PUBLIC_SOCKET_URL:", process.env.NEXT_PUBLIC_SOCKET_URL)
  console.log("RAILWAY_STATIC_URL:", process.env.RAILWAY_STATIC_URL)
  console.log("CLIENT_URL:", process.env.CLIENT_URL)
  console.log("NODE_ENV:", process.env.NODE_ENV)
  console.log("PORT:", process.env.PORT)
  console.log("PUBLIC_SOCKET_URL (계산됨):", CLIENT_CONFIG.PUBLIC_SOCKET_URL)
  console.log("======================")

  return {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
    CLIENT_URL: process.env.CLIENT_URL,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    PUBLIC_SOCKET_URL: CLIENT_CONFIG.PUBLIC_SOCKET_URL,
  }
}

/**
 * 환경 변수 유효성 검사
 * 필수 환경 변수가 설정되어 있는지 확인합니다.
 */
export function validateEnvironmentVariables() {
  const missingVars = []

  // 개발 환경에서 필수 환경 변수 검사
  if (process.env.NODE_ENV === "development") {
    if (!process.env.NEXT_PUBLIC_SOCKET_URL) missingVars.push("NEXT_PUBLIC_SOCKET_URL")
    if (!process.env.CLIENT_URL) missingVars.push("CLIENT_URL")
  }

  // 프로덕션 환경에서 필수 환경 변수 검사
  else if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXT_PUBLIC_SOCKET_URL) missingVars.push("NEXT_PUBLIC_SOCKET_URL")
    if (!process.env.RAILWAY_STATIC_URL) missingVars.push("RAILWAY_STATIC_URL")
    if (!process.env.CLIENT_URL) missingVars.push("CLIENT_URL")
  }

  // 누락된 환경 변수가 있으면 경고 로그 출력
  if (missingVars.length > 0) {
    console.warn(`⚠️ 누락된 환경 변수가 있습니다: ${missingVars.join(", ")}`)
    return false
  }

  return true
}
