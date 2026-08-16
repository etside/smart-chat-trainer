# Plan: Scheduled Sync, Training Timeline & Webhook Security

Implement cron-style sync scheduling, enhanced training history management with re-run capabilities, and robust webhook security with idempotency and signature verification.

## Proposed Changes

### 1. Database Schema (Supabase)
- **`agent_settings` Update**: Add `sync_schedule` (cron string or frequency enum) and `last_sync_at`.
- **`sync_runs` Update**: Add `idempotency_key` (unique) to prevent duplicate runs and `metadata` (JSONB) for signed request verification details.
- **`training_jobs` Enhancement**: Ensure we can link jobs back to specific sync runs or batches.

### 2. Scheduled Sync & Admin UI
- **Sync Settings**: Add UI in `/admin/sync` to set sync frequency (e.g., Hourly, Daily, Weekly, or Custom cron).
- **Public Cron Endpoint**: Create `/api/public/cron/sync` that triggers `syncCatalog`. This will be called by an external scheduler (or Lovable Cloud's native cron if available).
- **Security**: The cron endpoint will require a special `CRON_SECRET` header.

### 3. Training Run Timeline & Re-runs
- **Enhanced Timeline**: Update `/admin/progress` to show a detailed timeline of training jobs (Queued -> Processing -> Succeeded/Failed).
- **Re-run Support**: Add a "Re-run" button to the training job list that triggers a new job using the same source data/version.
- **Batch Tracking**: Link training jobs to their source (e.g., "API Sync #123").

### 4. Webhook Security & Idempotency
- **Signature Verification**: Implement `verifySignature` in `src/lib/admin.server.ts` using `crypto.timingSafeEqual` to validate `X-Webhook-Signature` based on the shared `SYNC_SECRET`.
- **Idempotency**: Use `X-Idempotency-Key` from incoming webhooks to check against `sync_runs` before processing. If it exists, return the cached result.
- **Secure Webhook Handler**: Apply these checks to `/api/public/webhook`.

### 5. Backend Logic Refinement
- **`syncCatalog` Refactor**: Support optional `idempotencyKey` and `signature` verification.
- **Retry Logic**: Improve `fetchWithRetry` to handle specific signature/auth errors gracefully.

## Technical Details

- **Cron**: We will expose a public endpoint for `pg_cron` or external triggers.
- **Signature**: `HMAC-SHA256(payload, SYNC_SECRET)`.
- **Idempotency**: PostgreSQL `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` or explicit check.

## User Review Required

> [!IMPORTANT]
> The user requested signature verification with "Token and Secret". I will use the `SYNC_SECRET` for HMAC signature and `SYNC_TOKEN` as an alternative header or part of the signed payload as requested.
