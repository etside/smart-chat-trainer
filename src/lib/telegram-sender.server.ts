/**
 * Telegram Bot API sender
 * Sends text messages, images, and voice notes via Telegram Bot API.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

export interface TelegramSendResult {
  ok: boolean;
  result?: any;
  error?: string;
}

/**
 * Send a text message via Telegram.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  token: string,
  options?: { replyToMessageId?: number; parseMode?: string }
): Promise<TelegramSendResult> {
  const url = `${TELEGRAM_API}${token}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text: text.slice(0, 4096),
  };
  if (options?.replyToMessageId) body.reply_to_message_id = options.replyToMessageId;
  if (options?.parseMode) body.parse_mode = options.parseMode;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[telegram] sendMessage failed:", data.description);
      return { ok: false, error: data.description };
    }
    return { ok: true, result: data.result };
  } catch (err: any) {
    console.error("[telegram] sendMessage error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a photo via Telegram.
 */
export async function sendTelegramPhoto(
  chatId: string | number,
  photoUrl: string,
  token: string,
  caption?: string
): Promise<TelegramSendResult> {
  const url = `${TELEGRAM_API}${token}/sendPhoto`;
  const body: any = {
    chat_id: chatId,
    photo: photoUrl,
  };
  if (caption) body.caption = caption.slice(0, 1024);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.ok ? { ok: true, result: data.result } : { ok: false, error: data.description };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send a voice message via Telegram.
 */
export async function sendTelegramVoice(
  chatId: string | number,
  voiceUrl: string,
  token: string,
  caption?: string
): Promise<TelegramSendResult> {
  const url = `${TELEGRAM_API}${token}/sendVoice`;
  const body: any = {
    chat_id: chatId,
    voice: voiceUrl,
  };
  if (caption) body.caption = caption.slice(0, 1024);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.ok ? { ok: true, result: data.result } : { ok: false, error: data.description };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send inline keyboard (product card) via Telegram.
 */
export async function sendTelegramProductCard(
  chatId: string | number,
  token: string,
  product: {
    name: string;
    price: number;
    image_url?: string;
    product_url?: string;
    availability?: string;
    sizes?: string[];
    product_id?: string;
  }
): Promise<TelegramSendResult> {
  const priceText = `৳ ${product.price.toLocaleString()}`;
  const stockText = product.availability === "in stock" ? "✅ In Stock" : "❌ Out of Stock";
  const sizeText = product.sizes?.length ? `📏 Sizes: ${product.sizes.join(", ")}` : "";
  const caption = `*${product.name}*\n\n${priceText}\n${stockText}${sizeText ? "\n" + sizeText : ""}`;

  const buttons: any[] = [];
  if (product.product_url) {
    buttons.push([{ text: "🛒 View Product", url: product.product_url }]);
  }
  buttons.push([{ text: "🛒 Order Now", callback_data: `order:${product.product_id || product.name}` }]);

  if (product.image_url) {
    const url = `${TELEGRAM_API}${token}/sendPhoto`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: product.image_url,
          caption: caption,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: buttons },
        }),
      });
      const data = await res.json();
      return data.ok ? { ok: true, result: data.result } : { ok: false, error: data.description };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // Fallback: text-only with keyboard
  return sendTelegramMessage(chatId, caption, token, { parseMode: "Markdown" });
}

/**
 * Answer a Telegram callback query (e.g., from inline button press).
 */
export async function answerTelegramCallback(
  callbackQueryId: string,
  token: string,
  text?: string
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || "Processing...",
        show_alert: false,
      }),
    });
  } catch {}
}

/**
 * Set Telegram webhook URL.
 */
export async function setTelegramWebhook(webhookUrl: string, token: string): Promise<TelegramSendResult> {
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });
    const data = await res.json();
    return data.ok ? { ok: true, result: data.result } : { ok: false, error: data.description };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
