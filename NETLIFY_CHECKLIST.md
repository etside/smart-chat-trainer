# Netlify Environment Variables Checklist

To ensure your Daddy AI application functions correctly on Netlify, please configure the following environment variables in your Netlify Site Settings (**Site configuration > Environment variables**).

### 1. Supabase (Database & Auth)
These are required for database connectivity and authentication.
- `VITE_SUPABASE_URL`: Your Supabase Project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Anonymous API Key.
- `SUPABASE_SERVICE_ROLE_KEY`: **(Server-side only)** Required for admin operations and bypasses RLS in server functions.

### 2. Daddy AI Sync & Webhooks
Required for the automated training pipeline and catalog synchronization.
- `SYNC_TOKEN`: The Bearer token for authenticating with `api.v2.wearimpressive.com`.
- `SYNC_SECRET`: The shared secret for HMAC signature verification.
- `WEBHOOK_SECRET`: A secret key used to secure your incoming webhook endpoint.

### 3. Meta Business Integration
Required for WhatsApp, Facebook, and Instagram messaging features.
- `VITE_META_APP_ID`: Your Meta App ID.
- `META_APP_SECRET`: Your Meta App Secret.
- `META_WEBHOOK_VERIFY_TOKEN`: The token you define in Meta Developer portal for webhook verification.

### 4. B2B & External Services
Optional but recommended for full feature support.
- `B2B_BACKBLAZE_KEY`: Backblaze B2 Application Key.
- `BOSON_WORKSPACE_ID`: Your Boson Workspace identifier.
- `FISH_AUDIO_API_KEY`: API key for Fish Audio transcription/synthesis.

### 5. Deployment Info
- `NODE_VERSION`: `20` (or higher)
- `BUN_VERSION`: `1.1.0` (or higher)

---
*Note: After adding these variables, you may need to trigger a new deploy for changes to take effect.*
