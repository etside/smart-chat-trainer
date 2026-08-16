import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

export const syncCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        url: z.string().url().default("https://wearimpressive.com/api/meta-catalog?format=csv"),
      })
      .parse(d || {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if the URL is the new API endpoint
    if (data.url.includes("api.v2.wearimpressive.com")) {
      try {
        const syncRes = await fetch(data.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer 10f036a1730c407a7b060447f08543ac9f21ef1e0f9ef0f75f2b8ff474b2d7c4`,
            "X-Secret": "c7188d3e68a3a58ebd4adfb0209630b26922aebe619f14fb4e080742208fbed2"
          },
          body: JSON.stringify({ action: "get_all_info" })
        });
        
        if (!syncRes.ok) throw new Error(`API sync failed: ${syncRes.statusText}`);
        
        const apiData = await syncRes.json();
        // Assuming the API returns an array of products/info
        // If the API returns a different format, we might need to adjust this
        const items = Array.isArray(apiData) ? apiData : (apiData.products || []);
        
        const trainingPairs = items.map((item: any) => ({
          question: `${item.name || item.title} এর স্টক বা দাম কত?`,
          answer: `${item.name || item.title} এর দাম ${item.price} টাকা। স্টক: ${item.stock_status || item.inventory || 'Available'}। বিবরণ: ${item.description || ''}`,
          status: 'approved' as const,
          source: 'api_sync'
        })).slice(0, 1000);

        const { error } = await supabaseAdmin
          .from("training_pairs")
          .upsert(trainingPairs, { onConflict: 'question' });

        if (error) throw error;

        return { 
          count: trainingPairs.length, 
          message: `Successfully synced ${trainingPairs.length} items from API.` 
        };
      } catch (err: any) {
        console.error("API Sync error:", err);
        throw new Error(`API Sync failed: ${err.message}`);
      }
    }

    try {
      const res = await fetch(data.url);
      if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.statusText}`);
      const csvText = await res.text();

      const lines = csvText.split("\n").filter(l => l.trim());
      if (lines.length < 2) return { count: 0, message: "Catalog is empty" };

      const firstLine = lines[0];
      if (!firstLine) return { count: 0, message: "Empty headers" };
      const headers = firstLine.split(",").map(h => h.trim().replace(/^"|"$/g, ''));
      
      const items = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { 
          if (h) {
            obj[h] = values[i] || "";
          }
        });
        return obj;
      });

      const trainingPairs = items.map(item => {
        const title = item['title'] || item['name'] || "Product";
        const price = item['price'] || "Contact for price";
        const link = item['link'] || item['url'] || "";
        const description = item['description'] || "";
        
        return {
          question: `${title} এর দাম কত? (How much is ${title}?)`,
          answer: `${title} এর মূল্য ${price} টাকা। ${description ? `বিবরণ: ${description}` : ''} আপনি এখান থেকে কিনতে পারেন: ${link}`,
          status: 'approved' as const,
          source: 'catalog_sync'
        };
      }).slice(0, 1000);

      const { error } = await supabaseAdmin
        .from("training_pairs")
        .upsert(trainingPairs, { onConflict: 'question' });

      if (error) throw error;

      return { 
        count: trainingPairs.length, 
        message: `Successfully synced ${trainingPairs.length} products from catalog.` 
      };
    } catch (err: any) {
      console.error("Sync error:", err);
      throw new Error(`Sync failed: ${err.message}`);
    }
  });
