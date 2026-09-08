/**
 * message-utils.ts
 * Extracts message content and attachments from Meta webhook payloads.
 * Supports: text, image, audio, video, file, sticker, location.
 */

export type AttachmentType = "image" | "audio" | "video" | "file" | "sticker" | "location" | "unknown";

export interface ExtractedAttachment {
  type: AttachmentType;
  url?: string;
  payload?: any;
  /** Lat/lng for location messages */
  lat?: number;
  lng?: number;
  title?: string;
}

export interface ExtractedMessage {
  text: string | null;
  attachments: ExtractedAttachment[];
  /** Convenience: first image URL if present */
  imageUrl: string | null;
  /** Convenience: first audio URL if present */
  audioUrl: string | null;
  hasImage: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  hasLocation: boolean;
  /** Raw metadata to store in session_messages.metadata */
  rawMeta: Record<string, any>;
}

/**
 * Extract structured content from a Meta webhook message object.
 * Works for Messenger, Instagram, and WhatsApp message objects.
 */
export function extractMessageContent(message: any): ExtractedMessage {
  const result: ExtractedMessage = {
    text: null,
    attachments: [],
    imageUrl: null,
    audioUrl: null,
    hasImage: false,
    hasAudio: false,
    hasVideo: false,
    hasLocation: false,
    rawMeta: {},
  };

  if (!message) return result;

  // ── Text ────────────────────────────────────────────────────────────────────
  if (message.text) {
    result.text = message.text;
  }

  // ── WhatsApp text (nested differently) ─────────────────────────────────────
  if (message.type === "text" && message.text?.body) {
    result.text = message.text.body;
  }

  // ── Messenger / Instagram attachments ───────────────────────────────────────
  const attachments: any[] = message.attachments ?? [];

  // ── WhatsApp media types ─────────────────────────────────────────────────────
  if (message.type === "image" && message.image) {
    attachments.push({ type: "image", payload: { url: message.image.url || message.image.link } });
  } else if (message.type === "audio" && message.audio) {
    attachments.push({ type: "audio", payload: { url: message.audio.url || message.audio.link } });
  } else if (message.type === "video" && message.video) {
    attachments.push({ type: "video", payload: { url: message.video.url || message.video.link } });
  } else if (message.type === "document" && message.document) {
    attachments.push({ type: "file", payload: { url: message.document.url || message.document.link } });
  } else if (message.type === "location" && message.location) {
    attachments.push({
      type: "location",
      payload: { lat: message.location.latitude, lng: message.location.longitude },
    });
  } else if (message.type === "sticker" && message.sticker) {
    attachments.push({ type: "sticker", payload: { url: message.sticker.url } });
  }

  for (const att of attachments) {
    const type = (att.type as AttachmentType) ?? "unknown";
    const url: string | undefined =
      att.payload?.url ??
      att.payload?.sticker_url ??
      undefined;

    const extracted: ExtractedAttachment = { type, url, payload: att.payload };

    if (type === "location") {
      extracted.lat = att.payload?.lat ?? att.payload?.coordinates?.lat;
      extracted.lng = att.payload?.long ?? att.payload?.coordinates?.long ?? att.payload?.lng;
    }

    result.attachments.push(extracted);

    if (type === "image") { result.hasImage = true; result.imageUrl = result.imageUrl ?? url ?? null; }
    if (type === "audio") { result.hasAudio = true; result.audioUrl = result.audioUrl ?? url ?? null; }
    if (type === "video") result.hasVideo = true;
    if (type === "location") result.hasLocation = true;
  }

  // ── Build rawMeta ────────────────────────────────────────────────────────────
  result.rawMeta = {
    ...(result.attachments.length > 0 ? { attachments: result.attachments } : {}),
    ...(message.mid ? { mid: message.mid } : {}),
    ...(message.id ? { message_id: message.id } : {}),
  };

  return result;
}

/**
 * Build a human-readable fallback text for messages with no text content.
 * Used so the AI knows something arrived even if it can't process the content.
 */
export function buildFallbackText(extracted: ExtractedMessage): string {
  if (extracted.text) return extracted.text;
  if (extracted.hasImage) return "[Customer sent an image]";
  if (extracted.hasAudio) return "[Customer sent a voice message]";
  if (extracted.hasVideo) return "[Customer sent a video]";
  if (extracted.hasLocation) return "[Customer shared their location]";
  if (extracted.attachments.length > 0) return "[Customer sent an attachment]";
  return "[Empty message]";
}
