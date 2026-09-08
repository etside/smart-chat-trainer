import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";
import { logActionUsage } from "./usage.functions";

const DEFAULT_SYNC_URL = "https://api.v2.wearimpressive.com/api/ai/webhook";

export const getSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sync_runs")
      .select("*, training_jobs(*)")
      .order("started_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

export const updateSyncSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ schedule: z.enum(["manual", "hourly", "daily", "weekly"]) }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("agent_settings").update({ sync_schedule: data.schedule }).eq("id", 1);
    return { ok: true };
  });

export const getSyncSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("sync_schedule, last_sync_at, last_sync_status, last_sync_details")
      .eq("id", 1)
      .maybeSingle();
    return data || { sync_schedule: "manual", last_sync_at: null, last_sync_status: null, last_sync_details: null };
  });

export const previewSync = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ url: z.string().url().default(DEFAULT_SYNC_URL) }).parse(d || {})
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin.from("agent_settings").select("sync_token, sync_secret").eq("id", 1).maybeSingle();
    const token = settings?.sync_token || process.env["SYNC_TOKEN"];
    const secret = settings?.sync_secret || process.env["SYNC_SECRET"];
    if (!token || !secret) throw new Error("Sync credentials not configured.");
    try {
      const payload = { action: "catalog", per_page: 5, session: "preview_sync" };
      const bodyStr = JSON.stringify(payload);
      const sig = await hmacSign(bodyStr, secret);
      const syncRes = await fetch(data.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
          "X-AI-Signature": `sha256=${sig}`,
          "X-Secret": secret,
        },
        body: bodyStr,
      });
      if (!syncRes.ok) throw new Error(`Preview failed: ${syncRes.statusText} (${syncRes.status})`);
      const apiData = await syncRes.json();
      const items = apiData.success && apiData.data?.products ? apiData.data.products : (Array.isArray(apiData) ? apiData : []);
      return {
        preview: items.slice(0, 5).map((item: any) => ({
          name: item.name || item.title || "Unknown",
          price: item.effective_price || item.price || "N/A",
          stock: item.quantity ?? item.stock ?? item.stock_status ?? "N/A",
          category: item.category || "",
          variants: item.variants?.length || 0,
          image_url: item.image || item.images?.[0]?.url || "",
          product_url: item.permalink || item.url || `https://wearimpressive.com/products/${item.slug || item.id}`,
          isValid: Boolean(item.name || item.title) && item.price !== undefined,
        })),
        total: apiData.data?.total || items.length,
      };
    } catch (err: any) {
      throw new Error(`Preview failed: ${err.message}`);
    }
  });

