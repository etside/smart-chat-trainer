import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function sendMetaMessage(recipientId: string, text: string, platform: 'messenger' | 'whatsapp') {
  const { data: settings } = await supabaseAdmin
    .from('agent_settings')
    .select('meta_access_token, meta_page_id, meta_whatsapp_business_account_id')
    .eq('id', 1)
    .maybeSingle();

  if (!settings?.meta_access_token) {
    throw new Error("Meta access token not configured");
  }

  if (platform === 'messenger') {
    if (!settings.meta_page_id) throw new Error("Meta Page ID not configured");
    
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${settings.meta_access_token}`, {
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
    // WhatsApp requires a phone number ID usually found from the business account
    // For simplicity, we assume recipientId is the phone number
    const res = await fetch(`https://graph.facebook.com/v19.0/${settings.meta_whatsapp_business_account_id}/messages?access_token=${settings.meta_access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientId,
        type: "text",
        text: { body: text }
      })
    });
    
    const result = await res.json();
    if (result.error) throw new Error(result.error.message);
    return result;
  }
}
