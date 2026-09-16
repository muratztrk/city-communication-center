#!/usr/bin/env bash
# Prod mesai dışı SMS denetimi — yenitim (192.168.0.36)
# Kullanım: ./scripts/check-prod-afterhours-sms.sh [gün_sayısı]
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-tim}"
REMOTE_HOST="${REMOTE_HOST:-192.168.0.36}"
REMOTE_DIR="${REMOTE_DIR:-/opt/city-communication-center/city-communication-center}"
DAYS="${1:-30}"

echo "Bağlanılıyor: ${REMOTE_USER}@${REMOTE_HOST} (son ${DAYS} gün)"

ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres psql -U ccc -d city_communication_center" <<EOSQL
WITH logs AS (
  SELECT
    l.smsoutboundlogid,
    l.kind,
    l.success,
    l.requestnumber,
    l.bodypreview,
    l.createdatutc,
    (l.createdatutc AT TIME ZONE 'Europe/Istanbul') AS local_ts,
    EXTRACT(DOW FROM (l.createdatutc AT TIME ZONE 'Europe/Istanbul'))::int AS dow,
    (l.createdatutc AT TIME ZONE 'Europe/Istanbul')::time AS local_time,
    CASE l.kind
      WHEN 1 THEN 'CitizenStatus'
      WHEN 2 THEN 'AfterHoursManager'
      WHEN 3 THEN 'AfterHoursStaff'
      WHEN 4 THEN 'Test'
      ELSE 'Unknown'
    END AS kind_label
  FROM smsoutboundlogs l
  WHERE l.createdatutc >= NOW() - INTERVAL '${DAYS} days'
),
classified AS (
  SELECT
    *,
    CASE
      WHEN dow IN (0, 6) THEN true
      WHEN local_time < TIME '08:30' OR local_time >= TIME '17:30' THEN true
      ELSE false
    END AS is_after_hours
  FROM logs
)
\echo '=== Son ${DAYS} gün özet (tür) ==='
SELECT kind_label, success, COUNT(*) AS cnt
FROM classified
GROUP BY kind_label, success
ORDER BY kind_label, success;

\echo '=== Mesai DIŞI SMS (AfterHours*) toplam ==='
SELECT COUNT(*) AS after_hours_sms_total,
       COUNT(*) FILTER (WHERE success) AS success_cnt,
       COUNT(*) FILTER (WHERE NOT success) AS fail_cnt
FROM classified
WHERE kind IN (2, 3);

\echo '=== İHLAL: AfterHours SMS mesai İÇİ gönderilmiş mi? (0 olmalı) ==='
SELECT COUNT(*) AS violation_count
FROM classified
WHERE kind IN (2, 3) AND NOT is_after_hours;

\echo '=== Son 20 mesai dışı AfterHours SMS ==='
SELECT local_ts, kind_label, success, requestnumber, LEFT(bodypreview, 60) AS preview
FROM classified
WHERE kind IN (2, 3)
ORDER BY createdatutc DESC
LIMIT 20;

\echo '=== Son 7 gün: mesai dışı saatte AfterHours SMS (saatlik) ==='
SELECT date_trunc('hour', local_ts) AS hour_bucket, kind_label, COUNT(*) AS cnt
FROM classified
WHERE kind IN (2, 3) AND is_after_hours
  AND createdatutc >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC
LIMIT 50;
EOSQL
