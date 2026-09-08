# DaddyAI — Launch Plan

> Edit this file, then tell me "work on the plan" and I will execute your updated version.

---

## Project State (as of 2026-08-29)

| Item | Status |
|------|--------|
| Sessions in DB | 1,031+ |
| Session messages | 10,910 |
| Training pairs | 34,777 |
| Products synced | 317 (Wear Impressive) |
| AI drafts generating | ✅ Working |
| Auto-training enabled | ✅ `auto_train_enabled = true` |
| Webhook receiving messages | ✅ Working |
| Admin inbox UI | ⚠️ Built but blocked by framer-motion crash |
| Admin training page | ⚠️ Exists — needs confidence score + CSV export |
| Admin analytics page | ⚠️ Exists — needs Recharts charts wired up |
| Admin voice page | ❌ Does not exist |
| Vision AI (GPT-4o) | ❌ Not integrated |
| Voice cloning (Fish Audio) | ❌ Not integrated (API key column exists in DB) |
| Page Access Token | ❌ Column exists, value not set |
| Auto-reply mode | `off` — drafts stored, waiting for human approval |

---

## Goal

Fully automated AI sales agent on Facebook, Instagram, WhatsApp.
- Responds like a human agent
- Recommends products from the 317-item catalogue
- Processes and converts sales chats
- Learns from every approved interaction
- Full admin panel: inbox, training, voice, analytics, settings

---

## Steps

### Step 1 — Fix framer-motion crash *(BLOCKER)*
**What:** `admin.progress.tsx` has one `motion.div` (line 173) and an `AnimatePresence` wrapper left over from a partial fix. This crashes the entire SSR server on Node.js ESM import.

**Fix:** Replace `motion.div` → `div`, remove `AnimatePresence` wrapper, delete the framer-motion import line.

**Files:**
- `src/routes/admin.progress.tsx`
- `src/components/SupportModal.tsx` (already fixed — verify)

**Done when:** `curl https://daddyai.online/admin/inbox` returns 200 with page content, no error in PM2 logs.

---

### Step 2 — Verify and polish Messenger-style inbox
**What:** The new inbox UI (`admin.inbox.tsx`) was written last session. After Step 1 unblocks the build, verify it works end-to-end.

**Check:**
- Conversation list loads with avatars, last message, timestamps
- Clicking a conversation shows the message thread
- User messages on left (grey), AI replies on right (blue)
- Draft AI replies shown in amber with a **Send** button
- Clicking Send calls `sendDraftReply` → marks sent → turns blue
- Auto-refreshes every 10s (session list) / 5s (open thread)
- Filters: All / Active / Resolved / Escalated / Archived
- Channel filter: Messenger / WhatsApp / Instagram
- Agent assignment works
- Mobile: shows list OR thread, not both at once

**Files:**
- `src/routes/admin.inbox.tsx`
- `src/lib/inbox.functions.ts`

---

### Step 3 — Augment admin training page
**What:** `/admin/training` exists but is basic. Add:

- Confidence score column (from `training_pairs` table — check actual column name)
- Conversion badge — mark pairs that led to a sale/order
- CSV export button (download all filtered pairs as CSV)
- Pagination improvement — show total count (34,777+)
- Better search — search both prompt and completion text

**Files:**
- `src/routes/admin.training.tsx`
- `src/lib/console.functions.ts` (add `exportTrainingPairs` server fn)

---

### Step 4 — Build /admin/voice page
**What:** New page. Does not exist yet.

**Displays:**
- Session messages where content is an audio/voice message URL
- Audio player (HTML5 `<audio>` tag)
- Transcript (if available in metadata)
- Fish Audio quality score (if available)
- Download button
- Filter by channel, date, session

**Notes:**
- Fish Audio API key column exists: `agent_settings.fish_audio_api_key`
- Check `session_messages.metadata` for audio URL format

**Files to create:**
- `src/routes/admin.voice.tsx`
- Add voice message query to `src/lib/inbox.functions.ts`

---

### Step 5 — Integrate Vision AI (GPT-4o)
**What:** When a customer sends an image via Messenger/WhatsApp, the AI should:
1. Download the image from Meta CDN
2. Send to GPT-4o Vision with system prompt + product catalogue context
3. Return: product match, color/style analysis, recommendation
4. Display product card(s) in the chat reply

**Requirements:**
- OpenAI API key must be set (add to `agent_settings` or env)
- Webhook handler detects `attachments[].type === "image"`
- Falls back to text-only AI if no vision key configured

**Files:**
- `src/routes/api.public.webhooks.meta.tsx`
- `src/lib/ai.server.ts` (add `chatCompleteWithVision`)
- `src/routes/admin.inbox.tsx` (render image bubbles in thread)

---

### Step 6 — Integrate Voice Cloning (Fish Audio)
**What:** Generate audio replies using Fish Audio TTS.

