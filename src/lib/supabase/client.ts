import { createBrowserClient } from "@supabase/ssr";

/** Session persistante « à vie » : cookies au maximum autorisé par les
 *  navigateurs (400 jours), renouvelés à chaque visite par le middleware.
 *  On ne se reconnecte que si on clique sur « Sortir ». */
export const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE } },
  );
}
