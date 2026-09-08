const https = require('https');
const { Client } = require('/var/www/daddyai/node_modules/pg');

const db = new Client({ host:'localhost', port:5432, database:'daddyai', user:'daddyai', password:'kxM0Nym2V43QiLQ6' });

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return fetchUrl(res.headers.location).then(resolve, reject);
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractPrice(html) {
  const patterns = [
    // Next.js RSC escaped JSON — "product:price:amount","content":"1200.00"
    /"product:price:amount\\\\",\\"content\\":\\"(\d+(?:\.\d+)?)\\"/, 
    // Standard meta tag
    /name="product:price:amount"\s+content="(\d+(?:\.\d+)?)"/,
    /content="(\d+(?:\.\d+)?)"[^>]*name="product:price:amount"/,
    // In RSC stream (unescaped)
    /"product:price:amount","content":"(\d+(?:\.\d+)?)"/,
    // Any price:amount pattern
    /price:amount["\s\\]+content["\s\\:]+(\d+(?:\.\d+)?)/,
    // JSON price fields
    /"price":"(\d+(?:\.\d+)?)"/,
    /"price":(\d+(?:\.\d+)?)[,}]/,
    // Bengali currency
    /৳\s*(\d{3,5})/,
    /Tk\.?\s*(\d{3,5})/i,
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const v = parseFloat(m[1]);
      if (v >= 100 && v <= 50000) return v;
    }
  }
  return null;
}

function extractAvailability(html) {
  // Next.js RSC escaped
  if (/"product:availability","content":"in.?stock"/i.test(html)) return 'in stock';
  if (/"product:availability","content":"out.?of.?stock"/i.test(html)) return 'out of stock';
  // Standard meta
  if (/content="in.?stock"/i.test(html)) return 'in stock';
  if (/content="out.?of.?stock"/i.test(html)) return 'out of stock';
  return null;
}

async function run() {
  await db.connect();
  const { rows } = await db.query("SELECT retailer_id, name, price, product_url FROM product_catalogue WHERE price = 0 ORDER BY name");
  
  console.log(`\n🔍 Verifying ${rows.length} zero-price products against live URLs\n${'━'.repeat(70)}`);
  
  let fixed = 0, noPrice = 0, failed = 0;
  const stillMissing = [];

  for (let i = 0; i < rows.length; i += 4) {
    const batch = rows.slice(i, i + 4);
    await Promise.all(batch.map(async (p) => {
      try {
        const { status, body } = await fetchUrl(p.product_url);
        if (status !== 200) { console.log(`❌ ${p.name.slice(0,50)} → HTTP ${status}`); failed++; return; }
        
        const livePrice = extractPrice(body);
        const liveAvail = extractAvailability(body);
        
        if (!livePrice) {
          console.log(`⚠️  ${p.name.slice(0,50)} → price not extractable`);
          noPrice++;
          stillMissing.push(p.product_url);
          return;
        }
        
        console.log(`🔧 ${p.name.slice(0,50)} → ৳${livePrice} (${liveAvail || 'avail unknown'}) — FIXING`);
        
        // Fix product_catalogue
        await db.query(`UPDATE product_catalogue SET price=$1, availability=COALESCE($2,availability), updated_at=NOW() WHERE retailer_id=$3`,
          [livePrice, liveAvail, p.retailer_id]);
        
        // Fix/add training pair
        const stockText = liveAvail === 'in stock' ? 'স্টকে আছে' : 'স্টকে নেই';
        await db.query(`
          INSERT INTO training_pairs (question, answer, status, source, language)
          VALUES ($1,$2,'approved','price_fix','bn')
          ON CONFLICT (question) DO UPDATE SET answer=EXCLUDED.answer, updated_at=NOW()
        `, [`${p.name} এর দাম কত?`, `${p.name} এর দাম ৳${livePrice} টাকা। ${stockText}। 🔗 ${p.product_url}`]);

        await db.query(`
          INSERT INTO training_pairs (question, answer, status, source, language)
          VALUES ($1,$2,'approved','price_fix','en')
          ON CONFLICT (question) DO UPDATE SET answer=EXCLUDED.answer, updated_at=NOW()
        `, [`What is the price of ${p.name}?`, `${p.name} costs ৳${livePrice}. ${liveAvail === 'in stock' ? 'In stock.' : 'Out of stock.'} Order: ${p.product_url}`]);

        fixed++;
      } catch(e) { console.log(`💥 ${p.name.slice(0,40)} → ${e.message}`); failed++; }
    }));
    await new Promise(r => setTimeout(r, 300));
  }

  const { rows: [stats] } = await db.query("SELECT COUNT(*) FILTER(WHERE price=0) zero, COUNT(*) FILTER(WHERE price>0) priced FROM product_catalogue");
  
  console.log(`\n${'━'.repeat(70)}\n📊 RESULTS`);
  console.log(`  🔧 Fixed:          ${fixed}`);
  console.log(`  ⚠️  Price missing:  ${noPrice}`);
  console.log(`  ❌ Failed:          ${failed}`);
  console.log(`\n📦 Catalogue: ${stats.priced} with price, ${stats.zero} still zero`);

  if (stillMissing.length) {
    console.log(`\n⚠️  Still need manual price update (${stillMissing.length}):`);
    stillMissing.forEach(u => console.log(`  ${u}`));
  }

  await db.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
