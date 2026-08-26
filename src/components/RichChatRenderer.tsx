import React, { useMemo, useState } from "react";
import "./RichChatRenderer.css";

export type ChatLanguage = "bn" | "banglish" | "en" | "mixed";

export type ProductCard = {
  product_id: string;
  title: string;
  description?: string;
  image_url?: string;
  price: number;
  currency?: string;
  availability: string;
  variant_summary?: string;
  features?: string[];
  order_url?: string;
  actions?: Array<{
    type: "url";
    label: "Order Now";
    url: string;
    style?: "primary_green";
    icon?: "cart";
  }>;
};

export type ChatMessage =
  | {
      type: "text";
      text: string;
      language?: ChatLanguage;
      sender?: "agent" | "customer";
    }
  | {
      type: "product_card";
      product_card: ProductCard;
    }
  | {
      type: "order_confirmation";
      order_confirmation: {
        confirmed: true;
        headline: string;
        details: string[];
        status_icon?: "success_check";
        next_step?: string;
      };
    }
  | {
      type: "handoff";
      handoff: {
        required: true;
        reason: string;
        message: string;
        summary_for_human_agent?: string;
      };
    };

export type ChatPayload = {
  messages: ChatMessage[];
  conversation_state?: {
    intent?: string;
    order_stage?: string;
    selected_product_id?: string;
    selected_variant?: string;
    handoff_required?: boolean;
  };
};

type OrderAction = NonNullable<ProductCard["actions"]>[number];

type RichChatRendererProps = {
  /** Pass the parsed LLM response or the raw JSON string returned by your backend. */
  response: ChatPayload | string;
  /** Optional callback for opening your own checkout/order flow. */
  onOrderNow?: (product: ProductCard, action: OrderAction) => void | Promise<void>;
  /** Only URLs from these hosts are allowed to open from an Order Now button. */
  approvedOrderHosts?: string[];
  /** Optional callback for the share icon. */
  onShareProduct?: (product: ProductCard) => void;
  /** Optional fallback shown when the LLM response cannot be rendered. */
  fallbackText?: string;
};

function parseResponse(response: ChatPayload | string): ChatPayload | null {
  if (typeof response !== "string") return response;

  try {
    const parsed = JSON.parse(response) as ChatPayload | { chat_response?: ChatPayload };
    return "messages" in parsed
      ? parsed
      : parsed.chat_response ?? null;
  } catch {
    return null;
  }
}

function isAllowedHttpUrl(value: string | undefined, approvedHosts: string[]) {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (approvedHosts.length === 0) return true;
    return approvedHosts.includes(url.host);
  } catch {
    return false;
  }
}

function formatPrice(price: number, currency = "BDT") {
  try {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

function ProductCardView({
  product,
  approvedOrderHosts,
  onOrderNow,
  onShareProduct,
}: {
  product: ProductCard;
  approvedOrderHosts: string[];
  onOrderNow?: RichChatRendererProps["onOrderNow"];
  onShareProduct?: RichChatRendererProps["onShareProduct"];
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const orderAction = product.actions?.find(
    (action) => action.label === "Order Now" && action.type === "url",
  );
  const orderUrl = orderAction?.url || product.order_url;
  const availability = product.availability.toLowerCase();
  const isAvailable =
    !/(out of stock|unavailable|sold out)/.test(availability) &&
    /(in stock|available|ready|stock)/.test(availability);
  const canOrder = isAvailable && isAllowedHttpUrl(orderUrl, approvedOrderHosts);
  const imageIsSafe = isAllowedHttpUrl(product.image_url, []);

  const handleOrderNow = async () => {
    if (!canOrder || !orderUrl) return;

    const action: OrderAction = orderAction ?? {
      type: "url",
      label: "Order Now",
      url: orderUrl,
      style: "primary_green",
      icon: "cart",
    };

    setIsOrdering(true);
    try {
      if (onOrderNow) {
        await onOrderNow(product, action);
      } else {
        window.open(orderUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <article className="product-card" aria-label={`Product: ${product.title}`}>
      <div className="product-card__media">
        {imageIsSafe && !imageFailed ? (
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="product-card__image-fallback" aria-label="Product image unavailable">
            Image unavailable
          </div>
        )}
      </div>

      <div className="product-card__body">
        <div className="product-card__heading-row">
          <h3>{product.title}</h3>
          {onShareProduct && (
            <button
              className="share-button"
              type="button"
              aria-label={`Share ${product.title}`}
              onClick={() => onShareProduct(product)}
            >
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>

        <div className="product-card__price">
          {formatPrice(product.price, product.currency || "BDT")}
        </div>

        <div className="product-card__divider" />

        <p className="product-card__availability">{product.availability}</p>

        {product.variant_summary && (
          <p className="product-card__variants">{product.variant_summary}</p>
        )}

        {product.features && product.features.length > 0 && (
          <ul className="product-card__features">
            {product.features.map((feature) => (
              <li key={feature}>
                <span className="feature-check" aria-hidden="true">
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {product.description && <p className="product-card__description">{product.description}</p>}

        {canOrder && (
          <button
            className="order-button"
            type="button"
            onClick={handleOrderNow}
            disabled={isOrdering}
          >
            <span aria-hidden="true">🛒</span>
            {isOrdering ? "Opening…" : "Order Now"}
          </button>
        )}
      </div>
    </article>
  );
}

export function RichChatRenderer({
  response,
  onOrderNow,
  approvedOrderHosts = [],
  onShareProduct,
  fallbackText = "Sorry, I could not display this response.",
}: RichChatRendererProps) {
  const payload = useMemo(() => parseResponse(response), [response]);

  if (!payload?.messages?.length) {
    return <div className="chat-renderer__error">{fallbackText}</div>;
  }

  return (
    <section className="chat-renderer" aria-live="polite">
      {payload.messages.map((message, index) => {
        const key = `${message.type}-${index}`;

        if (message.type === "text") {
          return (
            <div className="chat-bubble chat-bubble--agent" key={key}>
              {message.text}
            </div>
          );
        }

        if (message.type === "product_card") {
          return (
            <ProductCardView
              key={key}
              product={message.product_card}
              approvedOrderHosts={approvedOrderHosts}
              onOrderNow={onOrderNow}
              onShareProduct={onShareProduct}
            />
          );
        }

        if (message.type === "order_confirmation") {
          const confirmation = message.order_confirmation;
          return (
            <div className="chat-bubble chat-bubble--confirmation" key={key}>
              <div className="confirmation__headline">
                <span className="confirmation__icon" aria-hidden="true">
                  ✓
                </span>
                <strong>{confirmation.headline}</strong>
              </div>
              <div className="confirmation__details">
                {confirmation.details.map((detail) => (
                  <div key={detail}>{detail}</div>
                ))}
              </div>
              {confirmation.next_step && <div>{confirmation.next_step}</div>}
            </div>
          );
        }

        if (message.type === "handoff") {
          return (
            <div className="chat-bubble chat-bubble--handoff" key={key}>
              {message.handoff.message}
            </div>
          );
        }

        return null;
      })}
      <footer className="chat-renderer__footer">
        &copy; {new Date().getFullYear()} Tynio LTD. All rights reserved.
      </footer>
    </section>
  );
}

export default RichChatRenderer;
