#!/usr/bin/env bash
set -euo pipefail

# Prod NAS ayarlarını testtim'e kopyalar ve kök klasörü `testtim` yapar.
# Aynı SMB sunucusu: \\192.168.0.10\Tire Iletisim Merkezi\testtim

PROD_HOST="${PROD_HOST:-192.168.0.36}"
TEST_HOST="${TEST_HOST:-192.168.0.37}"
REMOTE_USER="${REMOTE_USER:-tim}"
REMOTE_SUDO_PASS="${REMOTE_SUDO_PASS:-Ts.102030}"
REMOTE_DIR="${REMOTE_DIR:-/opt/city-communication-center/city-communication-center}"
TENANT_ID="${TENANT_ID:-b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e}"
NAS_ROOT_FOLDER="${NAS_ROOT_FOLDER:-testtim}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

ssh_sudo() {
  local host="$1"
  shift
  ssh -o BatchMode=yes "${REMOTE_USER}@${host}" "echo '${REMOTE_SUDO_PASS}' | sudo -S bash -lc '$*'"
}

echo "[1/5] Prod FileStorageSettingsJson export..."
PROD_JSON="$(ssh_sudo "${PROD_HOST}" "${COMPOSE} exec -T postgres psql -U ccc -d city_communication_center -t -A -c \"SELECT filestoragesettingsjson FROM tenantsettings WHERE tenantid = '${TENANT_ID}';\"")"
PROD_JSON="$(echo "${PROD_JSON}" | tr -d '\r' | sed '/^$/d')"
if [[ -z "${PROD_JSON}" ]]; then
  echo "Prod tenantsettings.filestoragesettingsjson boş — önce yenitim'de NAS ayarlarını kaydedin." >&2
  exit 1
fi

echo "[2/5] Prod → test Data Protection keys kopyalanıyor..."
ssh_sudo "${PROD_HOST}" "${COMPOSE} exec -T api sh -c 'cd /var/lib/city-communication-center/dataprotection && tar czf - .'" \
  | ssh_sudo "${TEST_HOST}" "${COMPOSE} exec -T api sh -c 'mkdir -p /var/lib/city-communication-center/dataprotection && cd /var/lib/city-communication-center/dataprotection && tar xzf -'"

echo "[3/5] Test DB'ye prod FileStorageSettingsJson yazılıyor..."
ESCAPED_JSON="${PROD_JSON//\'/\'\'}"
ssh_sudo "${TEST_HOST}" "${COMPOSE} exec -T postgres psql -U ccc -d city_communication_center -c \"UPDATE tenantsettings SET filestoragesettingsjson = '${ESCAPED_JSON}', updatedatutc = NOW() WHERE tenantid = '${TENANT_ID}';\""

echo "[4/5] Test API yeniden başlatılıyor..."
ssh_sudo "${TEST_HOST}" "cd ${REMOTE_DIR} && ${COMPOSE} up -d api"
sleep 10

echo "[5/5] Kök klasör '${NAS_ROOT_FOLDER}' API ile ayarlanıyor..."
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
PAYLOAD=\$(python3 -c "
import json, os
settings = json.loads('''\${SETTINGS}''')
print(json.dumps({
  'nasHost': settings.get('nasHost'),
  'nasShareName': settings.get('nasShareName'),
  'nasRootFolder': os.environ.get('NAS_ROOT_FOLDER', '${NAS_ROOT_FOLDER}'),
  'nasProtocol': settings.get('nasProtocol') or 'SMB/CIFS',
  'nasUsername': settings.get('nasUsername'),
  'nasPassword': None,
  'clearNasPassword': False,
  'ftpHost': settings.get('ftpHost'),
  'ftpPort': settings.get('ftpPort') or 21,
  'ftpPath': settings.get('ftpPath'),
  'ftpProtocol': settings.get('ftpProtocol') or 'FTP',
  'ftpUsername': settings.get('ftpUsername'),
  'ftpPassword': None,
  'clearFtpPassword': False,
}))
")
curl -sS -X PUT -H "Authorization: Bearer \${TOKEN}" -H "X-Tenant-Id: ${TENANT_ID}" -H "Content-Type: application/json" \\
  -d "\${PAYLOAD}" \\
  "http://127.0.0.1:15000/api/v1/admin/tenants/${TENANT_ID}/file-storage-settings"
echo
curl -sS -H "Authorization: Bearer \${TOKEN}" -H "X-Tenant-Id: ${TENANT_ID}" \\
  "http://127.0.0.1:15000/api/v1/admin/tenants/${TENANT_ID}/file-storage-settings"
echo
EOF

echo "Tamam → testtim NAS kök klasör: ${NAS_ROOT_FOLDER}"
