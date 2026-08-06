"use client";

import Image from "next/image";
import { AlertTriangle, Paperclip, Send } from "@/components/icons";
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
    <div className="flex flex-col">
      <div className="flex min-h-[46vh] flex-col justify-end gap-2 pb-20">
        {messages.length === 0 && (
          <p className="rounded-xl border border-line p-4 text-center text-sm text-muted">
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
                    ? "rounded-br-sm border-accent-line bg-accent-soft"
                    : "rounded-bl-sm border-line bg-surface"
                }`}
              >
                <p className="text-[10px] font-bold text-accent">
                  {memberNames[m.member_id] ?? "?"}
                  <span className="ml-2 font-normal text-faint">
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
                            ? "bg-accent-line"
                            : entry
                              ? "bg-subtle"
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
                <p className="mt-1 max-w-[85%] rounded-lg bg-warn-soft px-2 py-1 text-[11px] text-warn">
                  <AlertTriangle size={13} className="mr-1 inline align-[-2px]" aria-hidden />
                  Un pronostic posté ici ne compte pas (article 11) — direction l’onglet Journées.
                </p>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="fixed inset-x-0 bottom-[var(--nav-h)] z-10 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <label
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-subtle"
            title="Joindre une photo"
          >
            <Paperclip size={17} strokeWidth={1.8} aria-hidden />
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
            className="min-w-0 flex-1 rounded-full border border-line-strong bg-canvas px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:bg-surface"
          />
          <button
            type="submit"
            disabled={pending}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white transition-transform hover:bg-accent-strong active:scale-95 disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {photoName && (
          <p className="mx-auto w-full max-w-3xl pl-11 pt-1 text-[11px] text-muted">{photoName}</p>
        )}
        {result && !result.ok && (
          <p className="mx-auto w-full max-w-3xl pl-11 pt-1 text-[11px] text-danger">
            {result.title}
            {result.detail ? ` — ${result.detail}` : ""}
          </p>
        )}
      </form>
    </div>
  );
}
