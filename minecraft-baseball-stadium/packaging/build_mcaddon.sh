#!/usr/bin/env bash
# behavior_packs/, resource_packs/ 를 하나의 .mcaddon 으로 묶는다.
# 사용법: ./packaging/build_mcaddon.sh
set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="dist"
OUT_FILE="$OUT_DIR/SCE_Baseball_Stadium.mcaddon"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

TMP="$(mktemp -d)"
mkdir -p "$TMP/behavior_packs" "$TMP/resource_packs"
cp -r behavior_packs/baseball_BP "$TMP/behavior_packs/"
cp -r resource_packs/baseball_RP "$TMP/resource_packs/"

( cd "$TMP" && zip -r -X "$OLDPWD/$OUT_FILE" behavior_packs resource_packs > /dev/null )
rm -rf "$TMP"

echo "생성 완료: $OUT_FILE"
echo "모바일: 이 파일을 기기로 옮긴 뒤 파일 관리자에서 열면(또는 Minecraft로 공유) 자동 임포트됩니다."
echo "PC: 더블클릭하면 Minecraft Bedrock이 실행되며 자동 임포트됩니다."
