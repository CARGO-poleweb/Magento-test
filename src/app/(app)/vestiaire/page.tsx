import { Chat } from "@/components/Chat";
import { getSessionProfile } from "@/lib/data";
import type { Message, MessageReaction, Profile } from "@/lib/types";

export default async function VestiairePage() {
  const { supabase, profile } = await getSessionProfile();

  const [{ data: messages }, { data: profiles }] = await Promise.all([
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(150),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const list = ((messages ?? []) as Message[]).reverse();
  const { data: reactions } =
    list.length > 0
      ? await supabase
          .from("message_reactions")
          .select("*")
          .in(
            "message_id",
            list.map((m) => m.id),
          )
      : { data: [] };

  const memberNames = Object.fromEntries(
    ((profiles ?? []) as Pick<Profile, "id" | "display_name">[]).map((p) => [
      p.id,
      p.display_name,
    ]),
  );

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Le Vestiaire</h2>
        <p className="text-xs text-muted">
          La déconne de la ligue, en direct. Les pronostics officiels, eux, se font dans l’onglet Journées (article 11).
        </p>
      </header>
      <Chat
        meId={profile.id}
        memberNames={memberNames}
        initialMessages={list}
        initialReactions={(reactions ?? []) as MessageReaction[]}
      />
    </div>
  );
}
