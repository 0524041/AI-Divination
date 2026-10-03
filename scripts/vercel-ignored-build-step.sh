#!/usr/bin/env bash
#
# Vercel "Ignored Build Step"
#   exit 0  → 跳過建置（部署被取消，不算失敗）
#   exit≠0  → 照常建置
#
# 在專案 Root Directory 下執行；`-- .` 只比較該目錄的變更，因此：
#   backend 專案只看 backend/、frontend 專案只看 frontend/。
# 無法判斷前後 SHA（首次部署等）時，保險起見照常建置。
set -uo pipefail

if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ] || [ -z "${VERCEL_GIT_COMMIT_SHA:-}" ]; then
  echo "No previous SHA available; proceeding with build."
  exit 1
fi

if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- .; then
  echo "No changes under project root; skipping build."
  exit 0
fi

echo "Changes detected under project root; proceeding with build."
exit 1
