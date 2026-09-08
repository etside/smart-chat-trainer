/**
 * validate-history.functions.ts
 * Server functions for plan validation history:
 *  - saveValidation    — persist a completed dossier + strategy
 *  - listValidations   — list history for current user
 *  - getValidation     — load a single record
 *  - deleteValidation  — soft-delete
 *  - diffValidations   — compute field-level diff between two records
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Save ──────────────────────────────────────────────────────────────────────

export const saveValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessName: z.string().max(100).optional(),
        sector: z.string().max(60).optional(),
        stage: z.string().max(40).optional(),
        country: z.string().max(60).optional(),
        rawPlanText: z.string().max(120_000),
        dossierJson: z.unknown(),
        strategyJson: z.unknown().optional(),
        overallScore: z.number().min(0).max(100).optional(),
        overallGrade: z.string().max(2).optional(),
        investSignal: z.string().max(30).optional(),
        oneLiner: z.string().max(200).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: record, error } = await supabaseAdmin
      .from("plan_validations")
      .insert({
        user_id: context.userId,
        business_name: data.businessName ?? null,
        sector: data.sector ?? null,
        stage: data.stage ?? null,
        country: data.country ?? null,
        raw_plan_text: data.rawPlanText,
        dossier_json: data.dossierJson,
        strategy_json: data.strategyJson ?? null,
        overall_score: data.overallScore ?? null,
        overall_grade: data.overallGrade ?? null,
        invest_signal: data.investSignal ?? null,
        one_liner: data.oneLiner ?? null,
      })
      .select("id, created_at")
      .single();

    if (error) throw new Error(error.message);
    return record;
  });

// ─── List ──────────────────────────────────────────────────────────────────────

export const listValidations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
      .optional()
      .default({})
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { limit, offset } = data;

    const { data: rows, error } = await supabaseAdmin
      .from("plan_validations")
      .select(
        "id, created_at, business_name, sector, stage, country, overall_score, overall_grade, invest_signal, one_liner"
      )
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Get Single ────────────────────────────────────────────────────────────────

export const getValidation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("plan_validations")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Validation record not found");
    return row;
  });

// ─── Soft Delete ───────────────────────────────────────────────────────────────

export const deleteValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("plan_validations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Version Diff ──────────────────────────────────────────────────────────────

export interface ValidationDiff {
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
  delta: number | null; // numeric delta if both are numbers
  changed: boolean;
}

export const diffValidations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        idA: z.string().uuid(), // older
        idB: z.string().uuid(), // newer
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fetchRecord = async (id: string) => {
      const { data: row, error } = await supabaseAdmin
        .from("plan_validations")
        .select("id, created_at, business_name, overall_score, overall_grade, invest_signal, one_liner, dossier_json")
        .eq("id", id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error || !row) throw new Error(`Record ${id} not found`);
      return row;
    };

    const [a, b] = await Promise.all([fetchRecord(data.idA), fetchRecord(data.idB)]);

    const compare = (field: string, label: string, va: unknown, vb: unknown): ValidationDiff => {
      const before = va == null ? null : String(va);
      const after  = vb == null ? null : String(vb);
      const delta =
        typeof va === "number" && typeof vb === "number"
          ? Math.round((vb - va) * 100) / 100
          : null;
      return { field, label, before, after, delta, changed: before !== after };
    };

    const diffs: ValidationDiff[] = [
      compare("overall_score",  "Overall Score",        a.overall_score, b.overall_score),
      compare("overall_grade",  "Overall Grade",        a.overall_grade, b.overall_grade),
      compare("invest_signal",  "Invest Signal",        a.invest_signal, b.invest_signal),
      compare("one_liner",      "One-liner Verdict",    a.one_liner,     b.one_liner),
      compare("business_name",  "Business Name",        a.business_name, b.business_name),
    ];

    // Section-level score diffs
    const da = (a.dossier_json as Record<string, unknown> | null)?.sections as Record<string, { score?: number }> | undefined;
    const db = (b.dossier_json as Record<string, unknown> | null)?.sections as Record<string, { score?: number }> | undefined;

    if (da && db) {
      for (const key of Object.keys(da)) {
        const va = da[key]?.score ?? null;
        const vb = db[key]?.score ?? null;
        diffs.push(compare(`section.${key}`, `Section: ${key.replace(/_/g, " ")}`, va, vb));
      }
    }

    return {
      recordA: { id: a.id, created_at: a.created_at },
      recordB: { id: b.id, created_at: b.created_at },
      diffs: diffs.filter((d) => d.changed),
      allDiffs: diffs,
    };
  });
