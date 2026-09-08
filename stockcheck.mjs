import { supabaseAdmin } from './src/integrations/supabase/client.server.ts'
// Check what stock/availability fields look like in the catalog
const { data } = await supabaseAdmin.from('product_catalogue').select('id,name,availability,stock,price,currency').limit(5)
console.log(JSON.stringify(data, null, 2))
const { data: avail } = await supabaseAdmin.from('product_catalogue').select('availability, stock').limit(317)
const counts = {}
for (const r of avail||[]) {
  const k = `${r.availability}`
  counts[k] = (counts[k]||0)+1
}
console.log('availability counts:', counts)
const stockCounts = {}
for (const r of avail||[]) stockCounts[String(r.stock)] = (stockCounts[String(r.stock)]||0)+1
console.log('stock counts sample:', Object.entries(stockCounts).slice(0,15))
