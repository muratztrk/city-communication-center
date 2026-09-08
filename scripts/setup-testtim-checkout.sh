#!/usr/bin/env bash
set -euo pipefail

# testtim (192.168.0.37) üzerinde git checkout kurar veya onarır.
# GitHub pull kullanmaz — yerel develop bundle ile clone/ff yapar (deploy-test ile aynı model).
#
# Kullanım (VPN açık, develop güncel):
#   git checkout develop && git pull origin develop
#   ./scripts/setup-testtim-checkout.sh

REMOTE_USER="${REMOTE_USER:-tim}"
REMOTE_HOST="${REMOTE_HOST:-192.168.0.37}"
REMOTE_DIR="${REMOTE_DIR:-/opt/city-communication-center/city-communication-center}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"
REPO_URL="${REPO_URL:-https://github.com/muratztrk/city-communication-center.git}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "${DEPLOY_BRANCH}" ]]; then
  echo "Bu script yalnızca '${DEPLOY_BRANCH}' branch'inden çalıştırılmalı." >&2
  exit 1
fi

LOCAL_HEAD="$(git rev-parse HEAD)"
echo "[setup-testtim] branch=${DEPLOY_BRANCH} HEAD ${LOCAL_HEAD:0:12}"

REMOTE_HEAD="$(ssh -o BatchMode=yes -o ConnectTimeout=30 "${REMOTE_USER}@${REMOTE_HOST}" \
  "git -C '${REMOTE_DIR}' rev-parse HEAD 2>/dev/null" || true)"

BUNDLE="$(mktemp -t ccc-setup-testtim.XXXXXX.bundle)"
cleanup() { rm -f "${BUNDLE}"; }
trap cleanup EXIT

REMOTE_BUNDLE="/tmp/ccc-setup-testtim.bundle"
REMOTE_PARENT="$(dirname "${REMOTE_DIR}")"

if [[ -z "${REMOTE_HEAD}" ]]; then
  echo "[setup-testtim] Checkout yok — bundle ile clone..."
  git bundle create "${BUNDLE}" "${DEPLOY_BRANCH}"
  scp -o BatchMode=yes -o ConnectTimeout=30 "${BUNDLE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_BUNDLE}"
  ssh -o BatchMode=yes -o ConnectTimeout=30 "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
mkdir -p "${REMOTE_PARENT}"
if [[ -d "${REMOTE_DIR}" && ! -d "${REMOTE_DIR}/.git" ]]; then
  echo "  ${REMOTE_DIR} var ama .git yok — yedek alınıp temizleniyor."
  mv "${REMOTE_DIR}" "${REMOTE_DIR}.bak-\$(date +%Y%m%d%H%M%S)"
fi
rm -rf "${REMOTE_DIR}"
git clone "${REMOTE_BUNDLE}" "${REMOTE_DIR}"
cd "${REMOTE_DIR}"
git checkout "${DEPLOY_BRANCH}"
git remote set-url origin "${REPO_URL}"
rm -f "${REMOTE_BUNDLE}"
echo "  Clone OK: \$(git rev-parse --short HEAD) on \$(git rev-parse --abbrev-ref HEAD)"
EOF
else
  echo "[setup-testtim] Mevcut HEAD ${REMOTE_HEAD:0:12} — ff sync..."
  if [[ "${REMOTE_HEAD}" == "${LOCAL_HEAD}" ]]; then
    echo "[setup-testtim] Zaten güncel."
  else
    git bundle create "${BUNDLE}" "${REMOTE_HEAD}..HEAD"
    scp -o BatchMode=yes -o ConnectTimeout=30 "${BUNDLE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_BUNDLE}"
    ssh -o BatchMode=yes -o ConnectTimeout=30 "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
git fetch "${REMOTE_BUNDLE}" HEAD
git merge --ff-only FETCH_HEAD
git checkout "${DEPLOY_BRANCH}" 2>/dev/null || git checkout -B "${DEPLOY_BRANCH}"
git remote set-url origin "${REPO_URL}"
rm -f "${REMOTE_BUNDLE}"
echo "  Sync OK: \$(git rev-parse --short HEAD) on \$(git rev-parse --abbrev-ref HEAD)"
EOF
  fi
fi

echo "[setup-testtim] Tamam → ${REMOTE_DIR}"
