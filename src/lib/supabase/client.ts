import { createBrowserClient } from "@supabase/ssr";

/** Session persistante « à vie » : cookies au maximum autorisé par les
 *  navigateurs (400 jours), renouvelés à chaque visite par le middleware.
 *  On ne se reconnecte que si on clique sur « Sortir ». */
export const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE },
      auth: {
        // PKCE exige que le lien s'ouvre dans le navigateur qui l'a demandé :
        // la preuve attendue est dans un cookie de ce navigateur-là. Or les
        // applis mail ouvrent les liens ailleurs (Gmail iOS ouvre dans Chrome
        // ou dans son propre navigateur intégré) — et le lien échouait sans
        // rien dire. En flux implicite le jeton voyage dans le lien : il
        // fonctionne depuis n'importe quel navigateur et n'importe quel
        // appareil, ce qu'on attend d'un lien magique.
        flowType: "implicit",
        detectSessionInUrl: true,
      },
    },
  );
}
