'use server'
/**
 * backup.functions.ts
 * Full DaddyAI knowledge bundle export/import.
 * Uses dynamic imports inside handlers to avoid import-protection errors.
 * Exports stored in `exports` table with 24h TTL, auto-pushed to MCP.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assertAdmin } from './admin.server';

export interface BackupBundle {
  version: string;
  exported_at: string;
  training_pairs: any[];
  auto_reply_templates: any[];
  auto_reply_rules: any[];
  agent_settings: Record<string, any>;
  product_catalogue_count: number;
}

/** Generate and store a full backup bundle. Returns the export ID. */
export const generateBackup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ label: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await assertAdmin((context as any).supabase, (context as any).userId);

    const [pairsRes, templatesRes, rulesRes, settingsRes, catalogRes] = await Promise.all([
      supabaseAdmin.from('training_pairs').select('question, answer, language, source').eq('approved', true).limit(5000),
      supabaseAdmin.from('auto_reply_templates').select('name, platform, language, template_text, variables, image_url, trigger_keywords'),
      supabaseAdmin.from('auto_reply_rules').select('*').limit(500),
      supabaseAdmin.from('agent_settings').select('system_prompt, model, voice_provider, fish_audio_model_id, auto_reply_mode').eq('id', 1).maybeSingle(),
      supabaseAdmin.from('product_catalogue').select('id', { count: 'exact', head: true }),
    ]);

    const bundle: BackupBundle = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      training_pairs: pairsRes.data ?? [],
      auto_reply_templates: templatesRes.data ?? [],
      auto_reply_rules: rulesRes.data ?? [],
      agent_settings: settingsRes.data ?? {},
      product_catalogue_count: catalogRes.count ?? 0,
    };

    const { data: exportRow, error } = await supabaseAdmin
      .from('exports')
      .insert({
        bundle,
        label: data.label ?? `Backup ${new Date().toLocaleDateString()}`,
        created_by: (context as any).userId,
      })
      .select('id, created_at, expires_at, label')
      .single();

    if (error) throw new Error(error.message);

    // Push to MCP (fire-and-forget, non-blocking)
    pushToMcp(exportRow.id, bundle).catch(console.error);

    return {
      id: exportRow.id,
      label: exportRow.label,
      created_at: exportRow.created_at,
      expires_at: exportRow.expires_at,
      stats: {
        training_pairs: bundle.training_pairs.length,
        templates: bundle.auto_reply_templates.length,
        rules: bundle.auto_reply_rules.length,
      },
    };
  });

/** List recent exports */
export const listBackups = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { data } = await supabaseAdmin
      .from('exports')
      .select('id, label, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(20);
    return { exports: data ?? [] };
  });

/** Download a specific export bundle */
export const downloadBackup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { data: row, error } = await supabaseAdmin
      .from('exports')
      .select('bundle, label, expires_at')
      .eq('id', data.id)
      .single();
    if (error || !row) throw new Error('Export not found or expired');
    if (new Date(row.expires_at) < new Date()) throw new Error('Export has expired');
    return { bundle: row.bundle as BackupBundle, label: row.label };
  });

/** Restore from a bundle — merges, does not delete existing data */
export const restoreBackup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ bundle: z.record(z.any()) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await assertAdmin((context as any).supabase, (context as any).userId);
    const bundle = data.bundle as BackupBundle;
    const restored = { training_pairs: 0, templates: 0, rules: 0 };

    if (bundle.training_pairs?.length) {
      const rows = bundle.training_pairs.map((p: any) => ({ ...p, approved: true }));
      const { count } = await supabaseAdmin
        .from('training_pairs')
        .upsert(rows, { onConflict: 'question', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true });
      restored.training_pairs = count ?? 0;
    }

    if (bundle.auto_reply_templates?.length) {
      const { count } = await supabaseAdmin
        .from('auto_reply_templates')
        .upsert(bundle.auto_reply_templates, { onConflict: 'name', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true });
      restored.templates = count ?? 0;
    }

    if (bundle.auto_reply_rules?.length) {
      const { count } = await supabaseAdmin
        .from('auto_reply_rules')
        .upsert(bundle.auto_reply_rules, { onConflict: 'id', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true });
      restored.rules = count ?? 0;
    }

    return { ok: true, restored };
  });

/** Cleanup expired exports. Called from the learn cron. */
export async function cleanupExpiredExports(): Promise<number> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { count } = await supabaseAdmin
    .from('exports')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}

/** Fire-and-forget push to MCP on backup generation */
async function pushToMcp(exportId: string, bundle: BackupBundle): Promise<void> {
  try {
    const mcpUrl = process.env['MCP_PUSH_URL'] ?? 'http://localhost:3000/mcp';
    await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env['MCP_AUTH_KEY'] ?? 'internal',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: `backup_${exportId}`,
        params: {
          name: 'notify_backup',
          arguments: {
            export_id: exportId,
            stats: {
              training_pairs: bundle.training_pairs.length,
              templates: bundle.auto_reply_templates.length,
            },
            exported_at: bundle.exported_at,
          },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn('[backup] MCP push failed (non-critical):', e);
  }
}
