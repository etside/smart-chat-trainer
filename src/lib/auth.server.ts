import type { SupabaseClient } from "@supabase/supabase-js";
import { assertRole } from "./admin.server";

export async function hasRole(supabase: SupabaseClient, userId: string, requiredRole: 'admin' | 'editor' | 'viewer' = 'viewer') {
  try {
    await assertRole(supabase, userId, requiredRole);
    return true;
  } catch {
    return false;
  }
}