async function hmacSign(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (retries > 0 && res.status >= 500) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

export const syncCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      url: z.string().url().default(DEFAULT_SYNC_URL),
      idempotencyKey: z.string().optional(),
      signature: z.string().optional(),
      rawBody: z.string().optional(),
    }).parse(d || {})
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin.from("agent_settings").select("sync_token, sync_secret").eq("id", 1).maybeSingle();
    const token = settings?.sync_token || process.env["SYNC_TOKEN"];
    const secret = settings?.sync_secret || process.env["SYNC_SECRET"];
    if (!token || !secret) throw new Error("Sync credentials (SYNC_TOKEN/SYNC_SECRET) not configured.");

    if (data.idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from("sync_runs").select("id, status, items_count, error_message")
        .eq("idempotency_key", data.idempotencyKey).maybeSingle();
      if (existing) return { count: existing.items_count, message: `Idempotent result: Sync was already ${existing.status}.`, status: existing.status };
    }

    if (data.signature && data.rawBody) {
      const { verifyWebhookSignature } = await import("./admin.server");
      const isValid = await verifyWebhookSignature(data.rawBody, data.signature, secret);
      if (!isValid) throw new Error("Invalid webhook signature.");
    }

    const { data: run } = await supabaseAdmin
      .from("sync_runs").insert({ status: "processing", source: "api_sync", idempotency_key: data.idempotencyKey || null })
      .select().single();

    try {
      // ── Fetch all pages ──────────────────────────────────────────────────
      let allItems: any[] = [];
      let page = 1;
      const perPage = 50;
      let totalPages = 1;

      while (page <= totalPages && page <= 20) {
        const payload = { action: "catalog", per_page: perPage, page, session: `sync_${run?.id || Date.now()}`, token: token.startsWith("Bearer ") ? token.slice(7) : token };
        const bodyStr = JSON.stringify(payload);
        const sig = await hmacSign(bodyStr, secret);

        const syncRes = await fetchWithRetry(data.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
            "X-AI-Signature": `sha256=${sig}`,
            "X-Secret": secret,
            "X-Idempotency-Key": data.idempotencyKey || `run_${run?.id}`,
            "Token": token.startsWith("Bearer ") ? token.slice(7) : token,
            "Secret": secret,
          },
          body: bodyStr,
        });

        if (!syncRes.ok) {
          let errorBody = ""; try { errorBody = await syncRes.text(); } catch {}
          throw new Error(`API sync failed: ${syncRes.statusText} (${syncRes.status}) - ${errorBody.slice(0, 500)}`);
        }

        const apiData = await syncRes.json();
        const pageItems = apiData.success && apiData.data?.products ? apiData.data.products : (Array.isArray(apiData) ? apiData : []);
        allItems = allItems.concat(pageItems);

        if (apiData.data?.last_page) { totalPages = apiData.data.last_page; }
        else if (pageItems.length < perPage) { break; }
        page++;
      }

      const items = allItems;
      console.log(`[sync] Fetched ${items.length} products across ${page - 1} pages`);

      // ── 1. Upsert product_catalogue with full product data ───────────────
      const catalogueRows = items
        .filter((item: any) => item.name || item.title)
        .map((item: any) => ({
          retailer_id: String(item.id || item.sku || item.slug || item.name),
          slug: item.slug || String(item.id || item.name),
          name: item.name || item.title,
          description: item.description || item.short_description || "",
          short_description: item.short_description || (item.description || "").slice(0, 200),
          price: parseFloat(item.effective_price || item.price) || 0,
          currency: "BDT",
          availability: (parseInt(item.quantity ?? item.stock ?? "1") > 0) ? "in stock" : "out of stock",
          stock: parseInt(item.quantity ?? item.stock ?? "0") || 0,
          category: item.category || "",
          brand: item.brand || "",
          image_url: item.image || item.images?.[0]?.url || item.featured_image || item.thumbnail || "",
          product_url: item.permalink || item.url || `https://wearimpressive.com/products/${item.slug || item.id}`,
          variants: JSON.stringify(item.variants || []),
          sizes: Array.isArray(item.variants)
            ? item.variants.map((v: any) => v.options?.size || v.size || v.name).filter(Boolean)
            : [],
          updated_at: new Date().toISOString(),
        }));

      if (catalogueRows.length > 0) {
        const { error: catErr } = await supabaseAdmin
          .from("product_catalogue")
          .upsert(catalogueRows, { onConflict: "retailer_id" });
        if (catErr) console.error("[sync] product_catalogue upsert error:", catErr.message);
        else console.log(`[sync] Upserted ${catalogueRows.length} products into product_catalogue`);
      }

      // ── 2. Generate training pairs with intent tagging ────────────────────
      function detectIntentForPair(question: string, answer: string): string {
        const lowerQ = question.toLowerCase();
        const lowerA = answer.toLowerCase();
        if (/স্টক|stock|আছে কি|স্টকে|available|নেই/i.test(lowerQ)) return "stock";
        if (/দাম|price|টাকা|কত/i.test(lowerQ)) return "price";
        if (/সাইজ|size|মাপ|fit/i.test(lowerQ)) return "size";
        if (/সম্পর্কে জানান|বলুন|describe|about|details/i.test(lowerQ)) return "product";
        if (/অর্ডার|order|কিনব|কেনা|buy|কিনতে/i.test(lowerQ)) return "order";
        if (/ডেলিভারি|delivery|শিপিং|shipping|কুরিয়er|courier/i.test(lowerQ)) return "delivery";
        if (/ফেব্রিক|fabric|মেটেরিয়াল|material|কাপড়|cloth|গ্যাবার্ডিন|gabardine|কটন|cotton|জিন্স|denim/i.test(lowerQ)) return "material";
        if (/প্রোডাক্ট|product|পণ্য|কালেকশন|collection|dress|shirt|pant|bag|shoe|ছবি|picture|photo|screenshot|লিংক|link/i.test(lowerQ)) return "product";
        return "product";
      }

      const trainingPairs = items
        .filter((item: any) => (item.name || item.title) && (item.price || item.effective_price))
        .flatMap((item: any) => {
          const name = item.name || item.title;
          const price = item.effective_price || item.price;
          const stock = item.quantity ?? item.stock ?? item.stock_status ?? "Available";
          const category = item.category || "";
          const brand = item.brand || "";
          const desc = item.short_description || item.description || "";
          const imageUrl = item.image || item.images?.[0]?.url || item.featured_image || "";
          const productUrl = item.permalink || item.url || `https://wearimpressive.com/products/${item.slug || item.id}`;

          const pairs = [];

          // Price Q&A with product URL
          pairs.push({
            question: `${name} এর দাম কত?`,
            answer: `${name} এর দাম ${price} টাকা।${category ? ` ক্যাটাগরি: ${category}।` : ""}${brand ? ` ব্র্যান্ড: ${brand}।` : ""} দেখুন: ${productUrl}`,
            status: "approved" as const,
            source: "api_sync",
            intent: "price",
          });

          // Stock Q&A
          const heldQty = item.held_quantity ?? 0;
          const effectiveStock = typeof stock === "number" ? Math.max(0, stock - heldQty) : stock;
          const stockAnswer = typeof effectiveStock === "number"
            ? (effectiveStock > 0 ? `স্টকে আছে (${effectiveStock}টি)` : "স্টকে নেই")
            : (stock === 0 || stock === "out_of_stock" ? "স্টকে নেই" : "স্টকে আছে");
          pairs.push({
            question: `${name} স্টকে আছে কি?`,
            answer: `${name} এর স্টক: ${stockAnswer}।${imageUrl ? ` ছবি: ${imageUrl}` : ""} → ${productUrl}`,
            status: "approved" as const,
            source: "api_sync",
            intent: "stock",
          });

          // Variant Q&A
          if (item.variants && Array.isArray(item.variants)) {
            for (const v of item.variants.slice(0, 5)) {
              const label = v.options ? Object.values(v.options).join(", ") : (v.sku || "variant");
              pairs.push({
                question: `${name} ${label} এর দাম ও স্টক কত?`,
                answer: `${name} ${label} — দাম: ${v.effective_price || v.price || price} টাকা, স্টক: ${v.stock ?? "Available"}। → ${productUrl}`,
                status: "approved" as const,
                source: "api_sync",
                intent: "price",
              });
            }
          }

          // Description Q&A
          if (desc) {
            pairs.push({
              question: `${name} সম্পর্কে জানান`,
              answer: `${name}: ${desc}। দাম: ${price} টাকা।${imageUrl ? ` ছবি: ${imageUrl}` : ""} → ${productUrl}`,
              status: "approved" as const,
              source: "api_sync",
              intent: "product",
            });
          }

          return pairs;
        })
        .slice(0, 5000);

      const { error } = await supabaseAdmin
        .from("training_pairs")
        .upsert(trainingPairs, { onConflict: "question" });
      if (error) throw error;

      if (run) {
        await supabaseAdmin.from("sync_runs").update({
          status: "completed", items_count: trainingPairs.length, finished_at: new Date().toISOString(),
        }).eq("id", run.id);

        await supabaseAdmin.from("agent_settings").update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "success",
          last_sync_details: { run_id: run.id, items_count: trainingPairs.length, catalogue_count: catalogueRows.length, source: data.url },
        }).eq("id", 1);

        await supabaseAdmin.from("audit_logs").insert({
          actor_id: context.userId, action: "trigger_sync", entity_type: "sync_runs", entity_id: run.id,
          metadata: { endpoint: data.url, status: "success", items: trainingPairs.length, catalogue: catalogueRows.length },
        });

        const { triggerTraining } = await import("./console.functions");
        await triggerTraining({ data: { sync_run_id: run.id } as any });

        await logActionUsage({ data: { action: "product_sync", metadata: { items: trainingPairs.length } } }).catch(console.error);
      }

      return {
        count: trainingPairs.length,
        catalogue_count: catalogueRows.length,
        message: `Synced ${items.length} products → ${catalogueRows.length} catalogue entries + ${trainingPairs.length} training pairs.`,
      };
    } catch (err: any) {
      if (run) {
        await supabaseAdmin.from("sync_runs").update({
          status: "failed", error_message: err.message, finished_at: new Date().toISOString(),
        }).eq("id", run.id);
        await supabaseAdmin.from("agent_settings").update({
          last_sync_status: "failed", last_sync_details: { run_id: run.id, error: err.message, source: data.url },
        }).eq("id", 1);
      }
      throw new Error(`API Sync failed: ${err.message}`);
    }
  });
