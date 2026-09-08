# OpenClaw — Config Backup & Skills

This directory is the **source of truth backup** for the OpenClaw AI-agent gateway
that powers daddyai.online. It lives in git so the whole setup can be restored or
reproduced on any machine (local or VPS) in a few minutes.

## What's here

| Path | Purpose |
|---|---|
| `openclaw.config.json` | Full gateway config (`.openclaw/openclaw.json`). Secrets are templated as `${VAR}` — do **not** commit real keys. |
| `skills-manifest.md` | Planned skills/plugins from clawhub.ai + install state. |
| `../.github/workflows/health-check.yml` | Nightly health check of the live domains. |
| `../.github/workflows/cost-analysis.yml` | Nightly cost/usage analysis report. |

## Restore steps

1. Copy `openclaw.config.json` → `~/.openclaw/openclaw.json`.
2. Export the secret env vars (or replace the `${...}` placeholders inline):
   ```bash
   export OPENCLAW_BAI_API_KEY="sk-..."
   export OPENCLAW_GATEWAY_PASSWORD="..."
   ```
   > `openclaw.config.json` is templated with `${OPENCLAW_BAI_API_KEY}` etc. — either
   > set the env vars or substitute the values before starting the gateway.
3. Start the gateway (systemd on the VPS):
   ```bash
   systemctl daemon-reload && systemctl restart openclaw-gateway
   ```
   or locally: `nohup openclaw gateway --bind loopback --no-color &`
4. Verify: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/` → `200`.

## Maintenance automation

- `.github/workflows/health-check.yml` — runs nightly, checks
  `https://openclaw.daddyai.online/` and `https://daddyai.online/`, opens a GitHub
  issue if either is down.
- `.github/workflows/cost-analysis.yml` — runs nightly, writes a usage/cost report
  under `openclaw/reports/`.

## Secret handling

- The real config on the VPS lives at `/root/.openclaw/openclaw.json` (never pushed).
- `.env` is already in `.gitignore`.
- If you ever rotate a key, update it on the VPS **and** the GitHub repo secret.

## ClawHub skills / plugins

See `skills-manifest.md`. Installed skills live in `~/.openclaw/skills/` on the VPS
(after `openclaw skills add ...` / plugin install), not in this repo — this manifest
records the desired set so it can be re-installed anywhere.
