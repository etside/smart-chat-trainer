/**
 * WebSocket notification helpers
 * Broadcasts events to connected WebSocket clients for real-time sync.
 *
 * Uses Server-Sent Events (SSE) as a fallback since TanStack Start
 * doesn't natively support WebSocket upgrades in route handlers.
 * Clients can connect to /api/public/ws for event stream.
 */

// In-memory event buffer for SSE polling
const eventBuffer: Array<{ event: string; data: any; timestamp: number }> = []
const MAX_BUFFER_SIZE = 100

function pushEvent(event: string, data: any) {
  eventBuffer.push({ event, data, timestamp: Date.now() })
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER_SIZE)
  }
}

/**
 * Get recent events since a given timestamp (for SSE polling).
 */
export function getEventsSince(since: number): Array<{ event: string; data: any; timestamp: number }> {
  return eventBuffer.filter(e => e.timestamp > since)
}

/**
 * Get the latest event ID (timestamp).
 */
export function getLatestEventId(): number {
  return eventBuffer.length > 0 ? eventBuffer[eventBuffer.length - 1].timestamp : 0
}

/**
 * Notify: new incoming customer message.
 */
export function notifyNewMessage(data: {
  sessionId: string
  externalId: string
  channel: string
  content: string
  customerName?: string
  timestamp: string
}) {
  pushEvent('inbox:new_message', data)
}

/**
 * Notify: reply sent to customer.
 */
export function notifyMessageSent(data: {
  sessionId: string
  channel: string
  content: string
  timestamp: string
}) {
  pushEvent('inbox:message_sent', data)
}

/**
 * Notify: conversation status change.
 */
export function notifyStatusChange(data: {
  sessionId: string
  status: string
  channel: string
}) {
  pushEvent('inbox:status_change', data)
}

/**
 * Notify: new escalation.
 */
export function notifyEscalation(data: {
  sessionId: string
  reason: string
  priority: string
  customerName?: string
}) {
  pushEvent('escalation:new', data)
}

/**
 * Notify: sync progress.
 */
export function notifySyncProgress(data: {
  stage: string
  progress: number
  total: number
  message: string
}) {
  pushEvent('sync:progress', data)
}

/**
 * Get connection stats.
 */
export function getWSStats() {
  return {
    bufferedEvents: eventBuffer.length,
    latestEventId: getLatestEventId(),
  }
}
