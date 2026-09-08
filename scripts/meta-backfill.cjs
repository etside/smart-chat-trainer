#!/usr/bin/env node
/**
 * Meta Inbox Backfill Script
 * Fetches historical conversations and messages from the Meta Graph API
 * and inserts them into conversation_sessions + session_messages.
 *
 * Usage: node /tmp/meta-backfill.cjs [--limit N] [--conversations N]
 */

const { Client } = require('pg');

const args = process.argv.slice(2);
const msgLimit = parseInt(args.find((_, i, a) => a[i - 1] === '--limit') || '50');
const convLimit = parseInt(args.find((_, i, a) => a[i - 1] === '--conversations') || '20');

async function main() {
  // Connect to DB
  const pg = new Client({ user: 'daddyai', database: 'daddyai', host: 'localhost', port: 5432, password: 'kxM0Nym2V43QiLQ6' });
  await pg.connect();

  // Get Meta credentials
  const { rows: [settings] } = await pg.query(
    "SELECT meta_access_token, meta_page_id FROM agent_settings WHERE id = 1"
  );
  if (!settings?.meta_access_token) {
    console.error('No meta_access_token in agent_settings');
    process.exit(1);
  }
  const token = settings.meta_access_token;
  const pageId = settings.meta_page_id;
  const GRAPH_URL = `https://graph.facebook.com/v21.0`;

  console.log(`Backfilling from page ${pageId}, limit: ${convLimit} conversations, ${msgLimit} messages each`);

  // 1. Fetch conversations from Meta
  const convUrl = `${GRAPH_URL}/${pageId}/conversations?platform=messenger&fields=participants,updated_time,message_count&limit=${convLimit}&access_token=${token}`;
  const convRes = await fetch(convUrl);
  const convData = await convRes.json();

  if (convData.error) {
    console.error('Meta API error:', convData.error.message);
    process.exit(1);
  }

  const conversations = convData.data || [];
  console.log(`Found ${conversations.length} conversations from Meta`);

  let sessionsCreated = 0;
  let messagesInserted = 0;
  let skipped = 0;

  for (const conv of conversations) {
    const participants = conv.participants?.data || [];
    // The customer is the non-page participant
    const customer = participants.find(p => p.id !== pageId);
    if (!customer) {
      skipped++;
      continue;
    }

    const externalId = customer.id;
    const customerName = customer.name || null;

    // 2. Upsert conversation session
    const { rows: [existing] } = await pg.query(
      "SELECT id FROM conversation_sessions WHERE external_id = $1 AND channel = 'messenger'",
      [externalId]
    );

    let sessionId;
    if (existing) {
      sessionId = existing.id;
      // Update name if null
      if (customerName) {
        await pg.query(
          "UPDATE conversation_sessions SET customer_name = $1 WHERE id = $2 AND customer_name IS NULL",
          [customerName, sessionId]
        );
      }
    } else {
      const { rows: [created] } = await pg.query(
        `INSERT INTO conversation_sessions (external_id, channel, customer_name, status, started_at, last_message_at)
         VALUES ($1, 'messenger', $2, 'active', $3, $3)
         RETURNING id`,
        [externalId, customerName, conv.updated_time]
      );
      sessionId = created.id;
      sessionsCreated++;
    }

    // 3. Fetch messages for this conversation
    const msgUrl = `${GRAPH_URL}/${conv.id}/messages?fields=message,from,created_time,attachments{type,image_data,payload}&limit=${msgLimit}&access_token=${token}`;
    const msgRes = await fetch(msgUrl);
    const msgData = await msgRes.json();

    if (msgData.error) {
      console.warn(`  Messages fetch failed for ${externalId}: ${msgData.error.message}`);
      continue;
    }

    const messages = msgData.data || [];

    // 4. Insert messages (skip duplicates by checking created_at + content hash)
    for (const msg of messages) {
      const content = msg.message || '';
      const role = msg.from?.id === pageId ? 'assistant' : 'user';
      // Meta created_time can be unix timestamp (number) or ISO string
      let createdAt;
      if (msg.created_time) {
        const d = typeof msg.created_time === 'number'
          ? new Date(msg.created_time * 1000)
          : new Date(msg.created_time);
        createdAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } else {
        createdAt = new Date().toISOString();
      }

      // Check for duplicate
      const { rows: [dup] } = await pg.query(
        "SELECT id FROM session_messages WHERE session_id = $1 AND created_at = $2 AND role = $3 LIMIT 1",
        [sessionId, createdAt, role]
      );
      if (dup) continue;

      // Handle attachments
      let metadata = { source: 'backfill' };
      if (msg.attachments?.data?.length > 0) {
        const att = msg.attachments.data[0];
        if (att.type === 'image' && att.image_data?.url) {
          metadata.image_url = att.image_data.url;
          metadata.attachment_type = 'image';
        } else if (att.type === 'video') {
          metadata.attachment_type = 'video';
        } else if (att.type === 'audio') {
          metadata.attachment_type = 'audio';
        }
      }

      if (!content && !metadata.image_url) continue; // Skip empty messages

      await pg.query(
        `INSERT INTO session_messages (session_id, role, content, channel, metadata, created_at)
         VALUES ($1, $2, $3, 'messenger', $4, $5)`,
        [sessionId, role, content, JSON.stringify(metadata), createdAt]
      );
      messagesInserted++;
    }

    console.log(`  ✓ ${customerName || externalId}: ${messages.length} messages`);
  }

  // Update message counts
  await pg.query(`
    UPDATE conversation_sessions cs SET message_count = (
      SELECT COUNT(*) FROM session_messages sm WHERE sm.session_id = cs.id
    )
  `);

  console.log(`\nBackfill complete:`);
  console.log(`  Sessions created: ${sessionsCreated}`);
  console.log(`  Messages inserted: ${messagesInserted}`);
  console.log(`  Skipped (no customer): ${skipped}`);

  await pg.end();
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
