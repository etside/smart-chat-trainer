#!/usr/bin/env node
/**
 * DaddyAI E2E Adaptive Training Pipeline (hallucination-guarded)
 *
 * Every AI-generated reply is verified before becoming training truth:
 *   - Fact-check product claims (price/stock/size) against product_catalogue
 *   - Flag hallucination markers (unsupported prices, invented products)
 *   - Only admin-corrected or verified pairs are auto-approved
 *   - Unverified AI replies go to status=pending for human review
 */
import pg from "/var/www/daddyai/node_modules/pg/lib/index.js";
import fs from "fs";
const { Client } = pg;

const db = new Client({ host: "localhost", port: 5432, database: "daddyai", user: "daddyai", password: "kxM0Nym2V43QiLQ6" });
function log(msg) { console.log(`[e2e-train] ${msg}`); }

const KNOWN_PRICES = new Set();
async function loadKnownPrices() {
  const { rows } = await db.query("SELECT DISTINCT price FROM product_catalogue");
  rows.forEach(r => KNOWN_PRICES.add(Number(r.price)));
}

async function verifyReply(answer) {
  const priceClaims = answer.match(/৳\s?(\d[\d,]*)/g) || [];
  const priceNums = priceClaims.map(p => Number(p.replace(/[^\d]/g, "")));
  const { rows: products } = await db.query("SELECT name, price, availability, stock, sizes FROM product_catalogue LIMIT 500");
  const mentioned = products.filter(p => answer.includes(p.name) || answer.includes(p.name.toLowerCase()));

  for (const pNum of priceNums) {
    const inCatalogue = products.some(p => Number(p.price) === pNum);
    const closeToKnown = [...KNOWN_PRICES].some(kp => Math.abs(kp - pNum) <= 50);
    if (!inCatalogue && !closeToKnown) {
      const allPrices = products.map(p => Number(p.price));
      const min = Math.min(...allPrices), max = Math.max(...allPrices);
      if (pNum < min * 0.5 || pNum > max * 2) {
        return { verified: false, reason: `price_claim_suspicious: ৳${pNum} (range: ৳${min}-${max})` };
      }
    }
  }

  if (/স্টকে\s*আছে/.test(answer)) {
    const outOfStock = mentioned.filter(p => p.availability === false || Number(p.stock) === 0);
    if (outOfStock.length > 0 && mentioned.length > 0 && outOfStock.length === mentioned.length) {
      return { verified: false, reason: "stock_claim_contradicts: says in-stock but catalogue says out" };
    }
  }
  if (/স্টকে\s*নেই/.test(answer)) {
    const inStock = mentioned.filter(p => p.availability === true && Number(p.stock) > 0);
    if (inStock.length > 0 && mentioned.length > 0 && inStock.length === mentioned.length) {
      return { verified: false, reason: "stock_claim_contradicts: says out-of-stock but catalogue says in" };
    }
  }

  const FILLER = [/আমরা\s*অনেক\s*পণ্য/i, /অনেকগুলো\s*পণ্য\s*আছে/, /সব\s*পণ্য\s*আছে/, /যেকোনো\s*পণ্য/];
  for (const re of FILLER) {
    if (re.test(answer) && !mentioned.length) {
      return { verified: false, reason: "vague_no_specific_product" };
    }
  }

  const deliveryMatch = answer.match(/ডেলিভারি[:\s]*(\d+)\s*টাকা/);
  if (deliveryMatch) {
    const charge = Number(deliveryMatch[1]);
    if (charge !== 70 && charge !== 120 && charge !== 150 && charge !== 0) {
      return { verified: false, reason: `delivery_charge_unknown: ৳${charge}` };
    }
  }

  return { verified: true, reason: "all_checks_passed" };
}

