#!/usr/bin/env bash
set -euo pipefail

# Test ortamı: https://testtim.tire.bel.tr @ 192.168.0.37
# Prod için deploy.sh kullanın (.36 / yenitim.tire.bel.tr).

REMOTE_USER="tim"
REMOTE_HOST="192.168.0.37"
REMOTE_SUDO_PASS="Ts.102030"
REMOTE_DIR="/opt/city-communication-center/city-communication-center"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" != "${DEPLOY_BRANCH}" ]]; then
  error "Test deploy yalnızca '${DEPLOY_BRANCH}' branch'inden yapılır (şu an: ${CURRENT_BRANCH})."
fi

LOCAL_HEAD="$(git rev-parse HEAD)"
info "Test deploy branch=${DEPLOY_BRANCH} HEAD ${LOCAL_HEAD:0:12}"

info "Connecting to ${REMOTE_USER}@${REMOTE_HOST} (TEST)..."
REMOTE_HEAD="$(ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" \
  "git -C '${REMOTE_DIR}' rev-parse HEAD" 2>/dev/null || true)"

if [[ -z "${REMOTE_HEAD}" ]]; then
  warn "Remote checkout yok; sunucuda ilk kurulum gerekebilir."
  warn "VPN açıkken: git clone + checkout ${DEPLOY_BRANCH} → ${REMOTE_DIR}"
  error "Test sunucusunda git HEAD okunamadı."
fi

if [[ "${REMOTE_HEAD}" != "${LOCAL_HEAD}" ]]; then
  if ! git cat-file -e "${REMOTE_HEAD}^{commit}" 2>/dev/null; then
    error "Remote ${REMOTE_HEAD:0:12} bu repoda yok. Önce origin/${DEPLOY_BRANCH} fetch edin."
  fi
  if ! git merge-base --is-ancestor "${REMOTE_HEAD}" "${LOCAL_HEAD}"; then
    error "Remote ${REMOTE_HEAD:0:12}, ${LOCAL_HEAD:0:12} atası değil. Test sunucusunda ff dışı durum var."
  fi

  BUNDLE="$(mktemp -t ccc-deploy-test.XXXXXX.bundle)"
  cleanup() { rm -f "${BUNDLE}"; }
  trap cleanup EXIT

  info "Bundling ${REMOTE_HEAD:0:12}..HEAD (GitHub pull yok)"
  git bundle create "${BUNDLE}" "${REMOTE_HEAD}..HEAD"

  REMOTE_BUNDLE="/tmp/ccc-deploy-test-$(git rev-parse --short HEAD).bundle"
  scp -o BatchMode=yes "${BUNDLE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_BUNDLE}"

  ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
git fetch "${REMOTE_BUNDLE}" HEAD
git merge --ff-only FETCH_HEAD
rm -f "${REMOTE_BUNDLE}"
echo "  Test server HEAD \$(git rev-parse --short HEAD) on \$(git rev-parse --abbrev-ref HEAD)"
EOF
else
  info "Test server already at ${LOCAL_HEAD:0:12}; rebuild only."
fi

info "Ensuring test SMS live send is disabled..."
ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<'EOF'
set -euo pipefail
ENV_FILE="/opt/city-communication-center/city-communication-center/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "  .env yok — atlanıyor."
  exit 0
fi
if grep -q '^CCC_SMS_LIVE_SEND_ENABLED=' "${ENV_FILE}"; then
  sed -i 's/^CCC_SMS_LIVE_SEND_ENABLED=.*/CCC_SMS_LIVE_SEND_ENABLED=false/' "${ENV_FILE}"
else
  printf '\n# Gerçek SMS gönderimi kapalı (testtim)\nCCC_SMS_LIVE_SEND_ENABLED=false\n' >> "${ENV_FILE}"
fi
echo "  CCC_SMS_LIVE_SEND_ENABLED=false"
EOF

info "Building and starting test containers..."
ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
CACHE_BUST="$(git rev-parse HEAD)"
echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml build --build-arg CACHE_BUST="\${CACHE_BUST}" frontend
echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
echo "  Waiting for health checks..."
sleep 10
echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:15000/health && echo
EOF

info "Test deployment complete → https://testtim.tire.bel.tr"
