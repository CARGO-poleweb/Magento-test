import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "@/components/icons";
import { getSessionProfile } from "@/lib/data";

export const metadata = { title: "Guide du Président · La Ligue des Copains" };

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-[0_2px_8px_-4px_rgba(18,33,26,0.12)]">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">
          {step}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default async function GuidePage() {
  const { profile } = await getSessionProfile();
  if (profile.role !== "president") redirect("/");

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
        >
          <ChevronLeft size={14} strokeWidth={2.5} aria-hidden />
          Espace du Président
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Guide du Président</h1>
        <p className="text-xs text-muted">
          Deux gestes par semaine, le reste tourne tout seul. À garder sous le coude les premières
          journées.
        </p>
      </header>

      <div className="rounded-card border border-accent-line bg-accent-soft p-4">
        <h2 className="text-sm font-semibold text-accent-strong">Le rituel de la semaine</h2>
        <p className="mt-1 text-sm leading-relaxed">
          <b>Jeudi ou vendredi : Publier</b> la journée — c’est ce qui ouvre les pronostics aux
          copains.
          <br />
          <b>Lundi : Clôturer</b> — les scores sont arrivés seuls dans la nuit, le bouton est vert,
          les points tombent.
        </p>
        <p className="mt-2 text-xs text-muted">
          Entre les deux, tu n’as rien à faire. Le calendrier, les horaires et les résultats
          arrivent de football-data.org sans intervention.
        </p>
      </div>

      <Section step="1" title="Avant la saison : composer la ligue">
        <p>
          Dans <b>Saisons et équipes concernées ★</b>, coche les clubs de Ligue 1 de la saison, puis
          les <b>5 équipes concernées</b> : les 3 fixes, celle tirée au sort et celle choisie par le
          vainqueur sortant. C’est sur ces équipes que portent les journées classiques.
        </p>
        <p>
          Un bandeau orange te rappelle tant que les 5 ★ ne sont pas désignées. Tu peux ajuster en
          cours de saison — un club déjà programmé dans une journée reste dans la composition.
        </p>
      </Section>

      <Section step="2" title="Charger le calendrier">
        <p>
          <b>Importer le calendrier</b> crée les 34 journées d’un coup, en brouillon. J1 et J34
          passent en multiplex (9 matchs), les autres ne retiennent que les matchs des équipes ★ (5
          matchs), classés par heure de coup d’envoi comme l’exige l’article 10.
        </p>
        <p>
          Relance-le quand tu veux : il ne crée pas de doublon et rafraîchit les horaires des matchs
          pas encore joués, que la TV déplace souvent.
        </p>
      </Section>

      <Section step="3" title="Publier une journée">
        <p>
          Une journée en <b>brouillon</b> est invisible pour les membres. <b>Publier</b> l’ouvre aux
          pronostics et envoie une notification à tout le monde.
        </p>
        <p>
          Publie au fil de l’eau plutôt que tout d’un coup : les horaires des semaines suivantes
          bougeront encore. Tant que personne n’a parié, tu peux <b>Dépublier</b> pour revenir en
          arrière — au premier pronostic déposé, c’est gravé (article 12).
        </p>
      </Section>

      <Section step="4" title="Les résultats">
        <p>
          Une tâche automatique récupère les scores chaque soir à 22 h. Les cases de saisie à côté
          des matchs sont un filet de secours : match reporté, API en retard, ou score que tu veux
          trancher toi-même — l’article 1 te le permet.
        </p>
        <p>
          Dès qu’un score est saisi, les points de ce match tombent : <b>4</b> pour le score exact,{" "}
          <b>3</b> pour le bon écart, <b>2</b> pour le bon vainqueur. Le classement bouge pendant le
          week-end.
        </p>
      </Section>

      <Section step="5" title="Clôturer">
        <p>
          Le bouton n’apparaît en vert qu’une fois <b>tous</b> les scores saisis — sinon il affiche
          ce qui manque. C’est normal : la clôture déclenche ce qui se calcule sur la journée
          entière, le <b>+3</b> (tous les résultats trouvés), le <b>+10</b> (tous les scores exacts)
          et le <b>−2</b> de la journée blanche.
        </p>
        <p>Elle notifie aussi tout le monde et range la journée dans les archives.</p>
      </Section>

      <Section step="6" title="Les membres">
        <p>
          <b>Inviter quelqu’un</b> fabrique un lien de connexion à coller dans un e-mail : un clic et
          la personne est dans l’app, sans mot de passe. Génère-le juste avant d’envoyer, il expire.
        </p>
        <p>
          <b>Radier</b> (article 3) met un membre de côté en gardant son historique — c’est
          réversible. <b>Supprimer définitivement</b> est réservé aux comptes de test : tout part,
          sans retour.
        </p>
        <p className="text-xs text-faint">
          Les rôles (Premier Ministre, Commission de discipline) s’attribuent encore dans Supabase —
          voir le README.
        </p>
      </Section>

      <Section step="7" title="Les bonus cachés">
        <p>
          Chacun dépose ses pronostics de saison avant la deadline. Personne ne voit ceux des autres.
          Une fois la date passée, <b>Révéler tous les bonus cachés</b> les rend visibles à tous —
          irréversible, donc à faire une seule fois, après la deadline.
        </p>
      </Section>

      <Section step="8" title="La Commission de discipline">
        <p>
          Les pronostics se saisissent librement, comme sur WhatsApp. Quand l’app ne sait pas
          trancher — équipe ambiguë, deuxième pari sur le même match, score illisible — elle ne
          refuse pas : elle enregistre et transmet à la Commission, qui décide. Le dossier apparaît
          dans l’onglet <b>Plus</b>, avec une pastille.
        </p>
      </Section>

      <div className="rounded-card border border-warn-line bg-warn-soft p-4">
        <h2 className="text-sm font-semibold">En cas de doute</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Rien n’est irréversible sauf trois choses, toutes signalées en rouge ou en orange : la
          révélation des bonus, la suppression d’un compte et la suppression d’une journée. Le reste
          se corrige.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Et pour tout le reste, article 1 : le Président a toujours raison.
        </p>
      </div>
    </div>
  );
}
