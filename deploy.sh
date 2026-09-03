#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────
REMOTE_USER="tim"
REMOTE_HOST="192.168.0.36"
REMOTE_SUDO_PASS="Ts.102030"
REMOTE_DIR="/opt/city-communication-center/city-communication-center"

# ─── Colors ──────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Server checkout has no GitHub credentials. Push a local git bundle over SSH
# and fast-forward, then rebuild compose. Do not `git pull` on the host.

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

LOCAL_HEAD="$(git rev-parse HEAD)"
info "Local HEAD ${LOCAL_HEAD:0:12}"

info "Connecting to ${REMOTE_USER}@${REMOTE_HOST}..."
REMOTE_HEAD="$(ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" \
  "git -C '${REMOTE_DIR}' rev-parse HEAD")" \
  || error "Cannot read remote git HEAD at ${REMOTE_DIR}"

if [[ "${REMOTE_HEAD}" != "${LOCAL_HEAD}" ]]; then
  if ! git cat-file -e "${REMOTE_HEAD}^{commit}" 2>/dev/null; then
    error "Remote ${REMOTE_HEAD:0:12} is not in this local repo. Fetch first."
  fi
  if ! git merge-base --is-ancestor "${REMOTE_HEAD}" "${LOCAL_HEAD}"; then
    error "Remote ${REMOTE_HEAD:0:12} is not an ancestor of ${LOCAL_HEAD:0:12}. Refusing non-ff deploy."
  fi

  BUNDLE="$(mktemp -t ccc-deploy.XXXXXX.bundle)"
  cleanup() { rm -f "${BUNDLE}"; }
  trap cleanup EXIT

  info "Bundling ${REMOTE_HEAD:0:12}..HEAD (no GitHub pull on server)"
  git bundle create "${BUNDLE}" "${REMOTE_HEAD}..HEAD"

  REMOTE_BUNDLE="/tmp/ccc-deploy-$(git rev-parse --short HEAD).bundle"
  scp -o BatchMode=yes "${BUNDLE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_BUNDLE}"

  ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
git fetch "${REMOTE_BUNDLE}" HEAD
git merge --ff-only FETCH_HEAD
rm -f "${REMOTE_BUNDLE}"
echo "  Server HEAD \$(git rev-parse --short HEAD)"
EOF
else
  info "Server already at ${LOCAL_HEAD:0:12}; rebuild only."
fi

info "Building and starting containers..."
ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
CACHE_BUST="$(git rev-parse HEAD)"
echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml build --build-arg CACHE_BUST="\${CACHE_BUST}" frontend
echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
echo "  Waiting for health checks..."
sleep 10
echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
EOF

info "Deployment complete."
