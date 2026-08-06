import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cible du lien magique. Trois formats de retour peuvent arriver ici selon la
 * configuration du projet Supabase — on les accepte tous :
 *  - `?code=…` : flux PKCE, gabarit e-mail par défaut ;
 *  - `?token_hash=…&type=…` : gabarit personnalisé et liens fabriqués par le
 *    Président (createInviteLink) — valables depuis n'importe quel navigateur ;
 *  - `#access_token=…` : flux implicite. Le fragment n'arrive jamais jusqu'au
 *    serveur : la page cliente /auth/confirm/suite prend le relais.
 *
 * En cas d'échec on ne renvoie plus silencieusement vers /login : la raison
 * exacte s'affiche, sinon un lien qui ne marche pas reste indébogable.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    relay("code", error.message);
  }

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(next);
    relay("token_hash", error.message);
  }

  // Erreur renvoyée par Supabase lui-même (lien expiré, déjà utilisé…).
  const supabaseError = searchParams.get("error_description") ?? searchParams.get("error");
  relay(supabaseError ? "supabase" : "aucun", supabaseError ?? "");
}

function relay(source: string, message: string): never {
  const params = new URLSearchParams({ source });
  if (message) params.set("message", message);
  redirect(`/auth/confirm/suite?${params.toString()}`);
}
