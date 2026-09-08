import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/meta/oauth-url')({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        
        const { data: settings } = await supabaseAdmin
          .from('agent_settings')
          .select('meta_app_id')
          .eq('id', 1)
          .maybeSingle()

        if (!settings?.meta_app_id) {
          return new Response(JSON.stringify({ error: 'Meta App ID not configured' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
          })
        }

        const origin = 'https://daddyai.online'
        const redirectUri = origin + '/api/meta/callback'
        const scopes = 'pages_manage_metadata,pages_messaging,pages_read_engagement,whatsapp_business_messaging,instagram_basic,instagram_manage_messages'
        const state = crypto.randomUUID()

        const authUrl = 'https://www.facebook.com/v19.0/dialog/oauth?client_id=' + settings.meta_app_id + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=' + scopes + '&state=' + state + '&response_type=code'

        return new Response(JSON.stringify({ authUrl, state }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }
})
