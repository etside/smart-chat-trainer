import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

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
    await supabaseAdmin
      .from("agent_settings")
      .update({ sync_schedule: data.schedule })
      .eq("id", 1);
    return { ok: true };
  });

export const getSyncSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("sync_schedule, last_sync_at")
      .eq("id", 1)
      .maybeSingle();
    return data || { sync_schedule: "manual", last_sync_at: null };
  });

export const previewSync = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ url: z.string().url().default(DEFAULT_SYNC_URL) }).parse(d || {})
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    
    const token = process.env['SYNC_TOKEN'];
    const secret = process.env['SYNC_SECRET'];

    if (!token || !secret) {
      throw new Error("Sync credentials not configured in environment variables.");
    }

    try {
      const payload = { action: "catalog", per_page: 5, session: "preview_sync" };
      const bodyStr = JSON.stringify(payload);
      
      const syncRes = await fetch(data.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
          "X-AI-Signature": `sha256=${await (async () => {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyStr));
            return Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
          })()}`,
          "X-Secret": secret
        },
        body: bodyStr
      });
      
      if (!syncRes.ok) throw new Error(`Preview failed: ${syncRes.statusText} (${syncRes.status})`);
      const apiData = await syncRes.json();
      const items = apiData.success && apiData.data?.products ? apiData.data.products : (Array.isArray(apiData) ? apiData : []);
      
      return { 
        preview: items.slice(0, 5).map((item: any) => ({
          name: item.name || item.title || "Unknown",
          price: item.price || "N/A",
          stock: item.stock_status || item.inventory || "N/A",
          isValid: Boolean(item.name || item.title) && (item.price !== undefined)
        }))
      };
    } catch (err: any) {
      throw new Error(`Preview failed: ${err.message}`);
    }
  });

async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (retries > 0 && res.status >= 500) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
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
      rawBody: z.string().optional()
    }).parse(d || {})
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const token = process.env['SYNC_TOKEN'];
    const secret = process.env['SYNC_SECRET'];

    if (!token || !secret) {
      throw new Error("Sync credentials (SYNC_TOKEN/SYNC_SECRET) not configured.");
    }

    // Check idempotency
    if (data.idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from("sync_runs")
        .select("id, status, items_count, error_message")
        .eq("idempotency_key", data.idempotencyKey)
        .maybeSingle();
      
      if (existing) {
        return { 
          count: existing.items_count, 
          message: `Idempotent result: Sync was already ${existing.status}.`,
          status: existing.status
        };
      }
    }

    // Verify signature if provided
    if (data.signature && data.rawBody) {
      const { verifyWebhookSignature } = await import("./admin.server");
      const isValid = await verifyWebhookSignature(data.rawBody, data.signature, secret);
      if (!isValid) throw new Error("Invalid webhook signature.");
    }

    // Create run record
    const { data: run } = await supabaseAdmin
      .from("sync_runs")
      .insert({ 
        status: "processing", 
        source: "api_sync",
        idempotency_key: data.idempotencyKey || null
      })
      .select()
      .single();

    try {
      const payload = { action: "catalog", per_page: 50, session: `sync_${run?.id || Date.now()}` }; // Added session ID
      const bodyStr = JSON.stringify(payload);
      
      const syncRes = await fetchWithRetry(data.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
          "X-AI-Signature": await (async () => {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            // Ensure payload is exactly what we send in the body
            const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyStr));
            return Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
          })()}`,
          "X-Secret": secret,
          "X-Idempotency-Key": data.idempotencyKey || `run_${run?.id}`
        },
        body: bodyStr
      });
      
      if (!syncRes.ok) {
        let errorBody = "";
        try {
          errorBody = await syncRes.text();
        } catch (e) {}
        throw new Error(`API sync failed: ${syncRes.statusText} (${syncRes.status}) - ${errorBody.slice(0, 500)}`);
      }
      
      const apiData = await syncRes.json();
      const items = apiData.success && apiData.data?.products ? apiData.data.products : (Array.isArray(apiData) ? apiData : []);
      
      const trainingPairs = items
        .filter((item: any) => (item.name || item.title) && item.price)
        .map((item: any) => ({
          question: `${item.name || item.title} এর স্টক বা দাম কত?`,
          answer: `${item.name || item.title} এর দাম ${item.price} টাকা। স্টক: ${item.stock_status || item.inventory || 'Available'}। বিবরণ: ${item.description || ''}`,
          status: 'approved' as const,
          source: 'api_sync'
        })).slice(0, 2000);

      const { error } = await supabaseAdmin
        .from("training_pairs")
        .upsert(trainingPairs, { onConflict: 'question' });

      if (error) throw error;

      if (run) {
        await supabaseAdmin
          .from("sync_runs")
          .update({ 
            status: "completed", 
            items_count: trainingPairs.length,
            finished_at: new Date().toISOString()
          })
          .eq("id", run.id);
        
        // Trigger training after successful sync
        const { triggerTraining } = await import("./console.functions");
        await triggerTraining({ data: { sync_run_id: run.id } as any });
      }

      return { 
        count: trainingPairs.length, 
        message: `Successfully synced ${trainingPairs.length} items from API and triggered training.` 
      };
    } catch (err: any) {
      if (run) {
        await supabaseAdmin
          .from("sync_runs")
          .update({ 
            status: "failed", 
            error_message: err.message,
            finished_at: new Date().toISOString()
          })
          .eq("id", run.id);
      }
      throw new Error(`API Sync failed: ${err.message}`);
    }
  });
