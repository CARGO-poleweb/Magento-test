import Link from "next/link";
import { getSessionProfile, ROLE_LABELS } from "@/lib/data";
import { signOut } from "@/app/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSessionProfile();

  // Navigation resserrée : 3 onglets aujourd'hui, 5 max à terme (le Vestiaire
  // et les Défis prendront les places libres en V1). Tout le reste vit dans
  // « Plus » pour que la barre reste lisible sur mobile.
  const tabs = [
    { href: "/", label: "Accueil", icon: "🏆" },
    { href: "/journees", label: "Journées", icon: "📅" },
    { href: "/plus", label: "Plus", icon: "⋯" },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div>
          <Link href="/" className="text-lg font-black tracking-tight">
            🏆 La Ligue des Copains
          </Link>
          <p className="text-xs text-neutral-500">
            {profile.display_name} · {ROLE_LABELS[profile.role]}
            {profile.is_radie && " · ⛔ radié"}
          </p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-100">
            Sortir
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl justify-around">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] text-neutral-400 hover:text-neutral-100"
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
