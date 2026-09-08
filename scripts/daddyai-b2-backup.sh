#!/bin/bash
# DaddyAI — Weekend B2 Backup
# Cron: 0 2 * * 6,0  (Sat + Sun 2 AM UTC)
# Bucket: Kpakkaka | Cap: 10 GB | Prunes oldest on overflow
set -euo pipefail

LOG="/var/log/daddyai-b2-backup.log"
WORK="/tmp/daddyai-backup-$$"
ENV_FILE="/etc/daddyai-b2.env"

log() { echo "[$(date "+%Y-%m-%d %H:%M:%S")] $*" | tee -a "$LOG"; }
die() { log "ERROR: $*"; exit 1; }

source "$ENV_FILE"
: "${B2_APPLICATION_KEY_ID:?}" "${B2_APPLICATION_KEY:?}" "${B2_BUCKET_NAME:?}"
[[ "$B2_APPLICATION_KEY" == "PASTE_YOUR_APPLICATION_KEY_HERE" ]] && \
  die "Set B2_APPLICATION_KEY in $ENV_FILE"

B2_MAX_GB="${B2_MAX_GB:-10}"
B2_MAX_BYTES=$(( B2_MAX_GB * 1024 * 1024 * 1024 ))
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

TIMESTAMP="$(date "+%Y%m%d_%H%M%S")"
BUNDLE="$WORK/backup-${TIMESTAMP}.json"
COMPRESSED="$WORK/backup-${TIMESTAMP}.json.gz"
B2_DEST="KK-backups/daddyai-backup-${TIMESTAMP}.json.gz"

log "=== DaddyAI B2 Backup | bucket: $B2_BUCKET_NAME | cap: ${B2_MAX_GB}GB ==="

PG="sudo -u postgres psql -d daddyai --no-align --tuples-only"
log "Exporting from Postgres..."

$PG -c "SELECT COALESCE(json_agg(row_to_json(t))::text,'[]') FROM (SELECT question,answer,language,source FROM training_pairs WHERE status='approved' LIMIT 5000) t;" 2>/dev/null | head -1 > "$WORK/tp.json"
$PG -c "SELECT COALESCE(json_agg(row_to_json(t))::text,'[]') FROM (SELECT name,platform,language,template_text,variables,image_url,trigger_keywords FROM auto_reply_templates LIMIT 1000) t;" 2>/dev/null | head -1 > "$WORK/tm.json"
$PG -c "SELECT COALESCE(json_agg(row_to_json(t))::text,'[]') FROM (SELECT * FROM auto_reply_rules LIMIT 500) t;" 2>/dev/null | head -1 > "$WORK/ru.json"
$PG -c "SELECT COALESCE(row_to_json(t)::text,'{}') FROM (SELECT system_prompt,model,voice_provider,auto_reply_mode FROM agent_settings WHERE id=1) t;" 2>/dev/null | head -1 > "$WORK/as.json"
$PG -c "SELECT COUNT(*) FROM product_catalogue;" 2>/dev/null | tr -d ' ' > "$WORK/pc.txt"

python3 /var/www/daddyai/scripts/daddyai-b2-bundle.py "$BUNDLE" "$WORK"
log "Bundle: $(du -sh "$BUNDLE" | cut -f1)"

gzip -9 -c "$BUNDLE" > "$COMPRESSED"
log "Compressed: $(du -sh "$COMPRESSED" | cut -f1)"

log "Authorizing B2..."
b2 account authorize "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY" >> "$LOG" 2>&1 \
  || die "B2 auth failed — check B2_APPLICATION_KEY in $ENV_FILE"

log "Uploading → b2://$B2_BUCKET_NAME/$B2_DEST"
b2 file upload --quiet "$B2_BUCKET_NAME" "$COMPRESSED" "$B2_DEST" >> "$LOG" 2>&1 \
  || die "Upload failed"
log "Upload complete ✓"

log "Checking 10 GB cap..."
TOTAL_BYTES=0; declare -A FILE_SIZES
while IFS= read -r line; do
  fname=$(echo "$line" | awk '{print $NF}')
  fsize=$(echo "$line" | awk '{print $(NF-2)}' | tr -d ',')
  [[ "$fname" == KK-backups/* && "$fsize" =~ ^[0-9]+$ ]] || continue
  FILE_SIZES["$fname"]=$fsize
  TOTAL_BYTES=$(( TOTAL_BYTES + fsize ))
done < <(b2 ls --long --recursive "$B2_BUCKET_NAME" 2>/dev/null | grep "^backups/" || true)

log "Bucket: $(( TOTAL_BYTES / 1024 / 1024 )) MB / $(( B2_MAX_GB * 1024 )) MB"
if (( TOTAL_BYTES > B2_MAX_BYTES )); then
  log "Over cap — pruning oldest..."
  for fname in $(echo "${!FILE_SIZES[@]}" | tr " " "\n" | sort); do
    (( TOTAL_BYTES <= B2_MAX_BYTES )) && break
    log "  Deleting: $fname ($(( FILE_SIZES[$fname] / 1024 / 1024 )) MB)"
    b2 rm "b2://$B2_BUCKET_NAME/$fname" >> "$LOG" 2>&1 || true
    TOTAL_BYTES=$(( TOTAL_BYTES - FILE_SIZES[$fname] ))
  done
fi
log "=== Done: $B2_DEST | $(( TOTAL_BYTES / 1024 / 1024 )) MB in bucket ==="
