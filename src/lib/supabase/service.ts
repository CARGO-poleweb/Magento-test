import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client service-role : contourne la RLS. Toutes les écritures passent par
 * les server actions qui utilisent ce client APRÈS avoir vérifié elles-mêmes
 * les droits (rôle, verrouillage H-30, deadlines…). Ne jamais l'exposer côté
 * navigateur.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
