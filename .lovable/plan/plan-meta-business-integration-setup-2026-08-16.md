# Plan: Meta Business Integration Setup

Add a "one-click" Meta Business page connection for WhatsApp, Facebook Business, and Instagram messaging integration in the Daddy AI settings.

## Technical Details

### Database Changes
- Add columns to `public.agent_settings` table to store Meta credentials:
  - `meta_app_id` (text)
  - `meta_app_secret` (text)
  - `meta_access_token` (text)
  - `meta_page_id` (text)
  - `meta_whatsapp_business_account_id` (text)
  - `meta_webhook_verify_token` (text)

### Backend Updates
- Update `src/lib/settings.functions.ts`:
  - `getMetaCredentials`: Fetch existing Meta credentials (masked).
  - `updateMetaCredentials`: Securely save Meta credentials.
- Add `src/lib/meta.functions.ts` for Meta-specific API calls:
  - `verifyMetaConnection`: Test the connection using the provided credentials.
  - `setupMetaWebhooks`: Automate webhook subscription setup if possible via Meta Graph API.

### UI Enhancements
- Update `src/routes/admin.settings.tsx`:
  - Add a new "Meta বিজনেস কানেকশন" (Meta Business Connection) section in the settings page.
  - Include fields for App ID, App Secret, Page ID, and System User Access Token.
  - Add a "কানেকশন ভেরিফাই করুন" (Verify Connection) button to test credentials live.
  - Add a "গাইড দেখুন" (View Guide) link pointing to Meta Developers documentation for each step.
  - Use glassmorphism and bento-grid elements to match the existing Daddy AI design language.

### API & Security
- Implement signature verification for incoming Meta webhooks (Conversation API).
- Ensure all Meta credentials are encrypted at rest or at least stored in RLS-protected tables.
- Use `supabaseAdmin` for privileged writes to `agent_settings`.

## User Interface
- A dedicated card in the settings sidebar/grid for Meta.
- Clear step-by-step instructions for obtaining the required tokens from developers.facebook.com.
- Status indicators (Connected/Disconnected) for each Meta platform (FB, IG, WA).
