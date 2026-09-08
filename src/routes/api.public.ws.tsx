/**
 * Real-time event stream endpoint (SSE)
 * Clients connect to: https://daddyai.online/api/public/ws
 * 
 * Supports:
 * - SSE (Server-Sent Events) for real-time updates
 * - GET with ?since=<timestamp> for polling
 * - GET with Last-Event-ID header for reconnection
 */

import { createFileRoute } from '@tanstack/react-router'
import { getEventsSince, getLatestEventId, getWSStats } from '@/lib/ws-notifications.server'

export const Route = createFileRoute('/api/public/ws')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)

        // SSE stream mode
        if (url.searchParams.get('stream') === '1' || request.headers.get('accept') === 'text/event-stream') {
          const encoder = new TextEncoder()
          let lastEventId = parseInt(request.headers.get('last-event-id') || url.searchParams.get('since') || '0', 10)
          let disposed = false

          const stream = new ReadableStream({
            async start(controller) {
              // Send initial connection event
              controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true, service: 'daddyai-sse', timestamp: Date.now() })}\n\n`))

              // Poll for new events
              const interval = setInterval(() => {
                if (disposed) { clearInterval(interval); return }
                try {
                  const events = getEventsSince(lastEventId)
                  for (const evt of events) {
                    lastEventId = evt.timestamp
                    controller.enqueue(encoder.encode(`id: ${evt.timestamp}\nevent: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`))
                  }
                } catch {}
              }, 1000)

              // Heartbeat every 30s
              const heartbeat = setInterval(() => {
                if (disposed) { clearInterval(heartbeat); return }
                try {
                  controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`))
                } catch {}
              }, 30000)

              // Cleanup on close
              request.signal.addEventListener('abort', () => {
                disposed = true
                clearInterval(interval)
                clearInterval(heartbeat)
                try { controller.close() } catch {}
              })
            },
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
            },
          })
        }

        // Polling mode: GET /api/public/ws?since=<timestamp>
        const since = parseInt(url.searchParams.get('since') || '0', 10)
        if (since > 0) {
          const events = getEventsSince(since)
          return new Response(JSON.stringify({ ok: true, events, latestId: getLatestEventId() }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Info mode
        return new Response(JSON.stringify({
          ok: true,
          service: 'daddyai-realtime',
          ...getWSStats(),
          usage: {
            sse: 'GET /api/public/ws?stream=1 (Accept: text/event-stream)',
            poll: 'GET /api/public/ws?since=<timestamp_ms>',
            events: [
              'inbox:new_message',
              'inbox:message_sent',
              'inbox:status_change',
              'escalation:new',
              'sync:progress',
            ],
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
