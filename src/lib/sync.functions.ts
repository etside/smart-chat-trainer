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
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Fetch CSV
      const res = await fetch(data.url);
      if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.statusText}`);
      const csvText = await res.text();

      // Simple CSV parser (assuming comma-separated and quoted)
      const lines = csvText.split("\n").filter(l => l.trim());
      if (lines.length < 2) return { count: 0, message: "Catalog is empty" };

      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
      
      // We want to map this to training pairs
      // Likely columns: id, title, description, price, link, image_link, availability
      const items = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ""; });
        return obj;
      });

      // Transform products into training pairs
      // Example: "How much is [Title]?" -> "[Title] is [Price]. You can find it here: [Link]"
      const trainingPairs = items.map(item => {
        const title = item.title || item.name || "Product";
        const price = item.price || "Contact for price";
        const link = item.link || item.url || "";
        const description = item.description || "";
        
        return {
          question: `${title} এর দাম কত? (How much is ${title}?)`,
          answer: `${title} এর মূল্য ${price} টাকা। ${description ? `বিবরণ: ${description}` : ''} আপনি এখান থেকে কিনতে পারেন: ${link}`,
          status: 'approved' as const,
          source: 'catalog_sync'
        };
      }).slice(0, 1000); // Limit to 1000 pairs per sync for safety

      // 2. Insert into database
      const { data: inserted, error } = await supabaseAdmin
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
