#!/usr/bin/env bash
set -euo pipefail

PROD_HOST="${PROD_HOST:-192.168.0.36}"
TEST_HOST="${TEST_HOST:-192.168.0.37}"
REMOTE_USER="${REMOTE_USER:-tim}"
REMOTE_SUDO_PASS="${REMOTE_SUDO_PASS:-Ts.102030}"
REMOTE_DIR="${REMOTE_DIR:-/opt/city-communication-center/city-communication-center}"
TENANT_ID="${TENANT_ID:-b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e}"
NAS_ROOT_FOLDER="${NAS_ROOT_FOLDER:-testtim}"

compose_exec() {
  local host="$1"
  shift
  ssh -o BatchMode=yes "${REMOTE_USER}@${host}" \
    "echo '${REMOTE_SUDO_PASS}' | sudo -S bash -lc 'cd \"${REMOTE_DIR}\" && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T $*'"
}

echo "[1/4] Prod FileStorageSettingsJson export..."
PROD_JSON="$(compose_exec "${PROD_HOST}" postgres \
  psql -U ccc -d city_communication_center -t -A \
  -c "SELECT filestoragesettingsjson FROM tenantsettings WHERE tenantid = '${TENANT_ID}';" \
  | tr -d '\r' | sed '/^$/d' | head -1)"
if [[ -z "${PROD_JSON}" ]]; then
  echo "Prod tenantsettings.filestoragesettingsjson boş." >&2
  exit 1
fi
echo "  JSON uzunluğu: ${#PROD_JSON}"

echo "[2/4] Test DB güncelleniyor..."
# Prod ve test aynı Data Protection key volume'unu paylaşıyor; şifreli NAS parolası doğrudan çözülür.
ssh -o BatchMode=yes "${REMOTE_USER}@${TEST_HOST}" bash -s <<EOF
set -euo pipefail
JSON='${PROD_JSON//\'/\'\'\'}'
echo '${REMOTE_SUDO_PASS}' | sudo -S bash -lc "cd \"${REMOTE_DIR}\" && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres psql -U ccc -d city_communication_center -c \"UPDATE tenantsettings SET filestoragesettingsjson = '\${JSON}', updatedatutc = NOW() WHERE tenantid = '${TENANT_ID}';\""
EOF

echo "[3/4] Test API restart..."
ssh -o BatchMode=yes "${REMOTE_USER}@${TEST_HOST}" bash -s <<EOF
set -euo pipefail
echo '${REMOTE_SUDO_PASS}' | sudo -S bash -lc 'cd "${REMOTE_DIR}" && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api'
EOF
sleep 10

echo "[4/4] Kök klasör ayarlanıyor: ${NAS_ROOT_FOLDER}"
ssh -o BatchMode=yes "${REMOTE_USER}@${TEST_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
PW=\$(grep ^CCC_INITIAL_PASSWORD= .env | cut -d= -f2- | tr -d '"')
TOKEN=\$(curl -sS -X POST http://127.0.0.1:15000/connect/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "X-Forwarded-Proto: https" \\
  -d "grant_type=password&username=admin&password=\${PW}&tenant_id=${TENANT_ID}" \\
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
SETTINGS=\$(curl -sS -H "Authorization: Bearer \${TOKEN}" -H "X-Tenant-Id: ${TENANT_ID}" \\
  "http://127.0.0.1:15000/api/v1/admin/tenants/${TENANT_ID}/file-storage-settings")
PAYLOAD=\$(python3 <<PY
import json
settings = json.loads('''\${SETTINGS}''')
print(json.dumps({
  "nasHost": settings.get("nasHost"),
  "nasShareName": settings.get("nasShareName"),
  "nasRootFolder": "${NAS_ROOT_FOLDER}",
  "nasProtocol": settings.get("nasProtocol") or "SMB/CIFS",
  "nasUsername": settings.get("nasUsername"),
  "nasPassword": None,
  "clearNasPassword": False,
  "ftpHost": settings.get("ftpHost"),
  "ftpPort": settings.get("ftpPort") or 21,
  "ftpPath": settings.get("ftpPath"),
  "ftpProtocol": settings.get("ftpProtocol") or "FTP",
  "ftpUsername": settings.get("ftpUsername"),
  "ftpPassword": None,
  "clearFtpPassword": False,
}))
PY
)
curl -sS -X PUT -H "Authorization: Bearer \${TOKEN}" -H "X-Tenant-Id: ${TENANT_ID}" -H "Content-Type: application/json" \\
  -d "\${PAYLOAD}" \\
  "http://127.0.0.1:15000/api/v1/admin/tenants/${TENANT_ID}/file-storage-settings" >/dev/null
curl -sS -H "Authorization: Bearer \${TOKEN}" -H "X-Tenant-Id: ${TENANT_ID}" \\
  "http://127.0.0.1:15000/api/v1/admin/tenants/${TENANT_ID}/file-storage-settings"
echo
EOF

echo "Tamam. UNC: \\\\192.168.0.10\\Tire Iletisim Merkezi\\${NAS_ROOT_FOLDER}"
