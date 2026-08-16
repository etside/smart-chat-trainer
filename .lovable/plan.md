# Daddy AI Netlify GitHub Sync Implementation Plan

Ensure that the Netlify deployment via GitHub repo sync method works perfectly, syncing the complete existing project state (code, environment, and backend integration).

## Deployment Strategy
Use a **zero-config build** approach by providing a robust `netlify.toml` and a complete environment checklist. This ensures that once the repo is linked to Netlify, the only manual step is adding the environment variables from the checklist.

## Implementation Details

### 1. Build Configuration Enhancement
- Update `netlify.toml` to explicitly handle Node/Bun versions and server-side redirects for TanStack Start.
- Ensure the build command is strictly `bun run build`.
- Set the publish directory to `.output/public`.

### 2. Environment Variable Management
- Finalize `NETLIFY_CHECKLIST.md` with all current variables, including those added in recent turns (Meta, B2B, Sync).
- Ensure `.env.example` is complete and serves as a direct reference for Netlify's "Import from .env" feature (if available) or manual entry.

### 3. Netlify-Specific Redirects
- Implement the fallback redirect in `netlify.toml` to point to the Nitro server output, which is essential for TanStack Start SSR to work on Netlify.

### 4. Code & Data Synchronization
- The GitHub sync method automatically handles code.
- Database synchronization (Supabase) is already established via environment variables.

## Technical Details

### `netlify.toml`
```toml
[build]
  command = "bun run build"
  publish = ".output/public"

[build.environment]
  NODE_VERSION = "20"
  BUN_VERSION = "latest"

[[redirects]]
  from = "/*"
  to = "/.output/server/index.mjs"
  status = 200

[functions]
  node_version = "20"
  directory = ".output/server"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "microphone=(), camera=(), geolocation=()"
```

### Environment Variables Checklist (Updated)
1. **Supabase**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. **Daddy AI Sync**: `SYNC_TOKEN`, `SYNC_SECRET`.
3. **Training Webhooks**: `WEBHOOK_SECRET`, `CRON_SECRET`.
4. **Meta Integration**: `VITE_META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`.
5. **B2B Connectivity**: `B2B_BACKBLAZE_KEY`, `BOSON_WORKSPACE_ID`, `FISH_AUDIO_API_KEY`.
