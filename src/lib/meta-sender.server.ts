import { supabaseAdmin } from '@/integrations/supabase/client.server';

export async function sendMetaMessage(recipientId: string, text: string, platform: 'messenger' | 'whatsapp' | 'instagram') {
  const { data: settings } = await supabaseAdmin
    .from('agent_settings')
    .select('meta_access_token, meta_page_id, meta_whatsapp_business_account_id')
    .eq('id', 1)
    .maybeSingle();

  if (!settings?.meta_access_token) {
    throw new Error('Meta access token not configured');
  }

  if (platform === 'messenger' || platform === 'instagram') {
    if (!settings.meta_page_id) throw new Error('Meta Page ID not configured');

    const res = await fetch(`https://graph.facebook.com/v19.0/${settings.meta_page_id}/messages?access_token=${settings.meta_access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text }
      })
    });

    const result = await res.json();
    if (result.error) throw new Error(result.error.message);
    return result;
  } else if (platform === 'whatsapp') {
    const res = await fetch(`https://graph.facebook.com/v19.0/${settings.meta_whatsapp_business_account_id}/messages?access_token=${settings.meta_access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: { body: text }
      })
    });

    const result = await res.json();
    if (result.error) throw new Error(result.error.message);
    return result;
  }
}

/**
 * Fetch a user's display name from Meta Graph API using their PSID.
 *
 * NOTE: Direct lookup `/{psid}?fields=first_name,last_name` FAILS with a
 * Page access token (error code 100, subcode 33: "object does not exist /
 * missing permissions"). The reliable way to get a PSID's name with a Page
 * token is the page `conversations` endpoint, whose `participants` include
 * the name. New conversations sort to the top (by updated_time), so a fresh
 * sender is almost always in the first page — we scan a few pages then bail.
 * Returns null if the name can't be resolved (non-fatal).
 */
export async function fetchSenderName(
  senderId: string,
  accessToken: string,
  pageId?: string
): Promise<string | null> {
  try {
    const pid = pageId
      ?? (await supabaseAdmin
        .from('agent_settings').select('meta_page_id').eq('id', 1).maybeSingle())?.meta_page_id;
    if (!pid) return null;

    let url = `https://graph.facebook.com/v19.0/${pid}/conversations?fields=participants&limit=100&access_token=${accessToken}`;
    // Scan up to 10 pages (1000 convos); new senders are at the top.
    for (let i = 0; i < 10; i++) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const j = await res.json() as any;
      for (const c of j.data ?? []) {
        for (const p of c.participants?.data ?? []) {
          if (p.id === senderId && p.name && p.name !== 'Facebook user') {
            return p.name;
          }
        }
      }
      if (!j.paging?.next) break;
      url = j.paging.next;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Send a voice/audio message via Meta API
 * Uploads the audio file first, then sends it as an attachment
 */
export async function sendVoiceMessage(
  recipientId: string,
  audioBase64: string,
  mimeType: string,
  platform: 'messenger' | 'whatsapp' | 'instagram'
) {
  const { data: settings } = await supabaseAdmin
    .from('agent_settings')
    .select('meta_access_token, meta_page_id, meta_whatsapp_business_account_id')
    .eq('id', 1)
    .maybeSingle();

  if (!settings?.meta_access_token) {
    throw new Error('Meta access token not configured');
  }

  // Convert base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'mp3';
  const filename = `voice_${Date.now()}.${ext}`;

  if (platform === 'messenger' || platform === 'instagram') {
    if (!settings.meta_page_id) throw new Error('Meta Page ID not configured');

    // Step 1: Upload the audio file
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
    formData.append('access_token', settings.meta_access_token);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v19.0/${settings.meta_page_id}/message_attachments`,
      { method: 'POST', body: formData }
    );
    const uploadResult = await uploadRes.json();
    if (uploadResult.error) throw new Error(uploadResult.error.message);

    const attachmentId = uploadResult.attachment_id;
    if (!attachmentId) throw new Error('Failed to upload audio');

    // Step 2: Send the attachment
    const sendRes = await fetch(
      `https://graph.facebook.com/v19.0/${settings.meta_page_id}/messages?access_token=${settings.meta_access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'audio',
              payload: { attachment_id: attachmentId }
            }
          }
        })
      }
    );
    const sendResult = await sendRes.json();
    if (sendResult.error) throw new Error(sendResult.error.message);
    return sendResult;

  } else if (platform === 'whatsapp') {
    // WhatsApp: Upload to media endpoint first
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('access_token', settings.meta_access_token);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v19.0/${settings.meta_whatsapp_business_account_id}/media`,
      { method: 'POST', body: formData }
    );
    const uploadResult = await uploadRes.json();
    if (uploadResult.error) throw new Error(uploadResult.error.message);

    const mediaId = uploadResult.id;
    if (!mediaId) throw new Error('Failed to upload audio for WhatsApp');

    // Send audio message
    const sendRes = await fetch(
      `https://graph.facebook.com/v19.0/${settings.meta_whatsapp_business_account_id}/messages?access_token=${settings.meta_access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientId,
          type: 'audio',
          audio: { id: mediaId }
        })
      }
    );
    const sendResult = await sendRes.json();
    if (sendResult.error) throw new Error(sendResult.error.message);
    return sendResult;
  }
}
