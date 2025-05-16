#!/bin/bash

# 이 스크립트는 프로젝트 설정을 자동화합니다

echo "마피아 게임 프로젝트 설정을 시작합니다..."

# node_modules가 있으면 삭제
if [ -d "node_modules" ]; then
  echo "기존 node_modules 폴더 삭제 중..."
  rm -rf node_modules
fi

# package-lock.json이 있으면 삭제
if [ -f "package-lock.json" ]; then
  echo "기존 package-lock.json 파일 삭제 중..."
  rm package-lock.json
fi

# 의존성 설치
echo "프로젝트 의존성 설치 중..."
npm install

echo "설정이 완료되었습니다!"
echo ""
echo "서버 실행 방법:"
echo "  npm run server        # 서버만 실행"
echo "  npm run dev:server    # 개발 모드로 서버 실행"
echo ""
echo "프론트엔드 실행 방법:"
echo "  npm run dev           # 프론트엔드 개발 서버 실행"
echo ""
echo "둘 다 실행 방법:"
echo "  npm run dev:all       # 프론트엔드와 서버 동시 실행"
