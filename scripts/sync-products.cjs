const crypto = require("crypto");
const https = require("https");
const { Client } = require("/var/www/daddyai/node_modules/pg");

const TOKEN = "f5e1f9b68be9fc8d69867283a6ebdf61755f23e93ff0c014def36f555d7fb42f";
const SECRET = "c05d89defdc77a396b6543c85bce957bb5a12394a0828c54825817d51b3cd58a";
const URL = "https://api.v2.wearimpressive.com/api/ai/webhook";
const db = new Client({ host:"localhost", port:5432, database:"daddyai", user:"daddyai", password:"kxM0Nym2V43QiLQ6" });

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action:"catalog", per_page:50, page });
    const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    const req = https.request(URL, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":"Bearer "+TOKEN, "X-AI-Signature":sig, "X-Secret":SECRET }
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function upsertProduct(p) {
  await db.query(`
    INSERT INTO products (external_id, name, description, sku, price, stock_quantity, image_url, category, synced_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (external_id) DO UPDATE SET
      name=EXCLUDED.name, description=EXCLUDED.description, sku=EXCLUDED.sku,
      price=EXCLUDED.price, stock_quantity=EXCLUDED.stock_quantity,
      image_url=EXCLUDED.image_url, category=EXCLUDED.category, synced_at=NOW()
  `, [String(p.id), p.name, p.description||"", p.sku||"", p.effective_price||p.price||0, p.stock||0, p.featured_image||"", p.category||""]);
}

async function run() {
  await db.connect();
  let page = 1, last = 1, total = 0;
  do {
    const res = await fetchPage(page);
    if (!res.success) { console.error("API error:", res.message); break; }
    const products = res.data && res.data.products ? res.data.products : [];
    for (const p of products) { await upsertProduct(p); total++; }
    last = (res.data && res.data.last_page) ? res.data.last_page : 1;
    console.log("Page", page, "/", last, "- synced so far:", total);
    page++;
  } while (page <= last);
  console.log("DONE. Total products synced:", total);
  await db.end();
}
run().catch(e => { console.error(e); process.exit(1); });
