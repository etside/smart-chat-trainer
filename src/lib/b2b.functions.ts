import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { assertAdmin } from './admin.server';

/** Test Backblaze B2 connection */
export const testBackblazeConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('b2b_backblaze_key')
      .eq('id', 1)
      .maybeSingle();

    const key = (data as any)?.b2b_backblaze_key;
    if (!key) return { ok: false, error: 'Backblaze B2 key not configured' };

    try {
      // Test by listing buckets
      const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_list_buckets', {
        method: 'POST',
        headers: {
          'Authorization': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: '' }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { ok: false, error: `Backblaze API error (${res.status}): ${err.slice(0, 200)}` };
      }

      const json = await res.json();
      return {
        ok: true,
        data: {
          buckets: json.buckets?.length || 0,
          accountId: json.accountId || 'unknown',
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Connection failed' };
    }
  });

/** Test Boson workspace connection */
export const testBosonConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('boson_workspace_id')
      .eq('id', 1)
      .maybeSingle();

    const workspaceId = (data as any)?.boson_workspace_id;
    if (!workspaceId) return { ok: false, error: 'Boson Workspace ID not configured' };

    try {
      const res = await fetch(`https://api.boson.ai/workspace/${workspaceId}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        return { ok: false, error: `Boson API error (${res.status})` };
      }

      const json = await res.json();
      return { ok: true, data: { workspace: json.name || workspaceId, status: json.status || 'active' } };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Connection failed' };
    }
  });

/** Test Fish Audio TTS connection */
export const testFishAudioConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('fish_audio_api_key')
      .eq('id', 1)
      .maybeSingle();

    const apiKey = (data as any)?.fish_audio_api_key;
    if (!apiKey) return { ok: false, error: 'Fish Audio API key not configured' };

    try {
      // Test by listing voice models
      const res = await fetch('https://api.fish.audio/model?limit=1', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.text();
        return { ok: false, error: `Fish Audio API error (${res.status}): ${err.slice(0, 200)}` };
      }

      const json = await res.json();
      return {
        ok: true,
        data: {
          models: json.total || json.items?.length || 0,
          quota: json.quota || 'unknown',
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Connection failed' };
    }
  });

/** Test MiMo TTS connection */
export const testMimoTTSConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('lovable_api_key_override')
      .eq('id', 1)
      .maybeSingle();

    const apiKey = (data as any)?.lovable_api_key_override || process.env['MIMO_API_KEY'];
    if (!apiKey) return { ok: false, error: 'MiMo API key not configured' };

    try {
      const GATEWAY = process.env['AI_GATEWAY_URL'] || 'https://api.xiaomimimo.com/v1';
      const res = await fetch(`${GATEWAY}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        return { ok: false, error: `MiMo API error (${res.status})` };
      }

      const json = await res.json();
      return {
        ok: true,
        data: {
          models: json.data?.length || 0,
          gateway: GATEWAY,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Connection failed' };
    }
  });

/** Get all B2B service statuses at once */
export const getB2BStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('b2b_backblaze_key, boson_workspace_id, fish_audio_api_key, lovable_api_key_override, vps_hosting_config, alt_api_keys')
      .eq('id', 1)
      .maybeSingle();

    const row = data as any;
    return {
      backblaze: { configured: !!row?.b2b_backblaze_key, masked: row?.b2b_backblaze_key ? '••••••••' : '' },
      boson: { configured: !!row?.boson_workspace_id, workspaceId: row?.boson_workspace_id || '' },
      fishAudio: { configured: !!row?.fish_audio_api_key, masked: row?.fish_audio_api_key ? '••••••••' : '' },
      mimoTTS: { configured: !!(row?.lovable_api_key_override || process.env['MIMO_API_KEY']) },
      vpsHosting: { configured: !!row?.vps_hosting_config?.serverUrl, config: row?.vps_hosting_config || {} },
      altApiKeys: { count: Object.keys(row?.alt_api_keys || {}).length, keys: Object.keys(row?.alt_api_keys || {}) },
    };
  });
