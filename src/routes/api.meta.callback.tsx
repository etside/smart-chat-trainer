import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/meta/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          return new Response(JSON.stringify({ error: url.searchParams.get('error_description') || error }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          })
        }
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          })
        }

        const { data: settings } = await supabaseAdmin
          .from('agent_settings')
          .select('meta_app_id, meta_app_secret')
          .eq('id', 1)
          .maybeSingle()

        if (!settings?.meta_app_id || !settings?.meta_app_secret) {
          return new Response(JSON.stringify({ error: 'Meta credentials not configured' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
          })
        }

        const origin = 'https://daddyai.online'
        const redirectUri = origin + '/api/meta/callback'

        try {
          // Exchange code for short-lived token
          const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token?client_id=' + settings.meta_app_id + '&client_secret=' + settings.meta_app_secret + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&code=' + code)
          const tokenData = await tokenRes.json()
          if (tokenData.error) throw new Error(tokenData.error.message)

          // Exchange for long-lived token
          const longRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=' + settings.meta_app_id + '&client_secret=' + settings.meta_app_secret + '&fb_exchange_token=' + tokenData.access_token)
          const longData = await longRes.json()
          if (longData.error) throw new Error(longData.error.message)

          const accessToken = longData.access_token

          // Fetch user's pages
          const pagesRes = await fetch('https://graph.facebook.com/v19.0/me/accounts?access_token=' + accessToken)
          const pagesData = await pagesRes.json()
          if (pagesData.error) throw new Error(pagesData.error.message)

          const pages = pagesData.data || []
          let pageId = ''
          let pageToken = ''

          if (pages.length > 0) {
            pageId = pages[0].id
            pageToken = pages[0].access_token

            // Subscribe webhook to each page
            for (const page of pages) {
              try {
                await fetch('https://graph.facebook.com/v19.0/' + page.id + '/subscribed_fields?subscribed_fields=messages,messaging_postbacks,message_echoes&access_token=' + page.access_token, { method: 'POST' })
              } catch (e) {
                console.warn('Failed to subscribe webhook to page ' + page.id)
              }
            }
          }

          // Store tokens
          await supabaseAdmin.from('agent_settings').update({
            meta_access_token: pageToken || accessToken,
            meta_page_id: pageId,
          }).eq('id', 1)

          await supabaseAdmin.from('webhook_logs').insert({
            source: 'meta_oauth', event_type: 'oauth_success',
            payload: { page_id: pageId, pages_count: pages.length }, status_code: 200
          })

          return new Response(null, {
            status: 302,
            headers: { Location: origin + '/admin/connections?meta=connected' }
          })
        } catch (err: any) {
          console.error('Meta OAuth error:', err)
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
