import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Diagnostic clair plutôt qu'un crash opaque si la configuration manque.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    return new NextResponse(
      `⚙️ Configuration incomplète : variable(s) d'environnement manquante(s) dans Vercel : ${missing.join(", ")}.\n` +
        "Vérifiez l'orthographe exacte des noms dans Settings → Environment Variables, puis redéployez.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  if (!/^https:\/\/.+\.supabase\.co$/.test(url!.trim())) {
    return new NextResponse(
      `⚙️ Configuration invalide : NEXT_PUBLIC_SUPABASE_URL vaut « ${url} » — attendu une adresse du type https://xxxx.supabase.co (sans espace ni guillemets).`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  // Rattrapage : quand l'adresse de retour n'est pas dans la liste blanche de
  // Supabase (Authentication → URL Configuration), le jeton est déposé sur la
  // racine du site au lieu de /auth/confirm — et l'utilisateur atterrit sur
  // l'écran de connexion sans comprendre. On réachemine le jeton.
  const params = request.nextUrl.searchParams;
  const carriesToken = params.has("code") || (params.has("token_hash") && params.has("type"));
  if (carriesToken && !request.nextUrl.pathname.startsWith("/auth/confirm")) {
    const target = request.nextUrl.clone();
    target.pathname = "/auth/confirm";
    return NextResponse.redirect(target);
  }

  const supabase = createServerClient(
    url!,
    anonKey!,
    {
      // Session « à vie » : le passage dans le middleware rafraîchit le jeton
      // et repousse l'expiration du cookie à 400 jours (le max navigateur).
      cookieOptions: { maxAge: 400 * 24 * 60 * 60 },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|sw.js|.*\\.png$).*)"],
};
