import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertRole(supabase: SupabaseClient, userId: string, requiredRole: 'admin' | 'editor' | 'viewer' = 'viewer') {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new Error("Forbidden: access required");
  
  const role = data.role as string;
  const roles = ['viewer', 'editor', 'admin'];
  const actualIndex = roles.indexOf(role);
  const requiredIndex = roles.indexOf(requiredRole);

  if (actualIndex < requiredIndex) {
    throw new Error(`Forbidden: ${requiredRole} access required`);
  }
  
  return true;
}

/** @deprecated Use assertRole instead */
export async function assertAdmin(supabase: SupabaseClient, userId: string) {
  return assertRole(supabase, userId, 'admin');
}

export async function hashApiKey(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const body = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wi_${body}`;
}

export async function verifyWebhookSignature(payload: string, signature: string | null, secret: string | undefined) {
  if (!signature || !secret) {
    console.warn("Signature verification failed: Missing signature or secret");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    // Strip "sha256=" prefix if present
    const signatureToVerify = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    
    // Validate hex format and convert signature back to bytes for comparison
    if (!/^[0-9a-fA-F]+$/.test(signatureToVerify)) return false;
    
    const signatureBytes = new Uint8Array(
      signatureToVerify.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payload)
    );
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}
