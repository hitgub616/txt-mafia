/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    // 클라이언트에서 사용할 환경 변수
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || "https://txtmafiav0-production.up.railway.app",
    CLIENT_URL: process.env.CLIENT_URL || "https://v0-txt-mafia-o3hnz9r54-ryan616s-projects.vercel.app",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  }
}

export default nextConfig
