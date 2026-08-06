"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { markChatRead, sendMessage, toggleReaction, type ActionResult } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { REACTION_EMOJIS, type Message, type MessageReaction } from "@/lib/types";

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function Chat({
  meId,
  memberNames,
  initialMessages,
  initialReactions,
}: {
  meId: string;
  memberNames: Record<string, string>;
  initialMessages: Message[];
  initialReactions: MessageReaction[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [reactions, setReactions] = useState<MessageReaction[]>(initialReactions);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await sendMessage(null, fd);
      setResult(res);
      if (res.ok) {
        formRef.current?.reset();
        setPhotoName(null);
      }
    });
  }

  // Abonnement temps réel : nouveaux messages et réactions des copains.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("vestiaire")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          startTransition(() => markChatRead());
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.new as MessageReaction;
          setReactions((prev) =>
            prev.some(
              (x) => x.message_id === r.message_id && x.member_id === r.member_id && x.emoji === r.emoji,
            )
              ? prev
              : [...prev, r],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.old as MessageReaction;
          setReactions((prev) =>
            prev.filter(
              (x) =>
                !(x.message_id === r.message_id && x.member_id === r.member_id && x.emoji === r.emoji),
            ),
          );
        },
      )
      .subscribe();

    startTransition(() => markChatRead());
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, Map<string, { count: number; mine: boolean }>>();
    for (const r of reactions) {
      const byEmoji = map.get(r.message_id) ?? new Map();
      const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.member_id === meId) entry.mine = true;
      byEmoji.set(r.emoji, entry);
      map.set(r.message_id, byEmoji);
    }
    return map;
  }, [reactions, meId]);

  function react(messageId: string, emoji: string) {
    // Optimiste : le temps réel confirmera.
    const mine = reactions.some(
      (r) => r.message_id === messageId && r.member_id === meId && r.emoji === emoji,
    );
    setReactions((prev) =>
      mine
        ? prev.filter(
            (r) => !(r.message_id === messageId && r.member_id === meId && r.emoji === emoji),
          )
        : [...prev, { message_id: messageId, member_id: meId, emoji }],
    );
    const fd = new FormData();
    fd.set("message_id", messageId);
    fd.set("emoji", emoji);
    startTransition(() => toggleReaction(fd));
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="rounded-xl border border-neutral-800 p-4 text-center text-sm text-neutral-500">
            Le Vestiaire est ouvert — premier message, première tournée. 🍻
          </p>
        )}
        {messages.map((m) => {
          const mine = m.member_id === meId;
          const byEmoji = reactionsByMessage.get(m.id);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm border-green-900 bg-green-950/50"
                    : "rounded-bl-sm border-neutral-800 bg-neutral-900/70"
                }`}
              >
                <p className="text-[10px] font-bold text-green-500">
                  {memberNames[m.member_id] ?? "?"}
                  <span className="ml-2 font-normal text-neutral-600">
                    {timeFmt.format(new Date(m.created_at))}
                  </span>
                </p>
                {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                {m.image_url && (
                  <a href={m.image_url} target="_blank" rel="noreferrer">
                    <Image
                      src={m.image_url}
                      alt="Photo du Vestiaire"
                      width={480}
                      height={360}
                      unoptimized
                      className="mt-1 h-auto max-h-72 w-auto max-w-full rounded-lg"
                    />
                  </a>
                )}
                <div className="mt-1 flex gap-1">
                  {REACTION_EMOJIS.map((emoji) => {
                    const entry = byEmoji?.get(emoji);
                    return (
                      <button
                        key={emoji}
                        onClick={() => react(m.id, emoji)}
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          entry?.mine
                            ? "bg-green-900/70"
                            : entry
                              ? "bg-neutral-800"
                              : "opacity-30 hover:opacity-100"
                        }`}
                        title={entry?.mine ? "Retirer ma réaction" : "Réagir"}
                      >
                        {emoji}
                        {entry ? ` ${entry.count}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              {m.looks_like_prediction && (
                <p className="mt-1 max-w-[85%] rounded-lg bg-amber-950/50 px-2 py-1 text-[11px] text-amber-400">
                  ⚠️ Psst — un pronostic posté ici ne compte pas (article 11). Direction l’onglet
                  📅 Journées !
                </p>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label
            className="cursor-pointer rounded-full border border-neutral-700 px-2.5 py-2 text-sm hover:border-neutral-500"
            title="Joindre une photo"
          >
            📎
            <input
              type="file"
              name="photo"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <input
            name="content"
            placeholder="Écrire au Vestiaire…"
            autoComplete="off"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm outline-none focus:border-green-600"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-green-700 px-3.5 py-2 text-sm font-bold hover:bg-green-600 disabled:opacity-50"
            aria-label="Envoyer"
          >
            ➤
          </button>
        </div>
        {photoName && <p className="pl-11 text-[11px] text-neutral-500">📎 {photoName}</p>}
        {result && !result.ok && (
          <p className="pl-11 text-[11px] text-red-400">
            {result.title}
            {result.detail ? ` — ${result.detail}` : ""}
          </p>
        )}
      </form>
    </div>
  );
}
