/**
 * Daddy AI — Model Context Protocol (MCP) endpoint
 * Transport: HTTP (Streamable HTTP per MCP spec 2025-03-26)
 *
 * Tools exposed:
 *   search_products      — semantic/text search in product_catalogue
 *   get_training_stats   — training pair counts, confidence score
 *   add_training_pair    — add a new approved training pair
 *   trigger_sync         — kick off a catalog sync to refresh products/prices/stock
 *   get_conversations    — recent conversations for analysis
 *   auto_train           — run one auto-training cycle
 *   get_backup           — returns latest backup bundle URL or generates one on demand
 */

import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ── MCP tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_products",
    description: "Search the product catalogue by keyword. Returns matching products with images, prices, stock, and order links.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Product name, category, or keyword to search" },
        limit: { type: "number", description: "Max results (1-10, default 5)" },
        in_stock_only: { type: "boolean", description: "Only return in-stock products" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_training_stats",
    description: "Get current training statistics: total pairs, approved/pending counts, confidence score, last sync time.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_training_pair",
    description: "Add a new training Q&A pair to improve the agent. Auto-approved.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Customer question" },
        answer: { type: "string", description: "Agent answer (accurate, helpful)" },
        language: { type: "string", description: "bn or en", default: "bn" },
      },
      required: ["question", "answer"],
    },
  },
  {
    name: "trigger_sync",
    description: "Trigger a catalog sync to refresh products, prices, and stock.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_conversations",
    description: "Get recent conversations for analysis. Returns last N conversation turns.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of conversations (1-20, default 10)" },
        source: { type: "string", description: "Filter by source (api, whatsapp, web)" },
      },
    },
  },
  {
    name: "auto_train",
    description: "Run one auto-training cycle: analyzes recent conversations, generates new Q&A pairs, approves them until confidence threshold is met.",
    inputSchema: {
      type: "object",
      properties: {
        max_pairs: { type: "number", description: "Max pairs to generate (default 20)" },
      },
    },
  },
  {
    name: "get_backup",
    description: "Returns the latest backup bundle URL or generates a new backup on demand.",
    inputSchema: {
      type: "object",
      properties: {
        generate: { type: "boolean", description: "If true, generate a fresh backup instead of returning the latest cached one" },
      },
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleTool(name: string, args: Record<string, any>, request: Request): Promise<unknown> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // ── Resolve tenant_id (JWT claims → query param → null) ─────────────────
  // 1) Parse JWT payload for tenant_id claim
  // 2) Fall back to ?tenant_id= query param
  // 3) Default to null (no tenant scoping)
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  const url = new URL(request.url);
  let tenantId: string | null = null;

  // Step 1: Decode JWT payload (base64url middle segment)
  if (authHeader) {
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson);
        const fromJwt =
          payload?.app_metadata?.tenant_id ??
          payload?.user_metadata?.tenant_id ??
          payload?.tenant_id ??
          null;
        if (fromJwt != null) tenantId = String(fromJwt);
      }
    } catch {}
  }

  // Step 2: Fall back to ?tenant_id= query param
  if (tenantId === null) {
    const qp = url.searchParams.get('tenant_id');
    if (qp) tenantId = qp;
  }

  // Step 3: tenantId remains null → no tenant filter applied

  switch (name) {
    case "search_products": {
      const limit = Math.min(Math.max(1, args.limit ?? 5), 10);
      let query = supabaseAdmin
        .from("product_catalogue")
        .select("id, name, price, currency, image_url, product_url, availability, stock, category, brand, short_description, sizes, variants")
        .or(`name.ilike.%${args.query}%,category.ilike.%${args.query}%,brand.ilike.%${args.query}%,description.ilike.%${args.query}%`)
        .order("stock", { ascending: false })
        .limit(limit);

      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (args.in_stock_only) query = query.eq("availability", "in stock");

      const { data } = await query;
      return {
        products: (data ?? []).map(p => ({
          id: p.id,
          name: p.name,
          price: `৳${p.price}`,
          availability: p.availability,
          stock: p.stock,
          category: p.category,
          brand: p.brand,
          image_url: p.image_url,
          product_url: p.product_url,
          short_description: p.short_description,
          sizes: p.sizes,
        })),
        total: data?.length ?? 0,
        query: args.query,
      };
    }

    case "get_training_stats": {
      let totalQ = supabaseAdmin.from("training_pairs").select("id", { count: "exact" });
      let approvedQ = supabaseAdmin.from("training_pairs").select("id", { count: "exact" }).eq("status", "approved");
      let pendingQ = supabaseAdmin.from("training_pairs").select("id", { count: "exact" }).eq("status", "pending");
      if (tenantId) {
        totalQ = totalQ.eq("tenant_id", tenantId);
        approvedQ = approvedQ.eq("tenant_id", tenantId);
        pendingQ = pendingQ.eq("tenant_id", tenantId);
      }
      const [totalRes, approvedRes, pendingRes, settingsRes] = await Promise.all([
        totalQ,
        approvedQ,
        pendingQ,
        supabaseAdmin.from("agent_settings").select("last_sync_at, training_confidence_score, last_auto_train_at").eq("id", 1).maybeSingle(),
      ]);
      let catalogQuery = supabaseAdmin.from("product_catalogue").select("id", { count: "exact" });
      if (tenantId) catalogQuery = catalogQuery.eq("tenant_id", tenantId);
      const catalogCount = (await catalogQuery).count ?? 0;
      return {
        total_pairs: totalRes.count ?? 0,
        approved_pairs: approvedRes.count ?? 0,
        pending_pairs: pendingRes.count ?? 0,
        product_catalogue_count: catalogCount,
        confidence_score: settingsRes.data?.training_confidence_score ?? 0,
        last_sync_at: settingsRes.data?.last_sync_at,
        last_auto_train_at: settingsRes.data?.last_auto_train_at,
      };
    }

    case "add_training_pair": {
      if (!args.question || !args.answer) throw new Error("question and answer are required");
      const { error } = await supabaseAdmin.from("training_pairs").insert({
        question: args.question.trim(),
        answer: args.answer.trim(),
        status: "approved",
        source: "mcp",
        language: args.language || "bn",
        ...(tenantId ? { tenant_id: tenantId } : {}),
      });
      if (error) throw new Error(error.message);
      return { success: true, message: "Training pair added and approved." };
    }

    case "trigger_sync": {
      // Call the sync endpoint internally
      const SYNC_TOKEN = process.env["SYNC_TOKEN"] || "";
      const SYNC_SECRET = process.env["SYNC_SECRET"] || "";
      if (!SYNC_TOKEN || !SYNC_SECRET) return { success: false, error: "Sync credentials not configured" };

      // Run sync directly
      const { data: run } = await supabaseAdmin
        .from("sync_runs").insert({ status: "processing", source: "mcp" }).select().single();

      // Fire-and-forget background sync
      import("@/lib/sync.functions").then(async ({ syncCatalog }) => {
        try {
          await (syncCatalog as any).handler({
            context: { supabase: supabaseAdmin, userId: "mcp" },
            data: { idempotencyKey: `mcp_sync_${Date.now()}` },
          });
        } catch (e: any) {
          console.error("[MCP] sync failed:", e.message);
        }
      }).catch(console.error);

      return { success: true, message: "Sync triggered in background.", run_id: run?.id };
    }

    case "get_conversations": {
      const limit = Math.min(Math.max(1, args.limit ?? 10), 20);
      let q = supabaseAdmin
        .from("conversations")
        .select("id, source, created_at, messages(role, content, seq)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.source) q = q.eq("source", args.source);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return { conversations: data ?? [], total: data?.length ?? 0 };
    }

    case "auto_train": {
      const maxPairs = Math.min(args.max_pairs ?? 20, 50);
      const { runAutoTraining } = await import("@/lib/auto-training.server");
      const result = await runAutoTraining(maxPairs);
      return result;
    }

    case "get_backup": {
      if (args.generate) {
        // Generate a fresh backup bundle
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `backups/backup-${timestamp}.json`;

        // Collect data for backup
        const [trainingPairs, settings, catalogItems] = await Promise.all([
          supabaseAdmin.from("training_pairs").select("*").eq("status", "approved"),
          supabaseAdmin.from("agent_settings").select("*").eq("id", 1).maybeSingle(),
          tenantId
            ? supabaseAdmin.from("product_catalogue").select("*").eq("tenant_id", tenantId)
            : supabaseAdmin.from("product_catalogue").select("*"),
        ]);

        const bundle = {
          generated_at: new Date().toISOString(),
          tenant_id: tenantId,
          training_pairs: trainingPairs.data ?? [],
          agent_settings: settings.data,
          product_catalogue_count: catalogItems.data?.length ?? 0,
        };

        // Store backup record in DB
        const { data: backupRecord, error } = await supabaseAdmin
          .from("backups")
          .insert({
            key: backupKey,
            tenant_id: tenantId,
            size_bytes: JSON.stringify(bundle).length,
            status: "completed",
          })
          .select()
          .maybeSingle();

        if (error) {
          // backups table may not exist yet — return inline bundle
          return { success: true, backup: bundle, note: "Inline backup (no backups table)" };
        }

        return { success: true, backup_key: backupKey, record: backupRecord, summary: { training_pairs: bundle.training_pairs.length, catalogue_items: bundle.product_catalogue_count } };
      }

      // Return latest backup record
      let latestQuery = supabaseAdmin
        .from("backups")
        .select("id, key, created_at, size_bytes, status, tenant_id")
        .order("created_at", { ascending: false })
        .limit(1);
      if (tenantId) latestQuery = latestQuery.eq("tenant_id", tenantId);

      const { data: latest, error } = await latestQuery.maybeSingle();
      if (error || !latest) {
        return { success: false, message: "No backup found. Call with generate: true to create one." };
      }
      return { success: true, backup: latest };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () => {
        // MCP capability discovery
        return json({
          protocolVersion: "2025-03-26",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "daddy-ai-mcp", version: "1.0.0" },
        });
      },

      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); }
        catch { return json({ error: "Invalid JSON" }, 400); }

        const { jsonrpc, method, params, id } = body;

        if (jsonrpc !== "2.0") return json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid JSON-RPC version" }, id: null });

        try {
          // ── initialize ────────────────────────────────────────────────
          if (method === "initialize") {
            return json({
              jsonrpc: "2.0",
              result: {
                protocolVersion: "2025-03-26",
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: "daddy-ai-mcp", version: "1.0.0" },
              },
              id,
            });
          }

          // ── tools/list ────────────────────────────────────────────────
          if (method === "tools/list") {
            return json({ jsonrpc: "2.0", result: { tools: TOOLS }, id });
          }

          // ── tools/call ────────────────────────────────────────────────
          if (method === "tools/call") {
            const toolName = params?.name;
            const toolArgs = params?.arguments ?? {};
            if (!toolName) return json({ jsonrpc: "2.0", error: { code: -32602, message: "Missing tool name" }, id });

            const result = await handleTool(toolName, toolArgs, request);
            return json({
              jsonrpc: "2.0",
              result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
              id,
            });
          }

          // ── notifications/initialized (no response needed) ────────────
          if (method === "notifications/initialized") {
            return new Response(null, { status: 204, headers: corsHeaders });
          }

          return json({ jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` }, id });
        } catch (err: any) {
          console.error("[MCP] error:", err);
          return json({
            jsonrpc: "2.0",
            error: { code: -32000, message: err.message || "Internal error" },
            id,
          });
        }
      },
    },
  },
});
