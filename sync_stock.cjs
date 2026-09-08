#!/usr/bin/env node
/**
 * Wear Impressive Stock Sync Script
 * Scrapes product pages and updates product_catalogue + training_pairs
 * Run via cron every 30 minutes
 */

const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");

const PRODUCT_URLS_FILE = "/tmp/wi_product_urls.txt";
const DB_USER = process.env.PGUSER || "daddyai";
const DB_NAME = process.env.PGDATABASE || "daddyai";
const DB_HOST = process.env.PGHOST || "127.0.0.1";
const DB_PASSWORD = process.env.PGPASSWORD || "";

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta[^>]*(?:name|property)="${name}"[^>]*content="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : "";
}

function esc(s) { return String(s).replace(/'/g, "''").replace(/\\/g, "\\\\"); }

async function syncStock() {
  // Read product URLs
  let urls;
  try {
    urls = fs.readFileSync(PRODUCT_URLS_FILE, "utf8").trim().split("\n");
  } catch (e) {
    console.error("Product URLs file not found. Run initial scrape first.");
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting stock sync for ${urls.length} products...`);

  const updates = [];
  const concurrency = 5;

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(async (url) => {
      const html = await fetch(url);
      const slug = url.split("/products/")[1];
      const name = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
      const price = parseFloat(extractMeta(html, "product:price:amount")) || 0;
      const availability = extractMeta(html, "product:availability");
      const desc = extractMeta(html, "og:description") || extractMeta(html, "description");

      return { slug, name, price, availability, desc };
    }));

    for (const r of results) {
      if (r.status === "fulfilled") updates.push(r.value);
    }
  }

  console.log(`Fetched ${updates.length} products`);

  // Generate SQL updates
  let sql = "";
  let stockChanges = 0;

  for (const p of updates) {
    if (!p.name) continue;
    const cleanName = p.name.replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
    const cleanDesc = (p.desc || "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

    // Update product catalogue
    sql += `UPDATE product_catalogue SET price=${p.price}, availability='${esc(p.availability)}', description='${esc(cleanDesc)}', updated_at=now() WHERE slug='${esc(p.slug)}';\n`;

    // Update training pairs for this product's stock status
    const inStock = p.availability === "in stock";
    const stockAnswer = inStock
      ? `${cleanName} স্টকে আছে! এখনই অর্ডার করতে পারেন। দাম: ${p.price} টাকা।`
      : `${cleanName} বর্তমানে স্টকে নেই। রিস্টক হলে জানাতে পারেন।`;

    sql += `UPDATE training_pairs SET answer='${esc(stockAnswer)}', updated_at=now() WHERE question='${esc(cleanName)} স্টকে আছে?';\n`;

    const priceAnswer = `${cleanName} এর দাম ${p.price} টাকা। ${inStock ? "স্টকে আছে!" : "বর্তমানে স্টকে নেই।"}`;
    sql += `UPDATE training_pairs SET answer='${esc(priceAnswer)}', updated_at=now() WHERE question='এই প্রোডাক্টের দাম কত? | ${esc(cleanName)}';\n`;

    stockChanges++;
  }

  // Write SQL and execute
  const sqlFile = "/tmp/stock_sync_update.sql";
  fs.writeFileSync(sqlFile, sql);

  try {
    execSync(`PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -f ${sqlFile}`, { stdio: "pipe" });
    console.log(`Updated ${stockChanges} products in database`);
  } catch (e) {
    console.error("Database update failed:", e.message);
  }

  // Regenerate "what's in stock" training pair
  const inStockProducts = updates.filter(p => p.availability === "in stock" && p.name);
  const stockList = inStockProducts.map((p, i) => `${i + 1}. ${p.name.replace(/&amp;/g, "&")} — ${p.price} টাকা`).join("\\n");

  const generalSql = `
UPDATE training_pairs SET answer='বর্তমানে স্টকে যা আছে (${inStockProducts.length}টি প্রোডাক্ট):\\n${stockList}\\n\\nঅর্ডার করতে প্রোডাক্টের স্ক্রিনশট পাঠান!', updated_at=now() WHERE question='কী কী স্টকে আছে?';
UPDATE training_pairs SET answer='Currently in stock (${inStockProducts.length} products):\\n${stockList.replace(/টাকা/g, "BDT")}\\n\\nSend a product screenshot to order!', updated_at=now() WHERE question='What products are in stock?';
`;

  fs.writeFileSync("/tmp/stock_general_update.sql", generalSql);
  try {
    execSync(`PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -f /tmp/stock_general_update.sql`, { stdio: "pipe" });
    console.log("Updated general stock listing pairs");
  } catch (e) {
    console.error("General stock update failed:", e.message);
  }

  console.log(`[${new Date().toISOString()}] Stock sync complete!`);
}

syncStock().catch(console.error);
