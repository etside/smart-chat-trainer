const crypto = require('crypto');
const https = require('https');
const { Client } = require('/var/www/daddyai/node_modules/pg');

const TOKEN = 'f5e1f9b68be9fc8d69867283a6ebdf61755f23e93ff0c014def36f555d7fb42f';
const SECRET = 'c05d89defdc77a396b6543c85bce957bb5a12394a0828c54825817d51b3cd58a';
const URL = 'https://api.v2.wearimpressive.com/api/ai/webhook';

const db = new Client({ host:'localhost', port:5432, database:'daddyai', user:'daddyai', password:'kxM0Nym2V43QiLQ6' });

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action:'catalog', per_page:50, page });
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const req = https.request(URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+TOKEN, 'X-AI-Signature':sig, 'X-Secret':SECRET }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  await db.connect();
  let all = [];
  let page = 1, last = 1;

  do {
    const res = await fetchPage(page);
    if (!res.success) { console.error('API error:', res.message); break; }
    const products = res.data && res.data.products ? res.data.products : [];
    all = all.concat(products);
    last = (res.data && res.data.last_page) ? res.data.last_page : 1;
    console.log('Page', page, '/', last, '- products so far:', all.length);
    page++;
  } while (page <= last && page <= 20);

  console.log('Total fetched:', all.length);

  let catCount = 0, trainCount = 0;

  for (const p of all) {
    const name = p.name || p.title;
    if (!name) continue;

    const price = parseFloat(p.effective_price || p.price) || 0;
    const stock = parseInt(p.quantity != null ? p.quantity : (p.stock != null ? p.stock : 0)) || 0;
    const imageUrl = p.image || p.featured_image || (p.images && p.images[0] && p.images[0].url ? p.images[0].url : '') || '';
    const productUrl = p.permalink || p.url || ('https://wearimpressive.com/products/' + (p.slug || p.id));
    const retailerId = String(p.id || p.sku || p.slug || name).slice(0, 255);
    const variants = JSON.stringify(p.variants || []);
    const sizes = (p.variants || []).map(v => (v.options && v.options.size) || v.size || v.name).filter(Boolean);

    try {
      await db.query(`
        INSERT INTO product_catalogue (retailer_id,slug,name,description,short_description,price,currency,availability,stock,category,brand,image_url,product_url,variants,sizes,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,'BDT',$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (retailer_id) DO UPDATE SET
          name=EXCLUDED.name,price=EXCLUDED.price,availability=EXCLUDED.availability,
          stock=EXCLUDED.stock,image_url=EXCLUDED.image_url,product_url=EXCLUDED.product_url,
          variants=EXCLUDED.variants,sizes=EXCLUDED.sizes,updated_at=NOW()
      `, [
        retailerId, (p.slug || String(p.id || name)).slice(0,255), name,
        (p.description || p.short_description || '').slice(0,2000),
        (p.short_description || p.description || '').slice(0,200),
        price, stock > 0 ? 'in stock' : 'out of stock', stock,
        (p.category || '').slice(0,255), (p.brand || '').slice(0,255),
        imageUrl.slice(0,1000), productUrl.slice(0,1000), variants, sizes
      ]);
      catCount++;
    } catch(e) { /* ignore */ }

    // Training pairs with image+URL embedded
    const stockText = stock > 0 ? `স্টকে আছে (${stock}টি)` : 'স্টকে নেই';
    const imgNote = imageUrl ? ` 📸 ${imageUrl}` : '';
    const priceText = price > 0 ? `৳${price}` : 'দাম জানতে যোগাযোগ করুন';

    const pairs = [
      { q: `${name} এর দাম কত?`, a: `${name} এর দাম ${priceText} টাকা। ${stockText}। 🔗 ${productUrl}${imgNote}` },
      { q: `${name} কি পাওয়া যাচ্ছে?`, a: `${name} ${stock > 0 ? 'স্টকে আছে।' : 'এই মুহূর্তে স্টকে নেই।'} দাম: ${priceText}। ${productUrl}` },
      { q: `${name} অর্ডার করতে চাই`, a: `চমৎকার পছন্দ! ${name} দাম ${priceText}। এখনই অর্ডার করুন: ${productUrl}${imgNote}` },
      { q: `What is the price of ${name}?`, a: `${name} costs ${priceText}. ${stock > 0 ? 'In stock.' : 'Out of stock.'} Order: ${productUrl}` },
    ];

    if (sizes.length > 0) {
      pairs.push({ q: `${name} কোন কোন সাইজে পাওয়া যায়?`, a: `${name} এই সাইজে পাওয়া যায়: ${sizes.join(', ')}। 🔗 ${productUrl}` });
    }

    for (const pair of pairs) {
      try {
        await db.query(`
          INSERT INTO training_pairs (question,answer,status,source,language)
          VALUES ($1,$2,'approved','api_sync','bn')
          ON CONFLICT (question) DO UPDATE SET answer=EXCLUDED.answer,updated_at=NOW()
        `, [pair.q.slice(0,1000), pair.a.slice(0,2000)]);
        trainCount++;
      } catch(e) {}
    }
  }

  console.log('Catalogue rows:', catCount);
  console.log('Training pairs:', trainCount);

  await db.query(`UPDATE agent_settings SET last_sync_at=NOW(), last_sync_status='success',
    last_sync_details='{"source":"initial_full_sync","items":${all.length}}'::jsonb WHERE id=1`);

  // Count totals
  const r1 = await db.query('SELECT COUNT(*) FROM product_catalogue');
  const r2 = await db.query("SELECT COUNT(*) FROM training_pairs WHERE status='approved'");
  console.log('Total catalogue:', r1.rows[0].count);
  console.log('Total approved training pairs:', r2.rows[0].count);

  await db.end();
  console.log('Sync complete!');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
