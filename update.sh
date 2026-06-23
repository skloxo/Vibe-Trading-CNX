#!/usr/bin/env bash
# ============================================================================
# Vibe-Trading 一键更新脚本
# 从 GitHub fork 拉取最新代码，重新安装依赖，重启服务
#
# 用法:
#   ./update.sh              # 正常更新
#   ./update.sh --skip-deps  # 跳过依赖安装（仅代码变更时加速）
#   ./update.sh --dry-run    # 仅检查，不执行
# ============================================================================

set -euo pipefail

DEPLOY_DIR="/home/skloxo/aho/vibe-trading"
REMOTE="fork"
BRANCH="main"
API_PORT=8899
HEALTH_URL="http://127.0.0.1:${API_PORT}/health"
MAX_WAIT=30

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; }

SKIP_DEPS=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-deps) SKIP_DEPS=true ;;
    --dry-run)   DRY_RUN=true ;;
    --help|-h)
      echo "用法: ./update.sh [--skip-deps] [--dry-run]"
      exit 0
      ;;
  esac
done

cd "$DEPLOY_DIR"

# ── 1. 检查 .env ──────────────────────────────────────────────────────────
if [[ ! -f agent/.env ]]; then
  err "agent/.env 不存在！请先创建配置文件。"
  exit 1
fi

# ── 2. 记录当前版本 ────────────────────────────────────────────────────────
OLD_COMMIT=$(git rev-parse --short HEAD)
echo "当前版本: ${OLD_COMMIT}"

# ── 3. 拉取更新 ────────────────────────────────────────────────────────────
log "从 ${REMOTE}/${BRANCH} 拉取更新..."
git fetch "$REMOTE" "$BRANCH" --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse "${REMOTE}/${BRANCH}")

if [[ "$LOCAL" == "$REMOTE_HEAD" ]]; then
  log "已是最新版本 (${OLD_COMMIT})，无需更新。"
  if [[ "$DRY_RUN" == true ]]; then
    exit 0
  fi
  # 仍然检查服务状态
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "服务运行正常 ✓"
  else
    warn "服务未响应，尝试重启..."
    systemctl --user restart vibe-trading-api.service
    systemctl --user restart vibe-trading-mcp.service
  fi
  exit 0
fi

NEW_COMMIT=$(git rev-parse --short "$REMOTE_HEAD")
log "发现新版本: ${OLD_COMMIT} → ${NEW_COMMIT}"

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "=== 待更新内容 ==="
  git log --oneline "${LOCAL}..${REMOTE_HEAD}"
  warn "dry-run 模式，不执行更新。"
  exit 0
fi

# ── 4. 保存依赖哈希 ────────────────────────────────────────────────────────
OLD_REQ_HASH=""
if [[ -f agent/requirements.txt ]]; then
  OLD_REQ_HASH=$(md5sum agent/requirements.txt | cut -d' ' -f1)
fi

# ── 5. 合并代码 ────────────────────────────────────────────────────────────
log "合并代码..."
git merge "${REMOTE}/${BRANCH}" --ff-only 2>&1 || {
  err "快进合并失败！可能有本地修改。"
  echo "  请手动处理: cd $DEPLOY_DIR && git status"
  exit 1
}

NEW_COMMIT=$(git rev-parse --short HEAD)
log "已更新到: ${NEW_COMMIT}"

# ── 6. 更新依赖 ────────────────────────────────────────────────────────────
if [[ "$SKIP_DEPS" == false ]] && [[ -f agent/requirements.txt ]]; then
  NEW_REQ_HASH=$(md5sum agent/requirements.txt | cut -d' ' -f1)
  if [[ "$OLD_REQ_HASH" != "$NEW_REQ_HASH" ]]; then
    log "依赖有变更，重新安装..."
    .venv/bin/pip install -e . --quiet 2>&1 | tail -3
  else
    log "依赖无变更，跳过安装。"
    # 仍然 reinstall 以更新 entry_points（新文件/删除文件影响）
    .venv/bin/pip install -e . --quiet --no-deps 2>&1 | tail -2
  fi
else
  log "跳过依赖安装。"
  .venv/bin/pip install -e . --quiet --no-deps 2>&1 | tail -2
fi

# ── 7. 重启服务 ────────────────────────────────────────────────────────────
log "重启服务..."
systemctl --user restart vibe-trading-api.service
systemctl --user restart vibe-trading-mcp.service

# ── 8. 健康检查 ────────────────────────────────────────────────────────────
log "等待服务启动..."
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo ""
    log "更新完成！${OLD_COMMIT} → ${NEW_COMMIT}"
    log "API: http://127.0.0.1:${API_PORT}"
    log "MCP: http://127.0.0.1:19340/sse"
    exit 0
  fi
  printf "."
  sleep 1
done

echo ""
err "服务启动超时（${MAX_WAIT}s）！"
echo "  检查日志: journalctl --user -u vibe-trading-api -n 50 --no-pager"
exit 1
