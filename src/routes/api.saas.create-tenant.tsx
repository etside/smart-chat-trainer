import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/saas/create-tenant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        };

        try {
          const body = await request.json();
          const { name, email, phone, slug, plan, user_id } = body;

          if (!name || !email || !slug || !user_id) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Get plan ID
          const { data: planRow } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("name", plan ?? "free")
            .maybeSingle();

          // Create tenant
          const { data: tenant, error: tenantErr } = await supabaseAdmin
            .from("tenants")
            .insert({
              name,
              email,
              phone: phone || null,
              slug,
              plan_id: planRow?.id ?? null,
              status: "trial",
            })
            .select()
            .single();

          if (tenantErr) {
            // Slug conflict — generate unique one
            if (tenantErr.code === '23505') {
              const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
              const { data: tenant2, error: err2 } = await supabaseAdmin
                .from("tenants")
                .insert({ name, email, phone: phone || null, slug: uniqueSlug, plan_id: planRow?.id ?? null, status: "trial" })
                .select().single();
              if (err2) throw new Error(err2.message);
              // Continue with tenant2
              await supabaseAdmin.from("tenant_users").insert({ tenant_id: tenant2.id, user_id, role: "owner" });
              if (planRow?.id) {
                await supabaseAdmin.from("subscriptions").insert({ tenant_id: tenant2.id, plan_id: planRow.id, status: plan === 'free' ? 'active' : 'trialing' });
              }
              return new Response(JSON.stringify({ ok: true, tenant_id: tenant2.id, slug: uniqueSlug }), { status: 200, headers: corsHeaders });
            }
            throw new Error(tenantErr.message);
          }

          // Link user as owner
          await supabaseAdmin.from("tenant_users").insert({ tenant_id: tenant.id, user_id, role: "owner" });

          // Create subscription
          if (planRow?.id) {
            await supabaseAdmin.from("subscriptions").insert({
              tenant_id: tenant.id,
              plan_id: planRow.id,
              status: plan === 'free' ? 'active' : 'trialing',
            });
          }

          return new Response(JSON.stringify({ ok: true, tenant_id: tenant.id, slug }), { status: 200, headers: corsHeaders });
        } catch (err: any) {
          console.error("[create-tenant]", err.message);
          return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), { status: 500, headers: corsHeaders });
        }
      },
    },
  },
});
