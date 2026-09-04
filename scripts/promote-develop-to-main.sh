#!/usr/bin/env bash
set -euo pipefail

# develop → main prod promote (yenitim). Test deploy sonrası kullanın.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

if ! git diff --quiet || ! git diff --cached --quiet; then
  error "Working tree kirli. Commit veya stash sonrası tekrar deneyin."
fi

git fetch origin develop main master

DEVELOP_SHA="$(git rev-parse origin/develop)"
MAIN_SHA="$(git rev-parse origin/main)"

if [[ "${DEVELOP_SHA}" == "${MAIN_SHA}" ]]; then
  info "origin/develop zaten origin/main ile aynı (${MAIN_SHA:0:12})."
  exit 0
fi

if ! git merge-base --is-ancestor "${MAIN_SHA}" "${DEVELOP_SHA}"; then
  error "origin/develop, origin/main'in devamı değil. Rebase/merge çakışması çözülmeli."
fi

info "Fast-forward main ← develop (${MAIN_SHA:0:12} → ${DEVELOP_SHA:0:12})"
git checkout main
git pull origin main
git merge --ff-only origin/develop

info "Push origin main + master"
git push origin main
git push origin main:master

info "Prod deploy (./deploy.sh)"
"${ROOT}/deploy.sh"

info "Promote tamamlandı."
