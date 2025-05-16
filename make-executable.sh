#!/bin/bash

# 스크립트에 실행 권한 부여

echo "스크립트에 실행 권한을 부여합니다..."

chmod +x setup.sh
chmod +x run-server.sh
chmod +x run-frontend.sh

echo "완료되었습니다!"
echo ""
echo "다음 명령어로 프로젝트를 설정하세요:"
echo "  ./setup.sh"
echo ""
echo "그런 다음 다음 명령어로 서버와 프론트엔드를 실행하세요:"
echo "  ./run-server.sh    # 첫 번째 터미널에서"
echo "  ./run-frontend.sh  # 두 번째 터미널에서"
