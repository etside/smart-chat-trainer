# Netlify Deployment Checklist & Environment Variables

To ensure your Daddy AI application functions correctly on Netlify with complete end-to-end sync, RBAC, and Meta integration, configure these variables in your Netlify Site Settings.

## Required Core Variables

| Variable | Description | Source |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL | Lovable Cloud |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anonymous API Key | Lovable Cloud |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for admin operations (bypasses RLS) | Lovable Cloud |
| `VITE_PUBLIC_APP_URL` | Your production URL (e.g., `https://daddyai.lovable.app`) | Netlify |

## API Sync & Webhooks (End-to-End)

These are required for the automated training pipeline and catalog synchronization.

| Variable | Description | Source |
| :--- | :--- | :--- |
| `SYNC_TOKEN` | Bearer token for authenticating with `api.v2.wearimpressive.com` | Partner API |
| `SYNC_SECRET` | Shared secret for HMAC signature verification | Partner API |
| `WEBHOOK_SECRET` | Secret key used to secure your incoming webhook endpoint | Custom String |
| `CRON_SECRET` | Secret for scheduled sync jobs (pass as Bearer token) | Custom String |

## Meta Business Integration

Required for WhatsApp, Facebook, and Instagram messaging features.

| Variable | Description | Source |
| :--- | :--- | :--- |
| `VITE_META_APP_ID` | Your Meta App ID | Meta Developers |
| `META_APP_SECRET` | Your Meta App Secret | Meta Developers |
| `META_WEBHOOK_VERIFY_TOKEN` | Token for Meta webhook verification | Custom String |

## B2B & External Services

| Variable | Description |
| :--- | :--- |
| `B2B_BACKBLAZE_KEY` | Backblaze B2 Application Key |
| `BOSON_WORKSPACE_ID` | Your Boson Workspace identifier |
| `FISH_AUDIO_API_KEY` | API key for Fish Audio transcription/synthesis |

## Deployment Configuration

- `NODE_VERSION`: `20`
- `BUN_VERSION`: `latest`

---
**Note:** After adding these variables, trigger a new deploy. The `netlify.toml` in the root already handles the build and redirect logic.