**Flow:**
1. AI generates text reply
2. Text sent to Fish Audio API → returns `.mp3` URL
3. Audio stored / linked in `session_messages.metadata`
4. Sent to customer via Meta audio message API
5. Shown in admin inbox with play button

**Requirements:**
- `agent_settings.fish_audio_api_key` must be set
- Fish Audio reference voice ID configured (voice clone)

**Files:**
- `src/lib/voice.server.ts` (new — Fish Audio client)
- `src/lib/agent.server.ts` (call voice after text reply)
- `src/routes/admin.voice.tsx` (display in Step 4)

---

### Step 7 — Wire up analytics charts
**What:** `/admin/analytics` exists but likely has placeholder charts. Wire up real data with Recharts.

**Metrics to show:**
- Daily conversation volume (bar chart, last 30 days)
- Approval rate trend (line chart — % of drafts sent)
- Confidence score trend (line chart)
- Channel distribution (pie chart)
- Top 10 products mentioned
- Average response time
- Sentiment breakdown (positive / neutral / negative)
- Voice message volume (once Step 6 is done)

**Data sources:** `analytics_events`, `sentiment_logs`, `performance_metrics`, `session_messages`, `training_pairs`

**Files:**
- `src/routes/admin.analytics.tsx`
- `src/lib/inbox.functions.ts` (add/improve analytics server fns)

---

### Step 8 — Configure Page Access Token
**What:** Without a valid `meta_access_token`, the bot cannot send messages. Column exists but value may be empty.

**Steps:**
1. Add settings UI in `/admin/settings` to input and save: App ID, App Secret, Page Access Token, Page ID, Webhook Verify Token
2. Add "Test Connection" button that sends a test message to a known PSID
3. Store all values in `agent_settings` table
4. Verify `sendMetaMessage()` in `meta-sender.server.ts` uses the stored token

**Files:**
- `src/routes/admin.settings.tsx` (add Meta section if missing)
- `src/lib/meta-sender.server.ts` (verify token source)

---

### Step 9 — Self-training pipeline
**What:** Every approved reply should automatically become a training pair so the AI improves over time.

**Flow:**
1. Human approves a draft (clicks Send in inbox)
2. `sendDraftReply` captures: user message + approved AI reply
3. Inserts as new `training_pair` with `status = approved`
4. Nightly cron triggers `auto_train` if new pairs > threshold
5. `training_confidence_score` updated after each run

**Verify:**
- `auto_train_enabled = true` in DB ✅
- Cron job actually running (check `auto_training_runs` table)
- `sendDraftReply` needs to capture the user turn for context

**Files:**
- `src/lib/inbox.functions.ts` (`sendDraftReply` — add training capture)
- Check cron job file (likely `src/routes/api.cron.*.tsx`)

---

### Step 10 — Launch readiness check
**What:** Automated audit of all systems. Outputs a report.

**Checks:**
- [ ] Inbox loads and shows conversations
- [ ] Draft AI replies appearing
- [ ] Send draft → marks sent → sent via Meta API
- [ ] Vision AI responding to image messages
- [ ] Voice cloning generating audio replies
- [ ] Analytics charts loading with real data
- [ ] Page Access Token set and valid
- [ ] Auto-training cron running
- [ ] Webhook receiving live messages
- [ ] No errors in PM2 logs for 1 hour

**Output:** Score out of 10, table of ✅ / ❌ / ⚠️ per system.

---

## Technical Reference

| Item | Value |
|------|-------|
| Server | DigitalOcean `143.198.29.180` |
| App path | `/var/www/daddyai` |
| Build command | `cd /var/www/daddyai && PATH="$PATH:./node_modules/.bin" npm run build` |
| Restart command | `pm2 kill && pm2 start ecosystem.config.cjs && pm2 save` |
| DB | `PGPASSWORD=daddyai2026 psql -h localhost -U daddyai -d daddyai` |
| Git remote | `https://github.com/etside/daddyai.git` (branch: main) |
| Local source | `/root/termux-helpers/openclaude/daddyai/src/` |
| Stack | TanStack Start, TanStack Query, Tailwind v4, shadcn/ui, PostgreSQL |

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/admin.inbox.tsx` | Messenger-style inbox UI |
| `src/routes/admin.training.tsx` | Training pairs management |
| `src/routes/admin.analytics.tsx` | Analytics dashboard |
| `src/routes/admin.progress.tsx` | Training job progress (has framer-motion bug) |
| `src/routes/api.public.webhooks.meta.tsx` | Meta webhook handler |
| `src/lib/inbox.functions.ts` | Server fns: list sessions, messages, send draft |
| `src/lib/agent.server.ts` | AI reply generation + draft logging |
| `src/lib/ai.server.ts` | AI API client (MIMO / OpenAI) |
| `src/lib/meta-sender.server.ts` | Send messages via Meta API |
| `src/components/SupportModal.tsx` | Public support chat widget |
