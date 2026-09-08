#!/usr/bin/env bash
# Apply memory-tightness guards for the 1GB VPS after PM2 resurrects apps.
# - Lowers the app's oom_score_adj so the kernel prefers killing OTHER
#   processes (like the gateway) before this app under memory pressure.
# - Lowers swappiness so the kernel prefers keeping the app's working set
#   in RAM rather than thrashing to swap.
#
# Idempotent and safe to run any number of times.
set -euo pipefail

APP_PID=$(pm2 pid daddyai 2>/dev/null || true)
if [ -n "$APP_PID" ] && [ -f "/proc/$APP_PID/oom_score_adj" ]; then
  echo -500 > "/proc/$APP_PID/oom_score_adj"
  echo "memory-guard: set oom_score_adj=-500 for daddyai (pid $APP_PID)"
fi

# Prefer RAM for the app working set; swap only as a last resort.
echo 10 > /proc/sys/vm/swappiness
echo "memory-guard: set vm.swappiness=10"
