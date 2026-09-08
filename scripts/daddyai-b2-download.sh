#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# DaddyAI — B2 Backup Downloader + Cleanup
# Usage:
#   ./daddyai-b2-download.sh                   # download latest, then delete from B2
#   ./daddyai-b2-download.sh --list            # list all backups in B2
#   ./daddyai-b2-download.sh --keep            # download latest but DON'T delete
#   ./daddyai-b2-download.sh --file <name>     # download specific file
#   ./daddyai-b2-download.sh --delete-all      # delete all backups from B2 (free space)
#
# Downloaded to: /var/KK-backups/daddyai/
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="/etc/daddyai-b2.env"
DOWNLOAD_DIR="/var/KK-backups/daddyai"
LOG="/var/log/daddyai-b2-backup.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$ENV_FILE" ] || die "Missing env file: $ENV_FILE"
# shellcheck source=/dev/null
source "$ENV_FILE"

: "${B2_APPLICATION_KEY_ID:?}" "${B2_APPLICATION_KEY:?}" "${B2_BUCKET_NAME:?}"

mkdir -p "$DOWNLOAD_DIR"

# Auth
b2 account authorize "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY" > /dev/null 2>&1

# ── Helpers ───────────────────────────────────────────────────────────────────
list_backups() {
  b2 ls --long --recursive "$B2_BUCKET_NAME" KK-backups/ 2>/dev/null \
    | sort -k6 \
    | awk '{printf "  %-55s %s MB\n", $NF, int($(NF-4)/1024/1024)}'
}

get_latest() {
  b2 ls --recursive "$B2_BUCKET_NAME" KK-backups/ 2>/dev/null \
    | sort | tail -1
}

download_file() {
  local remote_name=$1
  local local_path="$DOWNLOAD_DIR/$(basename "$remote_name")"

  log "Downloading: $remote_name"
  b2 file download "b2://$B2_BUCKET_NAME/$remote_name" "$local_path"

  # Decompress if .gz
  if [[ "$local_path" == *.gz ]]; then
    UNPACKED="${local_path%.gz}"
    gunzip -f "$local_path"
    local_path="$UNPACKED"
    log "Decompressed → $local_path"
  fi

  log "Saved to: $local_path ($(du -sh "$local_path" | cut -f1))"
  echo "$local_path"
}

delete_file() {
  local remote_name=$1
  log "Deleting from B2: $remote_name"
  b2 rm "b2://$B2_BUCKET_NAME/$remote_name" 2>&1 | tee -a "$LOG"
  log "Deleted ✓ — space freed"
}

# ── Command dispatch ──────────────────────────────────────────────────────────
MODE="${1:-}"

case "$MODE" in
  --list)
    echo ""
    echo "=== DaddyAI Backups in B2 (bucket: $B2_BUCKET_NAME) ==="
    list_backups
    echo ""
    # Show total size
    TOTAL=$(b2 ls --long --recursive "$B2_BUCKET_NAME" KK-backups/ 2>/dev/null \
      | awk '{sum += $(NF-4)} END {printf "%.1f", sum/1024/1024/1024}')
    echo "  Total: ~${TOTAL} GB"
    echo ""
    ;;

  --delete-all)
    echo ""
    read -rp "Delete ALL backups from B2? This frees space. [y/N]: " confirm
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }
    log "Deleting all backups from B2..."
    while IFS= read -r fname; do
      [[ -z "$fname" ]] && continue
      delete_file "$fname"
    done < <(b2 ls --recursive "$B2_BUCKET_NAME" KK-backups/ 2>/dev/null)
    log "All backups deleted."
    ;;

  --keep)
    LATEST=$(get_latest)
    [[ -z "$LATEST" ]] && die "No backups found in B2"
    log "=== Download (keep in B2) ==="
    download_file "$LATEST"
    ;;

  --file)
    FNAME="${2:-}"
    [[ -z "$FNAME" ]] && die "Usage: $0 --file <remote-filename>"
    # Add prefix if not provided
    [[ "$FNAME" != KK-backups/* ]] && FNAME="KK-backups/$FNAME"
    LOCAL=$(download_file "$FNAME")
    echo ""
    read -rp "Delete '$FNAME' from B2 after download? [y/N]: " confirm
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
      delete_file "$FNAME"
    fi
    ;;

  "")
    # Default: download latest then delete from B2
    log "=== DaddyAI B2 Restore: Download Latest + Free Space ==="
    LATEST=$(get_latest)
    [[ -z "$LATEST" ]] && die "No backups found in B2. Run backup script first."
    log "Latest: $LATEST"

    LOCAL=$(download_file "$LATEST")

    echo ""
    echo "Downloaded to: $LOCAL"
    echo ""
    echo "To restore into Supabase, open the Admin UI:"
    echo "  https://daddyai.online/admin/backup"
    echo "  → click 'Restore from file' → upload $LOCAL"
    echo ""

    # Ask before deleting
    read -rp "Delete '$LATEST' from B2 now to free space? [Y/n]: " confirm
    confirm="${confirm:-Y}"
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
      delete_file "$LATEST"
      echo ""
      echo "Space freed. Remaining backups:"
      list_backups || echo "  (none)"
    else
      log "File kept in B2."
    fi
    ;;

  *)
    echo "Usage:"
    echo "  $0                      # download latest + delete from B2"
    echo "  $0 --list               # list all backups in B2"
    echo "  $0 --keep               # download latest, keep in B2"
    echo "  $0 --file <name>        # download specific file"
    echo "  $0 --delete-all         # delete all backups from B2"
    exit 1
    ;;
esac
