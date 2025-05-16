#!/bin/bash

# 서버 실행 스크립트

echo "마피아 게임 서버를 시작합니다..."
echo "환경: 개발 모드"
echo "포트: 3001"
echo ""

# 개발 모드로 서버 실행
NODE_ENV=development node server/index.js
