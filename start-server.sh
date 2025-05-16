#!/bin/bash

echo "마피아 게임 서버를 시작합니다..."
echo "환경: 개발 모드"
echo "포트: 3001"
echo ""

# 필요한 패키지 확인 및 설치
if ! npm list express &> /dev/null || ! npm list socket.io &> /dev/null || ! npm list cors &> /dev/null; then
  echo "필요한 패키지를 설치합니다..."
  npm install express socket.io cors
fi

# 개발 모드로 서버 실행
NODE_ENV=development node server/index.js
