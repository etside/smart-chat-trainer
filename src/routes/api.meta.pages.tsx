import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/meta/pages')({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: settings } = await supabaseAdmin
          .from('agent_settings')
          .select('meta_access_token, meta_page_id')
          .eq('id', 1)
          .maybeSingle()

        if (!settings?.meta_access_token) {
          return new Response(JSON.stringify({ connected: false, error: 'Meta not connected' }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }

        try {
          const res = await fetch('https://graph.facebook.com/v19.0/' + settings.meta_page_id + '?fields=name,link,picture&access_token=' + settings.meta_access_token)
          const pageData = await res.json()
          if (pageData.error) throw new Error(pageData.error.message)

          return new Response(JSON.stringify({
            connected: true,
            page: { id: settings.meta_page_id, name: pageData.name, link: pageData.link, picture: pageData.picture?.data?.url }
          }), { headers: { 'Content-Type': 'application/json' } })
        } catch (err: any) {
          return new Response(JSON.stringify({ connected: false, error: err.message }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
