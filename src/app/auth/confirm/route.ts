import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cible du lien magique : ouvre la session puis redirige vers l'app.
 * Deux formats de lien sont acceptés :
 *  - le gabarit e-mail par défaut de Supabase (paramètre `code`, flux PKCE) —
 *    aucun SMTP personnalisé nécessaire ;
 *  - un gabarit personnalisé `?token_hash=...&type=email` si la ligue en
 *    configure un plus tard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?erreur=lien-invalide");
}
