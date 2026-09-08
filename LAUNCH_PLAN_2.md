Steps

Step 1 – Verify & strengthen incoming webhook

What: Ensure the webhook (/api/public/webhooks/meta) correctly receives text, image, and audio messages. No new logic yet – just confirm it parses and stores raw payloads in session_messages.metadata.

Files:

· src/routes/api.public.webhooks.meta.tsx
· src/lib/message-utils.ts (ensure extractMessageContent handles all attachment types)

Done when: A test message with each type appears correctly in the database.

---

Step 2 – Integrate Vision AI (GPT‑4o)

What: When an image arrives, download from Meta CDN, send to GPT‑4o Vision with system prompt + product catalogue. Return: colour, pattern, fabric, style, fit, and product matches.

Files:

· src/lib/ai.server.ts – add analyzeImageWithVision(imageUrl, systemPrompt)
· src/lib/catalogue.server.ts – function to match attributes to products
· src/routes/api.public.webhooks.meta.tsx – call vision when attachments[].type === "image"

Done when: An image message produces a JSON object with product suggestions, logged in session_messages.metadata.

---

Step 3 – Build Smart Filter & Priority Queue

What: Before spending on AI or human time, classify the conversation:

· No image → skip vision cost
· VIP / high‑value customer (based on past orders or manual label) → push to priority queue
· Else → normal flow

Create a priority_score field in sessions and a queue table for escalated conversations.

Files:

· src/lib/priority.server.ts – calculate priority from session history and labels
· src/routes/api.public.webhooks.meta.tsx – call calculatePriority and set flag
· Database migration to add priority_score to sessions and escalated_at etc.

Done when: High‑priority messages appear with a badge in the inbox, and auto‑reply is suppressed for them.

---

Step 4 – Enhance Human Agent Inbox

What: Extend existing inbox UI to support the new flow:

· Show priority badge (High / VIP)
· Add Resolve and Escalate buttons
· Allow agent assignment with filters by priority
· Display image attachments inline

Files:

· src/routes/admin.inbox.tsx – add badge, resolve/escalate buttons
· src/lib/inbox.functions.ts – add resolveSession, escalateSession

Done when: Agent can see priority, resolve, and reassign sessions.

---

Step 5 – Build Capture & Label UI

What: Extend the training page (/admin/training) to allow admins to label each conversation turn:

· LEAD, SOLD, Support, Spam
· Auto‑compute satisfaction and response time scores

Add a new column label to training_pairs and a form to update it.

Files:

· src/routes/admin.training.tsx – add label dropdown per row
· src/lib/training.functions.ts – add updateTrainingPairLabel(id, label, scores)

Done when: Admin can label any interaction and see aggregate counts per label.

---

Step 6 – Implement Training Pipeline (Extract from LEAD/SOLD)

What: A cron job that:

· Queries training_pairs where label IN ('LEAD','SOLD') and status = 'approved'
· Uses AI to extract patterns: objection handling, closing phrases, product‑specific scripts
· Creates new canned response templates automatically

Files:

· src/routes/api.cron.training-pipeline.tsx – new endpoint
· src/lib/pattern-extractor.server.ts – summarise successful conversations

Done when: New canned responses appear in the database after each nightly run.

---

Step 7 – Build Canned Responses Admin Panel

What: New page /admin/canned-responses to manage pre‑defined replies with variables:

· Variables: {{customer_name}}, {{product_name}}, {{price}}, {{delivery_time}}
· Categories: shipping, payment, sizing, returns, etc.
· Multi‑language support (if needed)
· Usage statistics (how many times each is used)

Files:

· src/routes/admin.canned-responses.tsx (new)
· src/lib/canned.server.ts – CRUD and usage logging

Done when: Admin can create, edit, delete, and view usage stats for canned responses.

---

Step 8 – Build Auto‑Reply Engine with Triggers & A/B Testing

What: Admin page /admin/auto-replies to define rules:

· Triggers: keywords, sentiment, product mention, priority level
· Actions: send a specific canned response or dynamic AI reply
· A/B testing: split test two variants and track conversion rate

Create a rule‑evaluation engine that runs on each incoming message.

Files:

· src/routes/admin.auto-replies.tsx (new)
· src/lib/auto-reply.engine.ts – evaluate triggers and return matching rules
· src/lib/ab-test.server.ts – assign variant, log results

Done when: Auto‑replies fire correctly, and A/B test results are visible in analytics.

---

Step 9 – Continuous Learning Loop

What: After every conversation, log:

· Which replies were sent (AI, canned, or manual)
· Which ones led to a SOLD / LEAD
· Update template success rates and promote high‑performing ones automatically

Nightly job adjusts the selection weights in the auto‑reply engine.

Files:

· src/lib/analytics.server.ts – add logReplyPerformance
· src/routes/api.cron.learn.tsx – update template scores

Done when: High‑performing replies are prioritised in auto‑reply selection, visible in analytics.

---

Step 10 – Launch Readiness Check

What: Automated audit of all systems. Outputs a report with score out of 10.

Checks:

☐ Webhook receives messages
☐ Vision AI responds to images
☐ Priority queue works
☐ Inbox shows priority and resolve buttons
☐ Training labels work
☐ Training pipeline runs
☐ Canned responses editable and usable
☐ Auto‑reply triggers work
☐ Continuous learning updates scores
☐ Total cost < $3/month (use usage tracking)

Output: Dashboard with checkmarks and cost summary.

Files:

· src/routes/admin.readiness.tsx (new)

Done when: All checks pass and cost is verified.

---

Technical Reference

Restart command pm2 kill && pm2 start ecosystem.config.cjs && pm2 save
DB PGPASSWORD=daddyai2026 psql -h localhost -U daddyai -d daddyai
Git remote https://github.com/etside/daddyai.git (branch: main)
Local source /root/termux-helpers/openclaude/daddyai/src/
Stack TanStack Start, TanStack Query, Tailwind v4, shadcn/ui, PostgreSQL

Key Files

File Purpose
src/routes/admin.inbox.tsx Messenger-style inbox UI
src/routes/admin.training.tsx Training pairs management (labels, export)
src/routes/admin.analytics.tsx Analytics dashboard
src/routes/admin.progress.tsx Training job progress (has framer‑motion bug)
src/routes/api.public.webhooks.meta.tsx Meta webhook handler
src/lib/inbox.functions.ts Server fns: sessions, messages, drafts
src/lib/agent.server.ts AI reply generation
src/lib/ai.server.ts AI client (OpenAI, MIMO, Vision)
src/lib/meta-sender.server.ts Send messages via Meta API
src/lib/priority.server.ts Priority calculation (new)
src/lib/canned.server.ts Canned response CRUD (new)
src/lib/auto-reply.engine.ts Rule evaluation (new)
src/lib/pattern-extractor.server.ts Training pipeline (new)


