import { BonusForm } from "@/components/BonusForm";
import { getCurrentSeason, getSessionProfile } from "@/lib/data";
import type { BonusType, HiddenBonus, Profile } from "@/lib/types";

const BONUSES: {
  type: BonusType;
  label: string;
  points: string;
  placeholder: string;
  triple?: boolean;
}[] = [
  { type: "vainqueur", label: "Vainqueur de la Ligue 1", points: "15 pts", placeholder: "PSG" },
  { type: "buteur", label: "Meilleur buteur", points: "20 pts", placeholder: "Nom du joueur" },
  { type: "passeur", label: "Meilleur passeur", points: "25 pts", placeholder: "Nom du joueur" },
  {
    type: "top3",
    label: "Les 3 premiers",
    points: "ordre 25 pts · désordre 15 pts",
    placeholder: "équipe",
    triple: true,
  },
  {
    type: "bottom3",
    label: "Les 3 derniers",
    points: "ordre 25 pts · désordre 15 pts",
    placeholder: "équipe",
    triple: true,
  },
  {
    type: "classement_tfc",
    label: "Classement du TFC à l’issue de la 34ᵉ journée",
    points: "10 pts",
    placeholder: "ex. 9e",
  },
];

const deadlineFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "long",
  timeStyle: "short",
});

export default async function BonusPage() {
  const { supabase, profile } = await getSessionProfile();

  const season = await getCurrentSeason(supabase);
  const [{ data: bonuses }, { data: profiles }] = await Promise.all([
    season
      ? supabase.from("hidden_bonuses").select("*").eq("season_id", season.id)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("*"),
  ]);

  const all = (bonuses ?? []) as HiddenBonus[];
  const mine = new Map(all.filter((b) => b.member_id === profile.id).map((b) => [b.type, b]));
  const membersById = new Map(((profiles ?? []) as Profile[]).map((m) => [m.id, m]));

  const revealed = Boolean(season?.bonus_reveles);
  const deadline = season ? new Date(season.bonus_deadline) : null;
  const open = !revealed && deadline !== null && new Date() < deadline;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Bonus cachés</h2>
        <p className="text-xs text-muted">
          {season ? `${season.name} · ` : ""}
          {revealed
            ? "Les bonus ont été révélés par le Président."
            : deadline
              ? `À sceller avant le ${deadlineFmt.format(deadline)} (heure de Paris). Personne ne voit tes choix — pas même le Président (article 5 : les siens vont au Premier Ministre).`
              : "Aucune saison en cours."}
        </p>
      </header>

      {!revealed &&
        BONUSES.map((bonus) => {
          const current = mine.get(bonus.type);
          return (
            <section
              key={bonus.type}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{bonus.label}</h2>
                <span className="text-xs text-warn">{bonus.points}</span>
              </div>
              {open ? (
                <BonusForm
                  type={bonus.type}
                  triple={bonus.triple}
                  placeholder={bonus.placeholder}
                  current={current?.answer}
                />
              ) : current ? (
                <p className="font-mono text-sm text-ink">
                  {current.answer.value ?? current.answer.values?.join(" · ")}
                </p>
              ) : (
                <p className="text-sm text-faint">Non déposé — trop tard.</p>
              )}
            </section>
          );
        })}

      {revealed && (
        <div className="flex flex-col gap-4">
          {BONUSES.map((bonus) => (
            <section
              key={bonus.type}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{bonus.label}</h2>
                <span className="text-xs text-warn">{bonus.points}</span>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {all
                  .filter((b) => b.type === bonus.type)
                  .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
                  .map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted">
                        {membersById.get(b.member_id)?.display_name ?? "?"}
                      </span>
                      <span className="font-mono text-xs">
                        {b.answer.value ?? b.answer.values?.join(" · ")}
                        {b.points_awarded !== null && (
                          <span className="ml-2 font-bold text-accent">
                            +{b.points_awarded}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
