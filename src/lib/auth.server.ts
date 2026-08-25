import type { SupabaseCompat } from "@/integrations/supabase/pg-client";
import { assertRole } from "./admin.server";

export async function hasRole(supabase: SupabaseCompat, userId: string, requiredRole: 'admin' | 'editor' | 'viewer' = 'viewer') {
  try {
    await assertRole(supabase, userId, requiredRole);
    return true;
  } catch {
    return false;
  }
}