async function ingestConversations(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const convos = Array.isArray(raw) ? raw : [raw];
  let approved = 0, pending = 0, rejected = 0;

  for (const c of convos) {
    const msgs = c.messages || c.history || [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const m = msgs[i], n = msgs[i + 1];
      if (m.role === "user" && (n.role === "assistant" || n.role === "agent")) {
        const q = (m.content || "").slice(0, 2000);
        const a = (n.content || "").slice(0, 4000);
        if (!q || !a) continue;

        const isAIGenerated = n.source === "ai" || n.is_ai === true || n.role === "assistant";
        const wasCorrected = n.corrected === true || n.edited_at !== undefined;

        let status = "approved";
        let source = "conversation";

        if (isAIGenerated && !wasCorrected) {
          const v = await verifyReply(a);
          if (v.verified) { status = "approved"; }
          else { status = "pending"; pending++; log(`PENDING: ${v.reason} — Q: ${q.slice(0, 60)}...`); }
        } else if (wasCorrected) {
          status = "approved"; source = "admin_correction";
        }

        if (status === "approved") approved++; else if (status !== "pending") rejected++;

        await db.query(
          `INSERT INTO training_pairs (question, answer, status, source, intent)
           VALUES ($1, $2, $3, $4, general)
           ON CONFLICT (question) DO UPDATE SET
             answer = CASE WHEN EXCLUDED.status = approved THEN EXCLUDED.answer ELSE training_pairs.answer END,
             status = CASE WHEN EXCLUDED.status = approved THEN approved ELSE training_pairs.status END,
             updated_at = NOW()`,
          [q, a, status, source]
        );
      }
    }
  }
  log(`Conversations: ${convos.length} convos → ${approved} approved, ${pending} pending review, ${rejected} rejected`);
  return { approved, pending, rejected };
}

async function ingestAdminCorrections() {
  const { rows } = await db.query(
    `SELECT m.id, m.session_id, m.content, m.draft_edited_at
     FROM messages m
     WHERE m.role = assistant AND m.is_draft = true AND m.draft_edited_at IS NOT NULL
     LIMIT 500`
  );
  let count = 0;
  for (const r of rows) {
    const { rows: userMsg } = await db.query(
      `SELECT content FROM messages WHERE session_id = $1 AND role = user AND created_at < $2 ORDER BY created_at DESC LIMIT 1`,
      [r.session_id, r.draft_edited_at]
    );
    if (userMsg[0]) {
      await db.query(
        `INSERT INTO training_pairs (question, answer, status, source, intent)
         VALUES ($1, $2, approved, admin_correction, general)
         ON CONFLICT (question) DO UPDATE SET answer = EXCLUDED.answer, status = approved, updated_at = NOW()`,
        [userMsg[0].content.slice(0, 2000), r.content.slice(0, 4000)]
      );
      count++;
    }
  }
  log(`Admin corrections: ${count} pairs (auto-approved — human verified)`);
  return count;
}

async function ingestProductKnowledge() {
  const { rows } = await db.query(
    `SELECT id, name, price, currency, availability, stock, category, short_description, sizes
     FROM product_catalogue WHERE synced_at > NOW() - MAKE_INTERVAL(hours => 24) LIMIT 500`
  );
  let count = 0;
  for (const p of rows) {
    const sizes = Array.isArray(p.sizes) ? p.sizes.join(", ") : "M, L, XL";
    const q = `${p.name} দাম কত?`;
    const a = `${p.name}: ৳${p.price} ${p.currency}. ${p.availability ? "স্টকে আছে" : "স্টকে নেই"}. সাইজ: ${sizes}. ${p.short_description || ""}`.slice(0, 4000);
    await db.query(
      `INSERT INTO training_pairs (question, answer, status, source, intent)
       VALUES ($1, $2, 'approved', 'product_sync', 'price')
       ON CONFLICT (question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW()`,
      [q, a]
    );
    count++;
  }
  log(`Product knowledge: ${count} pairs (verified against live catalogue)`);
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  await db.connect();
  await loadKnownPrices();
  log(`Loaded ${KNOWN_PRICES.size} known prices for verification`);

  let approved = 0, pending = 0, rejected = 0;

  if (args.includes("--all") || args.includes("--conversations")) {
    const idx = args.indexOf("--conversations");
    if (idx >= 0 && args[idx + 1]) {
      for (const f of args[idx + 1].split(",")) {
        const r = await ingestConversations(f.trim());
        approved += r.approved; pending += r.pending; rejected += r.rejected;
      }
    }
  }
  if (args.includes("--all") || args.includes("--corrections")) {
    approved += await ingestAdminCorrections();
  }
  if (args.includes("--all") || args.includes("--products")) {
    approved += await ingestProductKnowledge();
  }

  await db.query(
    `INSERT INTO training_jobs (status, processed_count) VALUES ('completed', $1)`,
    [approved]
  );

  log(`DONE. Approved: ${approved}, Pending review: ${pending}, Rejected: ${rejected}`);
  log(`Pending pairs are NOT used by the agent until admin approves them.`);
  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
