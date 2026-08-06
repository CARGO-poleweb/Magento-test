import { addAmende, recordMise } from "@/app/actions";
import { formatEuros, getCurrentSeason, getSessionProfile } from "@/lib/data";
import type { LedgerEntry, Profile } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium" });

export default async function CagnottePage() {
  const { supabase, profile } = await getSessionProfile();

  const season = await getCurrentSeason(supabase);
  const [{ data: profiles }, { data: ledger }] = await Promise.all([
    supabase.from("profiles").select("*").order("display_name"),
    season
      ? supabase
          .from("ledger")
          .select("*")
          .eq("season_id", season.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const members = ((profiles ?? []) as Profile[]).filter((m) => !m.is_radie);
  const entries = (ledger ?? []) as LedgerEntry[];
  const isPresident = profile.role === "president";

  const paidIds = new Set(entries.filter((e) => e.type === "mise").map((e) => e.member_id));
  const paidCount = paidIds.size;
  const amendes = entries.filter((e) => e.type === "amende");
  const totalAmendes = amendes.reduce((sum, e) => sum + e.amount_cents, 0);

  const partVainqueur = season?.part_vainqueur_cents ?? 1500;
  const partBallonOr = season?.part_ballon_or_cents ?? 500;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">
          Cagnotte{season && <span className="text-sm font-normal text-muted"> · {season.name}</span>}
        </h1>
        <p className="text-xs text-muted">
          Article 2 : mise de {formatEuros(season?.mise_cents ?? 2000)} — article 3 : virement au
          Président avant le{" "}
          {season ? dateFmt.format(new Date(season.paiement_deadline)) : "(saison à créer)"}, sous
          peine de radiation. Les paiements se font hors app (virement) ; ici on tient le registre.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-lg font-black text-accent">
            {formatEuros(paidCount * partVainqueur)}
          </p>
          <p className="text-[11px] text-muted">Cagnotte vainqueur (15 € × {paidCount})</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-lg font-black text-warn">
            {formatEuros(paidCount * partBallonOr)}
          </p>
          <p className="text-[11px] text-muted">Ballon d’Or (5 € × {paidCount})</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-lg font-black text-danger">{formatEuros(totalAmendes)}</p>
          <p className="text-[11px] text-muted">Amendes</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-bold">Qui a payé sa mise ?</h2>
        <ul className="overflow-hidden rounded-xl border border-line">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-b-0"
            >
              <span>
                {m.display_name}
                {m.id === profile.id && <span className="ml-1 text-xs text-accent">(toi)</span>}
              </span>
              {paidIds.has(m.id) ? (
                <span className="text-xs text-accent">payé</span>
              ) : isPresident ? (
                <form action={recordMise}>
                  <input type="hidden" name="member_id" value={m.id} />
                  <button className="rounded-lg border border-accent-line px-2 py-1 text-xs text-accent hover:bg-accent-soft">
                    Marquer payé
                  </button>
                </form>
              ) : (
                <span className="text-xs text-faint">en attente</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isPresident && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-bold">Infliger une amende</h2>
          <form action={addAmende} className="flex flex-col gap-2">
            <select
              name="member_id"
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                name="euros"
                inputMode="decimal"
                placeholder="Montant (€)"
                className="w-28 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              />
              <input
                name="note"
                placeholder="Motif"
                className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              />
            </div>
            <button className="self-start rounded-lg bg-danger text-white px-3 py-1.5 text-sm font-semibold hover:bg-danger">
              Ajouter l’amende
            </button>
          </form>
        </section>
      )}

      {amendes.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Casier des amendes</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {amendes.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 text-muted">
                <span>
                  {members.find((m) => m.id === e.member_id)?.display_name ?? "?"} —{" "}
                  {e.note ?? "amende"}
                </span>
                <span className="text-danger">{formatEuros(e.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
